
#!/bin/bash
# ============================================================================
# CVE Platform - Dynamic Organization Onboarding (Kubernetes / Bevel)
#
# Adds a new peer organization to the running Fabric network:
#   1. Generate crypto material (cryptogen extend)
#   2. Store crypto as K8s secrets
#   3. Deploy CA + Peer via Bevel Helm charts
#   4. Patch CoreDNS
#   5. Update channel config to add org's MSP (fetch → modify → sign → submit)
#   6. Join peer to channels
#   7. Install + approve chaincode
#   8. Extract wallet certs for API gateway
#   9. Activate org on ledger
#
# Usage: ./add-org.sh <org-short-name> <msp-id> <peer-port> <nodeport-base>
# Example: ./add-org.sh cna-gamma CNAGammaMSP 13051 32051
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
FABRIC_DIR="${SCRIPT_DIR}/.."
BEVEL_VALUES_DIR="${FABRIC_DIR}/bevel/values"
NETWORK_DIR="${FABRIC_DIR}/network"
BIN_DIR="${FABRIC_DIR}/bin"
CHAINCODE_DIR="${FABRIC_DIR}/chaincode/cve"
BEVEL_CLONE_DIR="${FABRIC_DIR}/bevel/repo"
BEVEL_CHARTS_DIR="${BEVEL_CLONE_DIR}/platforms/hyperledger-fabric/charts"

export PATH="${BIN_DIR}:${PATH}"
export FABRIC_CFG_PATH="${NETWORK_DIR}/configtx"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()    { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# ==================== PARSE ARGS ====================
ORG_SHORT="${1:?Usage: $0 <org-short-name> <msp-id> <peer-port> <nodeport-base>}"
MSP_ID="${2:?MSP ID required (e.g. CNAGammaMSP)}"
PEER_PORT="${3:?Peer port required (e.g. 13051)}"
NODEPORT_BASE="${4:?NodePort base required (e.g. 32051)}"

# Derived values
ORG_NS="${ORG_SHORT}-ns"
ORG_DOMAIN="${ORG_SHORT}.cve.local"
PEER_NAME="peer0-${ORG_SHORT}"
PEER_ADDR="${PEER_NAME}.${ORG_NS}:${PEER_PORT}"
CA_ADMIN="${ORG_SHORT}-admin"
CA_PASS="${ORG_SHORT}-adminpw"
COUCHDB_USER="${ORG_SHORT//-/}admin"
COUCHDB_PASS="${ORG_SHORT//-/}adminpw"
NP_GRPC=$((NODEPORT_BASE))
NP_EVENTS=$((NODEPORT_BASE + 1))
NP_COUCHDB=$((NODEPORT_BASE + 33))
ORG_DISPLAY="${MSP_ID%MSP}"

echo ""
info "Adding organization to Fabric network:"
info "  Short name: ${ORG_SHORT}"
info "  MSP ID:     ${MSP_ID}"
info "  Domain:     ${ORG_DOMAIN}"
info "  Namespace:  ${ORG_NS}"
info "  Peer port:  ${PEER_PORT}"
info "  NodePorts:  grpc=${NP_GRPC}, events=${NP_EVENTS}, couchdb=${NP_COUCHDB}"

# ==================== STEP 1: GENERATE CRYPTO ====================
step1_generate_crypto() {
    header "Step 1: Generate Crypto Material"

    local EXTEND_CONFIG="/tmp/crypto-extend-${ORG_SHORT}.yaml"
    cat > "$EXTEND_CONFIG" <<EOF
PeerOrgs:
  - Name: ${ORG_DISPLAY}
    Domain: ${ORG_DOMAIN}
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - peer0.${ORG_DOMAIN}
        - peer0
        - ${PEER_NAME}
        - ${PEER_NAME}.${ORG_NS}
        - ${PEER_NAME}.${ORG_NS}.svc.cluster.local
    Users:
      Count: 1
EOF

    cryptogen extend \
        --config="$EXTEND_CONFIG" \
        --input="${NETWORK_DIR}/organizations"

    local PEER_DIR="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}"
    [ -f "${PEER_DIR}/tls/server.crt" ] || err "Crypto generation failed"
    info "  ✓ Crypto generated for ${ORG_DOMAIN}"
}

# ==================== STEP 2: K8S NAMESPACE + SECRETS ====================
step2_store_secrets() {
    header "Step 2: Create Namespace & Store Secrets"

    kubectl create namespace ${ORG_NS} 2>/dev/null || true
    kubectl create clusterrolebinding bevel-auth-${ORG_NS} \
        --clusterrole=cluster-admin \
        --serviceaccount=${ORG_NS}:bevel-auth 2>/dev/null || true

    local ORG_BASE="${NETWORK_DIR}/organizations"
    local P_DIR="${ORG_BASE}/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}"
    local A_DIR="${ORG_BASE}/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}"
    local O_DIR="${ORG_BASE}/ordererOrganizations/orderer.cve.local/orderers/orderer0.orderer.cve.local"
    local O_ADMIN="${ORG_BASE}/ordererOrganizations/orderer.cve.local/users/Admin@orderer.cve.local"

    kubectl create secret generic ${PEER_NAME}-tls -n ${ORG_NS} \
        --from-file=cacrt="${P_DIR}/tls/ca.crt" \
        --from-file=servercrt="${P_DIR}/tls/server.crt" \
        --from-file=serverkey="${P_DIR}/tls/server.key" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic ${PEER_NAME}-msp -n ${ORG_NS} \
        --from-file=admincerts="${A_DIR}/msp/signcerts/Admin@${ORG_DOMAIN}-cert.pem" \
        --from-file=cacerts="$(ls ${P_DIR}/msp/cacerts/*.pem | head -1)" \
        --from-file=keystore="$(ls ${P_DIR}/msp/keystore/*_sk | head -1)" \
        --from-file=signcerts="$(ls ${P_DIR}/msp/signcerts/*.pem | head -1)" \
        --from-file=tlscacerts="$(ls ${P_DIR}/msp/tlscacerts/*.pem | head -1)" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic admin-${ORG_SHORT}-msp -n ${ORG_NS} \
        --from-file=admincerts="${A_DIR}/msp/signcerts/Admin@${ORG_DOMAIN}-cert.pem" \
        --from-file=cacerts="$(ls ${A_DIR}/msp/cacerts/*.pem | head -1)" \
        --from-file=keystore="$(ls ${A_DIR}/msp/keystore/*_sk | head -1)" \
        --from-file=signcerts="${A_DIR}/msp/signcerts/Admin@${ORG_DOMAIN}-cert.pem" \
        --from-file=tlscacerts="$(ls ${A_DIR}/msp/tlscacerts/*.pem | head -1)" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic orderer-tls-rootcert -n ${ORG_NS} \
        --from-file=cacrt="${O_DIR}/tls/ca.crt" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic orderer-admin-tls -n ${ORG_NS} \
        --from-file=ca.crt="${O_ADMIN}/tls/ca.crt" \
        --from-file=client.crt="${O_ADMIN}/tls/client.crt" \
        --from-file=client.key="${O_ADMIN}/tls/client.key" \
        --dry-run=client -o yaml | kubectl apply -f -

    info "  ✓ Secrets stored in ${ORG_NS}"
}

# ==================== STEP 3: DEPLOY CA + PEER ====================
step3_deploy_ca_peer() {
    header "Step 3: Deploy CA & Peer via Bevel"

    # Generate CA values file
    cat > "${BEVEL_VALUES_DIR}/${ORG_SHORT}-ca.yaml" <<EOF
global:
  serviceAccountName: bevel-auth
  cluster:
    provider: minikube
    cloudNativeServices: false
  vault:
    type: kubernetes
    role: vault-role
    network: fabric
    address: ""
    authPath: ${ORG_SHORT}
    secretEngine: secretsv2
    secretPrefix: "data/${ORG_SHORT}"
    tls: false
  proxy:
    provider: none
    externalUrlSuffix: cve.local
storage:
  size: 256Mi
  reclaimPolicy: Delete
  volumeBindingMode: Immediate
  allowedTopologies:
    enabled: false
image:
  alpineUtils: ghcr.io/hyperledger/bevel-alpine:latest
  ca: ghcr.io/hyperledger/bevel-fabric-ca:latest
  pullSecret:
server:
  removeCertsOnDelete: true
  tlsStatus: true
  adminUsername: ${CA_ADMIN}
  adminPassword: ${CA_PASS}
  subject: "/C=IN/ST=Gujarat/L=Ahmedabad/O=${ORG_DISPLAY}/CN=${ORG_SHORT}-ca"
  configPath: ""
  nodePort:
  clusterIpPort: 7054
labels:
  service: []
  pvc: []
  deployment: []
EOF

    # Generate Peer values file
    cat > "${BEVEL_VALUES_DIR}/${ORG_SHORT}-peer.yaml" <<EOF
global:
  version: 2.5.4
  serviceAccountName: bevel-auth
  cluster:
    provider: minikube
    cloudNativeServices: false
  vault:
    type: kubernetes
    role: vault-role
    address: ""
    authPath: ${ORG_SHORT}
    secretEngine: secretsv2
    secretPrefix: "data/${ORG_SHORT}"
    tls: false
  proxy:
    provider: none
    externalUrlSuffix: cve.local
    port: 443
storage:
  enabled: true
  peer: 512Mi
  couchdb: 512Mi
  reclaimPolicy: Delete
  volumeBindingMode: Immediate
  allowedTopologies:
    enabled: false
certs:
  generateCertificates: false
  orgData:
    caAddress: ca-${ORG_SHORT}.${ORG_NS}:7054
    caAdminUser: ${CA_ADMIN}
    caAdminPassword: ${CA_PASS}
    orgName: ${ORG_SHORT}
    type: peer
    componentSubject: "O=${ORG_DISPLAY},L=Ahmedabad,C=IN"
  settings:
    createConfigMaps: true
    refreshCertValue: false
    addPeerValue: false
    removeCertsOnDelete: false
    removeOrdererTlsOnDelete: false
image:
  couchdb: couchdb:3.3
  peer: ghcr.io/hyperledger/bevel-fabric-peer
  alpineUtils: ghcr.io/hyperledger/bevel-alpine:latest
  pullSecret:
peer:
  gossipPeerAddress: ${PEER_NAME}.${ORG_NS}:${PEER_PORT}
  logLevel: info
  localMspId: ${MSP_ID}
  tlsStatus: true
  cliEnabled: false
  ordererAddress: orderer0.orderer-ns:7050
  builder: hyperledger/fabric-ccenv
  couchdb:
    username: ${COUCHDB_USER}
    password: ${COUCHDB_PASS}
  mspConfig:
    organizationalUnitIdentifiers:
    nodeOUs:
      clientOUIdentifier: client
      peerOUIdentifier: peer
      adminOUIdentifier: admin
      ordererOUIdentifier: orderer
  serviceType: NodePort
  loadBalancerType: ""
  ports:
    grpc:
      nodePort: ${NP_GRPC}
      clusterIpPort: ${PEER_PORT}
    events:
      nodePort: ${NP_EVENTS}
      clusterIpPort: $((PEER_PORT + 2))
    couchdb:
      nodePort: ${NP_COUCHDB}
      clusterIpPort: 5984
    metrics:
      enabled: false
      clusterIpPort: 9443
  resources:
    limits:
      memory: 1Gi
      cpu: 1
    requests:
      memory: 512M
      cpu: 0.25
  upgrade: false
  healthCheck:
    retries: 20
    sleepTimeAfterError: 15
labels:
  service: []
  pvc: []
  deployment: []
EOF

    info "Deploying CA..."
    helm upgrade --install ca-${ORG_SHORT} "${BEVEL_CHARTS_DIR}/fabric-ca-server" \
        -n ${ORG_NS} -f "${BEVEL_VALUES_DIR}/${ORG_SHORT}-ca.yaml" \
        --wait --timeout 3m 2>&1 || warn "CA timed out"

    info "Deploying Peer..."
    helm upgrade --install ${PEER_NAME} "${BEVEL_CHARTS_DIR}/fabric-peernode" \
        -n ${ORG_NS} -f "${BEVEL_VALUES_DIR}/${ORG_SHORT}-peer.yaml" \
        --wait --timeout 5m 2>&1 || warn "Peer timed out"

    info "Waiting for peer pod..."
    local ELAPSED=0
    while [ $ELAPSED -lt 180 ]; do
        local POD=$(kubectl get pods -n ${ORG_NS} -l "app.kubernetes.io/release=${PEER_NAME}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [ -n "$POD" ]; then
            local READY=$(kubectl get pod ${POD} -n ${ORG_NS} -o jsonpath='{.status.phase}' 2>/dev/null)
            [ "$READY" = "Running" ] && { info "  ✓ Peer pod running"; return 0; }
        fi
        sleep 10; ELAPSED=$((ELAPSED + 10))
        echo -ne "\r  Waiting... ${ELAPSED}s"
    done
    echo ""; warn "Peer may not be fully ready"
}

# ==================== STEP 4: COREDNS ====================
step4_patch_coredns() {
    header "Step 4: Patch CoreDNS"

    local COREFILE=$(kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}')
    if echo "$COREFILE" | grep -q "peer0.${ORG_DOMAIN}"; then
        info "CoreDNS already patched for ${ORG_DOMAIN}"
        return 0
    fi

    local REWRITE="rewrite name peer0.${ORG_DOMAIN} ${PEER_NAME}.${ORG_NS}.svc.cluster.local"
    kubectl get configmap coredns -n kube-system -o json | \
        python3 -c "
import json, sys
data = json.load(sys.stdin)
cf = data['data']['Corefile']
cf = cf.replace('kubernetes cluster.local', '${REWRITE}\n        kubernetes cluster.local')
data['data']['Corefile'] = cf
json.dump(data, sys.stdout)
" | kubectl replace -f -

    kubectl rollout restart deployment coredns -n kube-system
    sleep 5
    info "  ✓ CoreDNS patched"
}

# ==================== STEP 5: DEPLOY CLI + CHANNEL CONFIG UPDATE ====================
step5_channel_update() {
    header "Step 5: Channel Config Update & Join"

    # Deploy CLI pod for new org
    kubectl delete pod fabric-cli -n ${ORG_NS} --ignore-not-found=true 2>/dev/null; sleep 2

    cat <<CLIPOD | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: fabric-cli
  namespace: ${ORG_NS}
spec:
  serviceAccountName: bevel-auth
  restartPolicy: Never
  initContainers:
  - name: msp-init
    image: ghcr.io/hyperledger/bevel-alpine:latest
    imagePullPolicy: IfNotPresent
    command: ["sh", "-c"]
    args:
    - |
      set -e
      SECRET=\$(kubectl get secret admin-${ORG_SHORT}-msp -n ${ORG_NS} -o json)
      mkdir -p /crypto/msp/admincerts /crypto/msp/cacerts /crypto/msp/keystore /crypto/msp/signcerts /crypto/msp/tlscacerts
      echo "\$SECRET" | jq -r '.data.admincerts' | base64 -d > /crypto/msp/admincerts/admin.crt
      echo "\$SECRET" | jq -r '.data.cacerts' | base64 -d > /crypto/msp/cacerts/ca.crt
      echo "\$SECRET" | jq -r '.data.keystore' | base64 -d > /crypto/msp/keystore/server.key
      echo "\$SECRET" | jq -r '.data.signcerts' | base64 -d > /crypto/msp/signcerts/server.crt
      echo "\$SECRET" | jq -r '.data.tlscacerts' | base64 -d > /crypto/msp/tlscacerts/tlsca.crt
      printf 'NodeOUs:\n  Enable: true\n  ClientOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: client\n  PeerOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: peer\n  AdminOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: admin\n  OrdererOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: orderer\n' > /crypto/msp/config.yaml
      OSECRET=\$(kubectl get secret orderer-tls-rootcert -n ${ORG_NS} -o json)
      mkdir -p /crypto/orderer-tls
      echo "\$OSECRET" | jq -r '.data.cacrt' | base64 -d > /crypto/orderer-tls/ca.crt
      ASECRET=\$(kubectl get secret orderer-admin-tls -n ${ORG_NS} -o json)
      mkdir -p /crypto/orderer-admin-tls
      echo "\$ASECRET" | jq -r '.data["ca.crt"]' | base64 -d > /crypto/orderer-admin-tls/ca.crt
      echo "\$ASECRET" | jq -r '.data["client.crt"]' | base64 -d > /crypto/orderer-admin-tls/client.crt
      echo "\$ASECRET" | jq -r '.data["client.key"]' | base64 -d > /crypto/orderer-admin-tls/client.key
    volumeMounts:
    - name: crypto
      mountPath: /crypto
  containers:
  - name: cli
    image: ghcr.io/hyperledger/bevel-fabric-tools:2.5.4
    imagePullPolicy: IfNotPresent
    command: ["sleep", "7200"]
    env:
    - name: CORE_PEER_ADDRESS
      value: "${PEER_ADDR}"
    - name: CORE_PEER_LOCALMSPID
      value: "${MSP_ID}"
    - name: CORE_PEER_MSPCONFIGPATH
      value: "/crypto/msp"
    - name: CORE_PEER_TLS_ENABLED
      value: "true"
    - name: CORE_PEER_TLS_ROOTCERT_FILE
      value: "/crypto/msp/tlscacerts/tlsca.crt"
    - name: ORDERER_CA
      value: "/crypto/orderer-tls/ca.crt"
    volumeMounts:
    - name: crypto
      mountPath: /crypto
  volumes:
  - name: crypto
    emptyDir:
      medium: Memory
CLIPOD

    kubectl wait --for=condition=Ready pod/fabric-cli -n ${ORG_NS} --timeout=120s || warn "CLI pod slow to start"

    # --- Generate org definition JSON using configtxgen ---
    local ORG_MSP_DIR="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/msp"

    cat > "/tmp/configtx.yaml" <<TXEOF
Organizations:
  - &${ORG_DISPLAY}
    Name: ${MSP_ID}
    ID: ${MSP_ID}
    MSPDir: ${ORG_MSP_DIR}
    Policies:
      Readers:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin', '${MSP_ID}.peer', '${MSP_ID}.client')"
      Writers:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin', '${MSP_ID}.client')"
      Admins:
        Type: Signature
        Rule: "OR('${MSP_ID}.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('${MSP_ID}.peer')"
    AnchorPeers:
      - Host: peer0.${ORG_DOMAIN}
        Port: ${PEER_PORT}
TXEOF

    FABRIC_CFG_PATH="/tmp" configtxgen -printOrg ${MSP_ID} > "/tmp/${ORG_SHORT}-org-def.json" 2>/dev/null
    [ -s "/tmp/${ORG_SHORT}-org-def.json" ] || err "Failed to generate org definition JSON"
    info "  ✓ Org definition JSON generated"

    # --- Update each channel ---
    for channel in cvepublic cveconsortium; do
        info "--- Updating ${channel} ---"

        # Copy org def to cna-alpha CLI
        kubectl cp "/tmp/${ORG_SHORT}-org-def.json" "cna-alpha-ns/fabric-cli:/tmp/${ORG_SHORT}-org-def.json"

        # Fetch current config
        kubectl exec fabric-cli -n cna-alpha-ns -- peer channel fetch config \
            /tmp/config_block.pb -c ${channel} \
            -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt 2>&1

        # Decode → extract config → add org → encode → compute delta → wrap envelope
        kubectl exec fabric-cli -n cna-alpha-ns -- sh -c "
            configtxlator proto_decode --input /tmp/config_block.pb --type common.Block --output /tmp/block.json && \
            jq '.data.data[0].payload.data.config' /tmp/block.json > /tmp/config.json && \
            jq --slurpfile org /tmp/${ORG_SHORT}-org-def.json \
                '.channel_group.groups.Application.groups.${MSP_ID} = \$org[0]' \
                /tmp/config.json > /tmp/modified_config.json && \
            configtxlator proto_encode --input /tmp/config.json --type common.Config --output /tmp/config.pb && \
            configtxlator proto_encode --input /tmp/modified_config.json --type common.Config --output /tmp/modified_config.pb && \
            configtxlator compute_update --channel_id ${channel} --original /tmp/config.pb --updated /tmp/modified_config.pb --output /tmp/update.pb && \
            configtxlator proto_decode --input /tmp/update.pb --type common.ConfigUpdate --output /tmp/update.json && \
            echo '{\"payload\":{\"header\":{\"channel_header\":{\"channel_id\":\"${channel}\",\"type\":2}},\"data\":{\"config_update\":' > /tmp/env_prefix.txt && \
            echo '}}}' > /tmp/env_suffix.txt && \
            cat /tmp/env_prefix.txt /tmp/update.json /tmp/env_suffix.txt | jq -c '.' > /tmp/envelope.json && \
            configtxlator proto_encode --input /tmp/envelope.json --type common.Envelope --output /tmp/envelope.pb
        " 2>&1

        # Sign with cna-alpha
        kubectl exec fabric-cli -n cna-alpha-ns -- peer channel signconfigtx -f /tmp/envelope.pb 2>&1

        # Copy to cna-beta via stdin, use unique filename to avoid stale permission issues
        kubectl exec fabric-cli -n cna-alpha-ns -- cat /tmp/envelope.pb | \
            kubectl exec -i fabric-cli -n cna-beta-ns -- sh -c "rm -f /tmp/env_${channel}.pb; cat > /tmp/env_${channel}.pb" 2>&1
        kubectl exec fabric-cli -n cna-beta-ns -- peer channel signconfigtx -f /tmp/env_${channel}.pb 2>&1

        # Copy to regulator via stdin and submit
        kubectl exec fabric-cli -n cna-beta-ns -- cat /tmp/env_${channel}.pb | \
            kubectl exec -i fabric-cli -n regulator-ns -- sh -c "rm -f /tmp/env_${channel}.pb; cat > /tmp/env_${channel}.pb" 2>&1
        kubectl exec fabric-cli -n regulator-ns -- peer channel update \
            -f /tmp/env_${channel}.pb -c ${channel} \
            -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt 2>&1

        info "  ✓ ${MSP_ID} added to ${channel}"
    done

    # --- Join new peer to channels ---
    info "--- Joining ${PEER_NAME} to channels ---"
    sleep 5  # let config propagate

    for channel in cvepublic cveconsortium; do
        local RETRIES=3
        for i in $(seq 1 $RETRIES); do
            kubectl exec fabric-cli -n ${ORG_NS} -- sh -c "
                peer channel fetch oldest /tmp/${channel}.block -c ${channel} \
                    -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt && \
                peer channel join -b /tmp/${channel}.block
            " 2>&1 && break
            warn "Retry $i/$RETRIES for ${channel}..."
            sleep 10
        done
        info "  ✓ ${PEER_NAME} joined ${channel}"
    done
}

# ==================== STEP 6: CHAINCODE ====================
step6_chaincode() {
    header "Step 6: Install & Approve Chaincode"

    # Get current committed version on each channel
    local PUB_INFO=$(kubectl exec fabric-cli -n cna-alpha-ns -- \
        peer lifecycle chaincode querycommitted -C cvepublic --name cve-chaincode 2>&1)
    local PUB_SEQ=$(echo "$PUB_INFO" | grep -oP 'Sequence: \K[0-9]+')
    local PUB_VER=$(echo "$PUB_INFO" | grep -oP 'Version: \K[0-9]+')

    local CON_INFO=$(kubectl exec fabric-cli -n cna-alpha-ns -- \
        peer lifecycle chaincode querycommitted -C cveconsortium --name cve-chaincode 2>&1)
    local CON_SEQ=$(echo "$CON_INFO" | grep -oP 'Sequence: \K[0-9]+')
    local CON_VER=$(echo "$CON_INFO" | grep -oP 'Version: \K[0-9]+')

    info "cvepublic:     v${PUB_VER} seq${PUB_SEQ}"
    info "cveconsortium: v${CON_VER} seq${CON_SEQ}"

    # Find the latest installed package on cna-alpha
    local LATEST_PKG=$(kubectl exec fabric-cli -n cna-alpha-ns -- \
        peer lifecycle chaincode queryinstalled 2>&1 | \
        grep -oP "cve-chaincode_${PUB_VER}:[a-f0-9]+" | tail -1)

    # Package chaincode from source (most reliable method)
    info "Packaging chaincode from source..."
    cd "${CHAINCODE_DIR}"
    GO111MODULE=on go mod vendor 2>/dev/null || true
    FABRIC_CFG_PATH="${FABRIC_DIR}/config" peer lifecycle chaincode package \
        /tmp/cve-cc-install.tar.gz --path . --lang golang --label "cve-chaincode_${PUB_VER}" 2>&1

    # Copy to new org's CLI pod via stdin (avoids kubectl cp permission issues)
    cat /tmp/cve-cc-install.tar.gz | \
        kubectl exec -i fabric-cli -n ${ORG_NS} -- sh -c 'cat > /tmp/cve-chaincode.tar.gz'

    # Install on new org's peer
    local INSTALL_OUT=$(kubectl exec fabric-cli -n ${ORG_NS} -- \
        peer lifecycle chaincode install /tmp/cve-chaincode.tar.gz 2>&1)
    echo "$INSTALL_OUT"

    local INSTALLED_PKG=$(echo "$INSTALL_OUT" | grep -oP "cve-chaincode_${PUB_VER}:[a-f0-9]+" | head -1)
    [ -z "$INSTALLED_PKG" ] && INSTALLED_PKG="$LATEST_PKG"
    info "Installed package: ${INSTALLED_PKG}"

    # Approve on cvepublic
    info "Approving on cvepublic (v${PUB_VER}, seq${PUB_SEQ})..."
    kubectl exec fabric-cli -n ${ORG_NS} -- peer lifecycle chaincode approveformyorg \
        --channelID cvepublic --name cve-chaincode --version ${PUB_VER} \
        --package-id "${INSTALLED_PKG}" --sequence ${PUB_SEQ} \
        -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt 2>&1
    info "  ✓ Approved on cvepublic"

    # Approve on cveconsortium
    info "Approving on cveconsortium (v${CON_VER}, seq${CON_SEQ})..."
    kubectl exec fabric-cli -n ${ORG_NS} -- peer lifecycle chaincode approveformyorg \
        --channelID cveconsortium --name cve-chaincode --version ${CON_VER} \
        --package-id "${INSTALLED_PKG}" --sequence ${CON_SEQ} \
        -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt 2>&1
    info "  ✓ Approved on cveconsortium"
}

# ==================== STEP 7: EXTRACT WALLET ====================
step7_extract_wallet() {
    header "Step 7: Extract Wallet Certs"

    local WALLET_DIR="${PROJECT_ROOT}/backend/wallet"
    mkdir -p "${WALLET_DIR}"
    local PREFIX="${WALLET_DIR}/${ORG_SHORT}"

    kubectl get secret admin-${ORG_SHORT}-msp -n ${ORG_NS} \
        -o jsonpath='{.data.signcerts}' | base64 -d > "${PREFIX}-cert.pem"
    kubectl get secret admin-${ORG_SHORT}-msp -n ${ORG_NS} \
        -o jsonpath='{.data.keystore}' | base64 -d > "${PREFIX}-key.pem"

    # TLS CA — try from peer pod first, fall back to secret
    local PEER_POD=$(kubectl get pods -n ${ORG_NS} -l "app.kubernetes.io/release=${PEER_NAME}" \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -n "$PEER_POD" ]; then
        kubectl exec ${PEER_POD} -n ${ORG_NS} -c ${PEER_NAME} -- \
            cat /etc/hyperledger/fabric/crypto/tls/ca.crt > "${PREFIX}-tlsca.pem" 2>/dev/null || \
        kubectl get secret ${PEER_NAME}-tls -n ${ORG_NS} \
            -o jsonpath='{.data.cacrt}' | base64 -d > "${PREFIX}-tlsca.pem"
    else
        kubectl get secret ${PEER_NAME}-tls -n ${ORG_NS} \
            -o jsonpath='{.data.cacrt}' | base64 -d > "${PREFIX}-tlsca.pem"
    fi

    info "  ✓ Wallet: ${PREFIX}-{cert,key,tlsca}.pem"

    # Copy TLS CA to existing CLI pods for cross-org endorsement
    local TLS_CA=$(cat "${PREFIX}-tlsca.pem")
    for ns in cna-alpha-ns cna-beta-ns regulator-ns; do
        echo "${TLS_CA}" | kubectl exec -i fabric-cli -n ${ns} -- sh -c "cat > /tmp/${ORG_SHORT}-tls-ca.crt" 2>/dev/null || true
    done
}

# ==================== STEP 8: PORT FORWARD + API CONFIG ====================
step8_setup_access() {
    header "Step 8: Setup Access"

    # Start port-forward
    kubectl port-forward svc/${PEER_NAME} -n ${ORG_NS} ${PEER_PORT}:${PEER_PORT} &>/dev/null &
    info "  ✓ Port-forward: localhost:${PEER_PORT} → ${PEER_NAME}:${PEER_PORT}"

    # Auto-register org config for backend
    local ORG_CONFIG_DIR="${PROJECT_ROOT}/backend/wallet"
    cat > "${ORG_CONFIG_DIR}/${ORG_SHORT}-config.json" <<ORGCFG
{
  "mspId": "${MSP_ID}",
  "orgShort": "${ORG_SHORT}",
  "cert": "${ORG_SHORT}-cert.pem",
  "key": "${ORG_SHORT}-key.pem",
  "tlsCa": "${ORG_SHORT}-tlsca.pem",
  "peerEndpoint": "localhost:${PEER_PORT}",
  "peerHostAlias": "peer0.${ORG_DOMAIN}",
  "peerPort": ${PEER_PORT},
  "caHost": "ca.${ORG_NS}",
  "caAdmin": "${CA_ADMIN}",
  "caPassword": "${CA_PASS}"
}
ORGCFG
    info "  ✓ Org config: ${ORG_CONFIG_DIR}/${ORG_SHORT}-config.json"

    echo ""
    info "Add this to orgCrypto in backend/src/services/fabricService.js:"
    echo ""
    echo "  ${MSP_ID}: {"
    echo "    cert: path.join(WALLET_DIR, '${ORG_SHORT}-cert.pem'),"
    echo "    key: path.join(WALLET_DIR, '${ORG_SHORT}-key.pem'),"
    echo "    tlsCa: path.join(WALLET_DIR, '${ORG_SHORT}-tlsca.pem'),"
    echo "    peerEndpoint: 'localhost:${PEER_PORT}',"
    echo "    peerHostAlias: 'peer0.${ORG_DOMAIN}',"
    echo "  },"
    echo ""
}

# ==================== STEP 9: ACTIVATE ORG ON LEDGER ====================
step9_activate_ledger() {
    header "Step 9: Activate Org on Ledger"

    kubectl exec fabric-cli -n cna-alpha-ns -- peer chaincode invoke \
        -C cveconsortium -n cve-chaincode \
        -c "{\"function\":\"governance:ActivateOrg\",\"Args\":[\"${MSP_ID}\"]}" \
        -o orderer0.orderer.cve.local:7050 --tls --cafile /crypto/orderer-tls/ca.crt \
        --peerAddresses peer0-cna-alpha.cna-alpha-ns:7051 \
        --tlsRootCertFiles /crypto/msp/tlscacerts/tlsca.crt \
        --peerAddresses peer0-cna-beta.cna-beta-ns:9051 \
        --tlsRootCertFiles /tmp/cna-beta-tls-ca.crt \
        --peerAddresses peer0-regulator.regulator-ns:11051 \
        --tlsRootCertFiles /tmp/regulator-tls-ca.crt 2>&1

    info "  ✓ ${MSP_ID} activated on ledger"
}

# ==================== MAIN ====================
main() {
    header "Dynamic Org Onboarding: ${ORG_SHORT} (${MSP_ID})"

    step1_generate_crypto
    step2_store_secrets
    step3_deploy_ca_peer
    step4_patch_coredns
    step5_channel_update
    step6_chaincode
    step7_extract_wallet
    step8_setup_access
    step9_activate_ledger

    header "SUCCESS: ${MSP_ID} Onboarded!"
    echo ""
    info "MSP ID:     ${MSP_ID}"
    info "Namespace:  ${ORG_NS}"
    info "Peer:       ${PEER_NAME} (port ${PEER_PORT})"
    info "Channels:   cvepublic, cveconsortium"
    info "Chaincode:  Installed & approved"
    info "Wallet:     backend/wallet/${ORG_SHORT}-{cert,key,tlsca}.pem"
    info "Ledger:     ACTIVE"
    echo ""
    info "Next: Add the org config to fabricService.js (printed above) and restart API"
}

main
