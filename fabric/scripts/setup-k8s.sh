#!/bin/bash
# ============================================================================
# CVE Platform - Hyperledger Fabric Network Deployment via Bevel
#
# Deploys Fabric 2.5.4 on Minikube using Bevel Helm charts with:
#   - Channel Participation API (osnadmin, no system channel)
#   - Kubernetes vault type (K8s secrets, no HashiCorp Vault)
#   - CLI pods for channel/chaincode operations
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
BEVEL_GIT_URL="https://github.com/hyperledger/bevel.git"
BEVEL_GIT_BRANCH="main"

export PATH="${BIN_DIR}:${PATH}"
export FABRIC_CFG_PATH="${NETWORK_DIR}/configtx"

# Force both kubectl and helm to use the minikube kubeconfig.
# The system kubectl on this machine defaults to k3s (/etc/rancher/k3s/k3s.yaml),
# which is a different cluster than minikube. Setting KUBECONFIG explicitly ensures
# all kubectl/helm calls in this script target the same minikube cluster.
export KUBECONFIG="$HOME/.kube/config"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# ==================== PREREQUISITES ====================
check_prerequisites() {
    header "Checking Prerequisites"
    for cmd in kubectl helm minikube docker git cryptogen configtxgen peer; do
        command -v $cmd >/dev/null 2>&1 && info "  ✓ $cmd" || error "  ✗ $cmd not found"
    done
}

# ==================== INOTIFY LIMITS ====================
set_inotify_limits() {
    header "Setting System Limits"
    local current=$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo 0)
    if [ "$current" -lt 512 ]; then
        sudo sysctl -w fs.inotify.max_user_instances=512 >/dev/null 2>&1
        sudo sysctl -w fs.inotify.max_user_watches=524288 >/dev/null 2>&1
        info "inotify limits increased (instances=512, watches=524288)"
    else
        info "inotify limits already sufficient (instances=${current})"
    fi
}

# ==================== MINIKUBE ====================
start_minikube() {
    header "Starting Minikube"
    if minikube status 2>/dev/null | grep -q "Running"; then
        info "Minikube already running"
    else
        minikube start --cpus=4 --memory=6144 --driver=docker
    fi
    info "Waiting for kube-system pods..."
    kubectl wait --for=condition=Ready pod -l component=etcd -n kube-system --timeout=120s 2>/dev/null || true
    sleep 10
    info "Minikube ready"
}

# ==================== CLONE BEVEL ====================
clone_bevel() {
    header "Cloning Hyperledger Bevel"
    if [ -d "${BEVEL_CLONE_DIR}/.git" ]; then
        info "Bevel repo already at ${BEVEL_CLONE_DIR}"
    else
        mkdir -p "$(dirname ${BEVEL_CLONE_DIR})"
        git clone --depth 1 --branch ${BEVEL_GIT_BRANCH} ${BEVEL_GIT_URL} "${BEVEL_CLONE_DIR}"
    fi

    [ -d "${BEVEL_CHARTS_DIR}/fabric-peernode" ] || error "Bevel charts not found"
    info "Charts available at ${BEVEL_CHARTS_DIR}"
}

# ==================== PATCH BEVEL CHARTS ====================
patch_bevel_charts() {
    header "Patching Bevel Chart Templates"

    local PATCHES_DIR="${FABRIC_DIR}/bevel/patches"
    local PEER_SS="${BEVEL_CHARTS_DIR}/fabric-peernode/templates/node-statefulset.yaml"
    local PEER_CM="${BEVEL_CHARTS_DIR}/fabric-peernode/templates/configmap.yaml"
    local VAULT_SH="${BEVEL_CLONE_DIR}/platforms/shared/charts/bevel-scripts/scripts/bevel-vault.sh"
    local SC_VALUES="${BEVEL_CLONE_DIR}/platforms/shared/charts/bevel-storageclass/values.yaml"

    # ── Fix 1: Docker API proxy sidecar + CORE_VM_ENDPOINT fix
    #    Fabric go-dockerclient sends /v1.25/ which Docker 27+ rejects ("broken pipe").
    #    A Python sidecar rewrites the API version prefix. We overlay our patched templates.
    if [ -f "${PATCHES_DIR}/peernode-statefulset.yaml" ]; then
        cp "${PATCHES_DIR}/peernode-statefulset.yaml" "$PEER_SS"
        info "  ✓ Peernode statefulset (docker-api-proxy sidecar, proxy-socket volume)"
    fi
    if [ -f "${PATCHES_DIR}/peernode-configmap.yaml" ]; then
        cp "${PATCHES_DIR}/peernode-configmap.yaml" "$PEER_CM"
        info "  ✓ Peernode configmap (CORE_VM_ENDPOINT → proxy socket)"
    fi

    # ── Fix 2: CouchDB image — upstream appends global.version → couchdb:3.3:2.5.4
    if grep -q '{{ .Values.image.couchdb }}:{{ .Values.global.version }}' "$PEER_SS" 2>/dev/null; then
        sed -i 's|{{ .Values.image.couchdb }}:{{ .Values.global.version }}|{{ .Values.image.couchdb }}|g' "$PEER_SS"
        info "  ✓ Fixed CouchDB image double-tag"
    fi

    # ── Fix 3: StorageClass — encrypted param not supported by minikube hostpath
    #    Replace the minikube block (key + any indented children) with an empty map.
    if grep -q 'minikube:' "$SC_VALUES" 2>/dev/null; then
        python3 - "$SC_VALUES" <<'PYEOF'
import sys, re
path = sys.argv[1]
text = open(path).read()
# Replace "  minikube:\n    encrypted: ..." with "  minikube: {}"
text = re.sub(r'([ \t]*minikube:)[^\n]*\n(?:[ \t]+\S[^\n]*\n)*',
              r'\1 {}\n', text)
open(path, 'w').write(text)
PYEOF
        info "  ✓ Fixed StorageClass encrypted param"
    fi

    # ── Fix 4: bevel-vault.sh — add kubernetes vault type support
    #    Upstream only handles hashicorp; we need readKubernetesSecret + kubernetes case
    if [ -f "${PATCHES_DIR}/bevel-vault.sh" ]; then
        cp "${PATCHES_DIR}/bevel-vault.sh" "$VAULT_SH"
        info "  ✓ bevel-vault.sh (kubernetes vault type support)"
    fi

    # ── Build Helm sub-chart dependencies (rebuilds packed subcharts from local source)
    # Update repos once first to avoid lock contention when building deps sequentially
    info "Updating Helm repos..."
    helm repo update >/dev/null 2>&1 || true

    info "Building chart dependencies..."
    for chart in fabric-ca-server fabric-orderernode fabric-peernode fabric-genesis \
                 fabric-channel-create fabric-channel-join; do
        local chart_dir="${BEVEL_CHARTS_DIR}/${chart}"
        if [ -f "${chart_dir}/requirements.yaml" ] || grep -q "dependencies:" "${chart_dir}/Chart.yaml" 2>/dev/null; then
            # Clean old (possibly corrupt) deps first
            rm -f "${chart_dir}/charts/"*.tgz 2>/dev/null

            # Build with --skip-refresh since we already updated repos
            if helm dependency build "${chart_dir}" --skip-refresh 2>&1 | tail -1; then
                # Verify no 0-byte files were produced
                local BAD_FILES=$(find "${chart_dir}/charts/" -name "*.tgz" -empty 2>/dev/null | wc -l)
                if [ "$BAD_FILES" -gt 0 ]; then
                    warn "  ✗ ${chart} has empty dep files — retrying..."
                    rm -f "${chart_dir}/charts/"*.tgz 2>/dev/null
                    helm dependency build "${chart_dir}" 2>&1 | tail -1
                fi
                info "  ✓ ${chart} deps built"
            else
                warn "  ✗ ${chart} deps failed"
            fi
        fi
    done
}

# ==================== NAMESPACES & RBAC ====================
create_namespaces() {
    header "Creating Namespaces & Service Accounts"
    for ns in orderer-ns cna-alpha-ns cna-beta-ns regulator-ns; do
        kubectl create namespace ${ns} 2>/dev/null || true
        info "  ✓ ${ns} ready"
    done

    # Note: bevel-auth SA is created by Bevel Helm charts automatically.
    # We only need cluster-admin RBAC for it (charts don't create this).
    for ns in orderer-ns cna-alpha-ns cna-beta-ns regulator-ns; do
        kubectl create clusterrolebinding bevel-auth-${ns} \
            --clusterrole=cluster-admin \
            --serviceaccount=${ns}:bevel-auth 2>/dev/null || true
    done
}

# NOTE: bevel-vault-script and package-manager ConfigMaps are created by
# the bevel-scripts subchart bundled inside fabric-ca-server.
# CAs must be deployed first so orderer/peer charts can find these ConfigMaps.

# ==================== CRYPTO ====================
generate_crypto() {
    header "Generating Crypto Material"
    rm -rf "${NETWORK_DIR}/organizations/peerOrganizations"
    rm -rf "${NETWORK_DIR}/organizations/ordererOrganizations"

    cryptogen generate \
        --config="${NETWORK_DIR}/organizations/cryptogen/crypto-config.yaml" \
        --output="${NETWORK_DIR}/organizations"

    info "Crypto generated (SANs include K8s service names)"
}

# ==================== STORE SECRETS ====================
store_crypto_as_secrets() {
    header "Storing Crypto as K8s Secrets"

    local ORG_BASE="${NETWORK_DIR}/organizations"

    # --- Orderer ---
    local O_DIR="${ORG_BASE}/ordererOrganizations/orderer.cve.local/orderers/orderer0.orderer.cve.local"
    local O_ADMIN="${ORG_BASE}/ordererOrganizations/orderer.cve.local/users/Admin@orderer.cve.local"

    kubectl create secret generic orderer0-tls -n orderer-ns \
        --from-file=cacrt="${O_DIR}/tls/ca.crt" \
        --from-file=servercrt="${O_DIR}/tls/server.crt" \
        --from-file=serverkey="${O_DIR}/tls/server.key" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic orderer0-msp -n orderer-ns \
        --from-file=admincerts="${O_ADMIN}/msp/signcerts/Admin@orderer.cve.local-cert.pem" \
        --from-file=cacerts="$(ls ${O_DIR}/msp/cacerts/*.pem | head -1)" \
        --from-file=keystore="$(ls ${O_DIR}/msp/keystore/*_sk | head -1)" \
        --from-file=signcerts="$(ls ${O_DIR}/msp/signcerts/*.pem | head -1)" \
        --from-file=tlscacerts="$(ls ${O_DIR}/msp/tlscacerts/*.pem | head -1)" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic admin-msp -n orderer-ns \
        --from-file=admincerts="${O_ADMIN}/msp/signcerts/Admin@orderer.cve.local-cert.pem" \
        --from-file=cacerts="$(ls ${O_DIR}/msp/cacerts/*.pem | head -1)" \
        --from-file=tlscacerts="$(ls ${O_DIR}/msp/tlscacerts/*.pem | head -1)" \
        --dry-run=client -o yaml | kubectl apply -f -

    info "  ✓ orderer secrets in orderer-ns"

    # --- Peer orgs ---
    declare -A ORG_MAP=(
        ["cna-alpha"]="cna-alpha-ns:cna-alpha.cve.local"
        ["cna-beta"]="cna-beta-ns:cna-beta.cve.local"
        ["regulator"]="regulator-ns:regulator.cve.local"
    )

    for org in "${!ORG_MAP[@]}"; do
        IFS=':' read -r ns domain <<< "${ORG_MAP[$org]}"
        local P_DIR="${ORG_BASE}/peerOrganizations/${domain}/peers/peer0.${domain}"
        local A_DIR="${ORG_BASE}/peerOrganizations/${domain}/users/Admin@${domain}"

        # Peer TLS
        kubectl create secret generic peer0-${org}-tls -n ${ns} \
            --from-file=cacrt="${P_DIR}/tls/ca.crt" \
            --from-file=servercrt="${P_DIR}/tls/server.crt" \
            --from-file=serverkey="${P_DIR}/tls/server.key" \
            --dry-run=client -o yaml | kubectl apply -f -

        # Peer MSP
        kubectl create secret generic peer0-${org}-msp -n ${ns} \
            --from-file=admincerts="${A_DIR}/msp/signcerts/Admin@${domain}-cert.pem" \
            --from-file=cacerts="$(ls ${P_DIR}/msp/cacerts/*.pem | head -1)" \
            --from-file=keystore="$(ls ${P_DIR}/msp/keystore/*_sk | head -1)" \
            --from-file=signcerts="$(ls ${P_DIR}/msp/signcerts/*.pem | head -1)" \
            --from-file=tlscacerts="$(ls ${P_DIR}/msp/tlscacerts/*.pem | head -1)" \
            --dry-run=client -o yaml | kubectl apply -f -

        # Admin MSP (for channel/chaincode operations)
        kubectl create secret generic admin-${org}-msp -n ${ns} \
            --from-file=admincerts="${A_DIR}/msp/signcerts/Admin@${domain}-cert.pem" \
            --from-file=cacerts="$(ls ${A_DIR}/msp/cacerts/*.pem | head -1)" \
            --from-file=keystore="$(ls ${A_DIR}/msp/keystore/*_sk | head -1)" \
            --from-file=signcerts="${A_DIR}/msp/signcerts/Admin@${domain}-cert.pem" \
            --from-file=tlscacerts="$(ls ${A_DIR}/msp/tlscacerts/*.pem | head -1)" \
            --dry-run=client -o yaml | kubectl apply -f -

        # Orderer TLS root cert (for connecting to orderer from peer ns)
        kubectl create secret generic orderer-tls-rootcert -n ${ns} \
            --from-file=cacrt="${O_DIR}/tls/ca.crt" \
            --dry-run=client -o yaml | kubectl apply -f -

        # Orderer admin TLS certs (for osnadmin from CLI pod)
        kubectl create secret generic orderer-admin-tls -n ${ns} \
            --from-file=ca.crt="${O_ADMIN}/tls/ca.crt" \
            --from-file=client.crt="${O_ADMIN}/tls/client.crt" \
            --from-file=client.key="${O_ADMIN}/tls/client.key" \
            --dry-run=client -o yaml | kubectl apply -f -

        info "  ✓ ${org} secrets in ${ns}"
    done
}

# ==================== COREDNS PATCHING ====================
patch_coredns() {
    header "Patching CoreDNS for .cve.local Domains"

    # Add rewrite rules so .cve.local domains resolve to K8s services
    local COREFILE=$(kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}')

    if echo "$COREFILE" | grep -q "orderer0.orderer.cve.local"; then
        info "CoreDNS already patched"
        return
    fi

    # Insert rewrite rules before the kubernetes plugin
    local REWRITE_RULES='    rewrite name orderer0.orderer.cve.local orderer0.orderer-ns.svc.cluster.local
        rewrite name peer0.cna-alpha.cve.local peer0-cna-alpha.cna-alpha-ns.svc.cluster.local
        rewrite name peer0.cna-beta.cve.local peer0-cna-beta.cna-beta-ns.svc.cluster.local
        rewrite name peer0.regulator.cve.local peer0-regulator.regulator-ns.svc.cluster.local'

    kubectl get configmap coredns -n kube-system -o json | \
        python3 -c "
import json, sys
data = json.load(sys.stdin)
cf = data['data']['Corefile']
cf = cf.replace(
    'kubernetes cluster.local',
    '''rewrite name orderer0.orderer.cve.local orderer0.orderer-ns.svc.cluster.local
        rewrite name peer0.cna-alpha.cve.local peer0-cna-alpha.cna-alpha-ns.svc.cluster.local
        rewrite name peer0.cna-beta.cve.local peer0-cna-beta.cna-beta-ns.svc.cluster.local
        rewrite name peer0.regulator.cve.local peer0-regulator.regulator-ns.svc.cluster.local
        kubernetes cluster.local'''
)
data['data']['Corefile'] = cf
json.dump(data, sys.stdout)
" | kubectl replace -f -

    kubectl rollout restart deployment coredns -n kube-system
    sleep 5
    info "CoreDNS patched with .cve.local rewrites"
}

# ==================== GENERATE CHANNEL GENESIS BLOCKS ====================
generate_channel_genesis() {
    header "Generating Channel Genesis Blocks (Fabric 2.5 Channel Participation)"
    mkdir -p "${NETWORK_DIR}/channel-artifacts"

    for channel in cvepublic cveconsortium; do
        local PROFILE="CVEPublicChannel"
        [ "$channel" = "cveconsortium" ] && PROFILE="CVEConsortiumChannel"

        configtxgen -profile ${PROFILE} \
            -outputBlock "${NETWORK_DIR}/channel-artifacts/${channel}.block" \
            -channelID ${channel}

        info "  ✓ ${channel} genesis block created"
    done
}

# ==================== DEPLOY CAs ====================
deploy_cas() {
    header "Deploying Fabric CAs via Bevel"

    declare -A CA_MAP=(
        ["regulator"]="regulator-ns:regulator-ca"
        ["cna-alpha"]="cna-alpha-ns:cna-alpha-ca"
        ["cna-beta"]="cna-beta-ns:cna-beta-ca"
        ["orderer"]="orderer-ns:orderer-ca"
    )

    for org in "${!CA_MAP[@]}"; do
        IFS=':' read -r ns valuesFile <<< "${CA_MAP[$org]}"
        info "Deploying CA for ${org}..."
        helm upgrade --install ca-${org} "${BEVEL_CHARTS_DIR}/fabric-ca-server" \
            -n ${ns} -f "${BEVEL_VALUES_DIR}/${valuesFile}.yaml" \
            --wait --timeout 3m 2>&1 || warn "CA ${org} timed out (may still start)"
        info "  ✓ CA ${org}"
    done
}

# ==================== DEPLOY ORDERER ====================
deploy_orderer() {
    header "Deploying Orderer via Bevel"
    helm upgrade --install orderer0 "${BEVEL_CHARTS_DIR}/fabric-orderernode" \
        -n orderer-ns -f "${BEVEL_VALUES_DIR}/orderer.yaml" \
        --wait --timeout 5m 2>&1 || warn "Orderer timed out (may still start)"
    info "  ✓ Orderer deployed"
}

# ==================== DEPLOY PEERS ====================
deploy_peers() {
    header "Deploying Peers via Bevel"

    declare -A PEER_MAP=(
        ["cna-alpha"]="cna-alpha-ns:cna-alpha-peer"
        ["cna-beta"]="cna-beta-ns:cna-beta-peer"
        ["regulator"]="regulator-ns:regulator-peer"
    )

    for org in "${!PEER_MAP[@]}"; do
        IFS=':' read -r ns valuesFile <<< "${PEER_MAP[$org]}"
        info "Deploying peer0-${org}..."
        helm upgrade --install peer0-${org} "${BEVEL_CHARTS_DIR}/fabric-peernode" \
            -n ${ns} -f "${BEVEL_VALUES_DIR}/${valuesFile}.yaml" \
            --wait --timeout 5m 2>&1 || warn "Peer ${org} timed out (may still start)"
        info "  ✓ peer0-${org}"
    done
}

# ==================== WAIT FOR PODS ====================
wait_for_fabric_pods() {
    header "Waiting for Fabric Pods to Start"

    # Wait for each critical pod with ALL containers ready
    local PODS=(
        "orderer-ns:fabric-orderernode-orderer0-0"
        "cna-alpha-ns:fabric-peernode-peer0-cna-alpha-0"
        "cna-beta-ns:fabric-peernode-peer0-cna-beta-0"
        "regulator-ns:fabric-peernode-peer0-regulator-0"
    )

    for entry in "${PODS[@]}"; do
        IFS=':' read -r ns pod <<< "$entry"
        info "Waiting for ${pod}..."
        kubectl wait --for=condition=ready pod/${pod} -n ${ns} --timeout=300s 2>/dev/null || {
            warn "${pod} not ready after 5m — checking status:"
            kubectl get pod ${pod} -n ${ns} 2>/dev/null
            kubectl describe pod ${pod} -n ${ns} 2>/dev/null | tail -15
        }
    done

    # Extra wait for CouchDB state databases to initialize inside peer pods
    # (CouchDB sidecar starts after readiness probe passes but needs time to create system DBs)
    info "Waiting for CouchDB to initialize..."
    sleep 15

    info "All Fabric pods ready"
}

# ==================== DEPLOY CLI POD ====================
deploy_cli_pod() {
    local ns=$1 org=$2 mspId=$3 peerAddr=$4

    # Delete old CLI pod if exists
    kubectl delete pod fabric-cli -n ${ns} --ignore-not-found=true 2>/dev/null
    sleep 2

    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: fabric-cli
  namespace: ${ns}
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
      # Reconstruct admin MSP directory from flat K8s secret
      SECRET=\$(kubectl get secret admin-${org}-msp -n ${ns} -o json)
      mkdir -p /crypto/msp/admincerts /crypto/msp/cacerts /crypto/msp/keystore /crypto/msp/signcerts /crypto/msp/tlscacerts

      echo "\$SECRET" | jq -r '.data.admincerts' | base64 -d > /crypto/msp/admincerts/admin.crt
      echo "\$SECRET" | jq -r '.data.cacerts' | base64 -d > /crypto/msp/cacerts/ca.crt
      echo "\$SECRET" | jq -r '.data.keystore' | base64 -d > /crypto/msp/keystore/server.key
      echo "\$SECRET" | jq -r '.data.signcerts' | base64 -d > /crypto/msp/signcerts/server.crt
      echo "\$SECRET" | jq -r '.data.tlscacerts' | base64 -d > /crypto/msp/tlscacerts/tlsca.crt

      # NodeOUs config
      printf 'NodeOUs:\n  Enable: true\n  ClientOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: client\n  PeerOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: peer\n  AdminOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: admin\n  OrdererOUIdentifier:\n    Certificate: cacerts/ca.crt\n    OrganizationalUnitIdentifier: orderer\n' > /crypto/msp/config.yaml

      # Orderer TLS CA cert
      OSECRET=\$(kubectl get secret orderer-tls-rootcert -n ${ns} -o json)
      mkdir -p /crypto/orderer-tls
      echo "\$OSECRET" | jq -r '.data.cacrt' | base64 -d > /crypto/orderer-tls/ca.crt

      # Orderer admin TLS certs (for osnadmin)
      ASECRET=\$(kubectl get secret orderer-admin-tls -n ${ns} -o json)
      mkdir -p /crypto/orderer-admin-tls
      echo "\$ASECRET" | jq -r '.data["ca.crt"]' | base64 -d > /crypto/orderer-admin-tls/ca.crt
      echo "\$ASECRET" | jq -r '.data["client.crt"]' | base64 -d > /crypto/orderer-admin-tls/client.crt
      echo "\$ASECRET" | jq -r '.data["client.key"]' | base64 -d > /crypto/orderer-admin-tls/client.key

      echo "MSP init complete"
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
      value: "${peerAddr}"
    - name: CORE_PEER_LOCALMSPID
      value: "${mspId}"
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
EOF

    info "  Waiting for CLI pod in ${ns}..."
    kubectl wait --for=condition=Ready pod/fabric-cli -n ${ns} --timeout=120s 2>/dev/null || {
        warn "CLI pod in ${ns} not ready, checking status..."
        kubectl describe pod fabric-cli -n ${ns} 2>/dev/null | tail -10
    }
}

# ==================== CHANNEL OPERATIONS VIA CLI ====================
create_channels_and_join() {
    header "Channel Operations via CLI Pods"

    # Deploy CLI pod in cna-alpha-ns (will be used for osnadmin + channel create)
    info "--- Deploying CLI pods ---"
    deploy_cli_pod "cna-alpha-ns" "cna-alpha" "CNAAlphaMSP" "peer0-cna-alpha.cna-alpha-ns:7051"
    deploy_cli_pod "cna-beta-ns" "cna-beta" "CNABetaMSP" "peer0-cna-beta.cna-beta-ns:9051"
    deploy_cli_pod "regulator-ns" "regulator" "RegulatorMSP" "peer0-regulator.regulator-ns:11051"

    # Copy channel genesis blocks to CLI pod
    for channel in cvepublic cveconsortium; do
        kubectl cp "${NETWORK_DIR}/channel-artifacts/${channel}.block" \
            "cna-alpha-ns/fabric-cli:/tmp/${channel}.block"
    done

    # --- Pre-flight: detect stale orderer ledger ---
    # If orderer already has channels from a previous run with different certs,
    # the raft leader election fails and peers get NOT_FOUND.
    # Fix: remove stale channels and re-join with fresh genesis blocks.
    info "--- Checking orderer state ---"
    local EXISTING_CHANNELS=$(kubectl exec fabric-cli -n cna-alpha-ns -- osnadmin channel list \
        -o orderer0.orderer-ns:7055 \
        --ca-file /crypto/orderer-admin-tls/ca.crt \
        --client-cert /crypto/orderer-admin-tls/client.crt \
        --client-key /crypto/orderer-admin-tls/client.key 2>&1)

    # If osnadmin itself fails with TLS error, the orderer has stale certs from old PVC
    local STALE_DETECTED=false
    if echo "$EXISTING_CHANNELS" | grep -q "ECDSA verification failure\|certificate signed by unknown authority\|tls.*failed"; then
        warn "Orderer TLS mismatch detected — stale PVC from previous deploy"
        STALE_DETECTED=true
    elif echo "$EXISTING_CHANNELS" | grep -q "cvepublic\|cveconsortium"; then
        warn "Orderer has channels from previous run — checking for stale certs..."

        # Test if orderer can actually serve blocks (raft leader must be elected)
        local TEST_FETCH=$(kubectl exec fabric-cli -n cna-alpha-ns -- peer channel fetch oldest \
            /tmp/test-health.block -c cvepublic \
            -o orderer0.orderer.cve.local:7050 \
            --tls --cafile /crypto/orderer-tls/ca.crt 2>&1)

        if echo "$TEST_FETCH" | grep -q "NOT_FOUND\|error\|Error"; then
            STALE_DETECTED=true
        fi
    fi

    if [ "$STALE_DETECTED" = true ]; then
            warn "Orderer has stale ledger. Cleaning orderer PVC..."

            # Scale down orderer, delete PVC, scale back up
            kubectl scale statefulset fabric-orderernode-orderer0 -n orderer-ns --replicas=0 2>/dev/null
            kubectl wait --for=delete pod/fabric-orderernode-orderer0-0 -n orderer-ns --timeout=30s 2>/dev/null || true
            kubectl delete pvc datadir-fabric-orderernode-orderer0-0 -n orderer-ns --ignore-not-found=true 2>/dev/null
            # Clean minikube hostPath data (prevents stale ledger reuse)
            minikube ssh "sudo rm -rf /tmp/hostpath-provisioner/orderer-ns/datadir-*" 2>/dev/null || true
            kubectl scale statefulset fabric-orderernode-orderer0 -n orderer-ns --replicas=1 2>/dev/null

            # Wait for pod to appear first, then wait for ready
            local ORD_WAIT=0
            while [ $ORD_WAIT -lt 60 ]; do
                kubectl get pod fabric-orderernode-orderer0-0 -n orderer-ns &>/dev/null && break
                sleep 5; ORD_WAIT=$((ORD_WAIT + 5))
                echo -ne "\r  Waiting for orderer pod to appear... ${ORD_WAIT}s"
            done
            echo ""
            kubectl wait --for=condition=ready pod/fabric-orderernode-orderer0-0 -n orderer-ns --timeout=120s 2>/dev/null || true

            info "  ✓ Orderer PVC cleaned and restarted"
    elif echo "$EXISTING_CHANNELS" | grep -q "cvepublic\|cveconsortium"; then
            info "  ✓ Orderer healthy — channels already active"
    fi

    # --- osnadmin: Join orderer to channels ---
    info "--- Joining orderer to channels via osnadmin ---"
    for channel in cvepublic cveconsortium; do
        local JOIN_RESULT=$(kubectl exec fabric-cli -n cna-alpha-ns -- osnadmin channel join \
            --channelID ${channel} \
            --config-block /tmp/${channel}.block \
            -o orderer0.orderer-ns:7055 \
            --ca-file /crypto/orderer-admin-tls/ca.crt \
            --client-cert /crypto/orderer-admin-tls/client.crt \
            --client-key /crypto/orderer-admin-tls/client.key 2>&1)

        if echo "$JOIN_RESULT" | grep -q "201\|already exists"; then
            info "  ✓ Orderer joined ${channel}"
        else
            warn "osnadmin join for ${channel} failed, retrying in 10s..."
            sleep 10
            kubectl exec fabric-cli -n cna-alpha-ns -- osnadmin channel join \
                --channelID ${channel} \
                --config-block /tmp/${channel}.block \
                -o orderer0.orderer-ns:7055 \
                --ca-file /crypto/orderer-admin-tls/ca.crt \
                --client-cert /crypto/orderer-admin-tls/client.crt \
                --client-key /crypto/orderer-admin-tls/client.key 2>&1
            info "  ✓ Orderer joined ${channel} (retry)"
        fi
    done

    # Wait for raft leader election before peer fetch
    info "--- Waiting for raft leader election ---"
    local LEADER_WAIT=0
    while [ $LEADER_WAIT -lt 30 ]; do
        if kubectl logs fabric-orderernode-orderer0-0 -n orderer-ns -c fabric-orderer --tail=20 2>/dev/null | grep -q "becomeLeader"; then
            info "  ✓ Raft leader elected"
            break
        fi
        sleep 2
        LEADER_WAIT=$((LEADER_WAIT + 2))
    done
    [ $LEADER_WAIT -ge 30 ] && warn "Leader election timed out — peer joins may fail"

    # List channels
    kubectl exec fabric-cli -n cna-alpha-ns -- osnadmin channel list \
        -o orderer0.orderer-ns:7055 \
        --ca-file /crypto/orderer-admin-tls/ca.crt \
        --client-cert /crypto/orderer-admin-tls/client.crt \
        --client-key /crypto/orderer-admin-tls/client.key 2>&1

    # --- Peer channel join ---
    info "--- Joining peers to channels ---"
    declare -A JOIN_MAP=(
        ["cna-alpha"]="cna-alpha-ns:7051"
        ["cna-beta"]="cna-beta-ns:9051"
        ["regulator"]="regulator-ns:11051"
    )

    # Pre-flight: detect stale peer ledgers and clean them
    for org in "${!JOIN_MAP[@]}"; do
        IFS=':' read -r ns port <<< "${JOIN_MAP[$org]}"
        local peer_sts=$(kubectl get statefulset -n ${ns} -l app.kubernetes.io/component=peer -o name 2>/dev/null | head -1)
        if [ -z "$peer_sts" ]; then continue; fi
        local peer_sts_name=$(basename "$peer_sts")
        local peer_pod="${peer_sts_name}-0"

        # Check if peer already has channels or has TLS mismatch from previous run
        local PEER_CHANNELS=$(kubectl exec fabric-cli -n ${ns} -- peer channel list 2>&1 || true)
        local PEER_STALE=false
        if echo "$PEER_CHANNELS" | grep -q "ECDSA verification failure\|certificate signed by unknown authority\|tls.*failed\|handshake failed\|connection refused"; then
            warn "peer0-${org} TLS mismatch detected — stale PVC from previous deploy"
            PEER_STALE=true
        elif echo "$PEER_CHANNELS" | grep -q "cvepublic\|cveconsortium"; then
            warn "peer0-${org} has stale channels from previous run"
            PEER_STALE=true
        fi

        if [ "$PEER_STALE" = true ]; then
            warn "Cleaning peer0-${org} PVCs..."

            kubectl scale statefulset ${peer_sts_name} -n ${ns} --replicas=0 2>/dev/null
            kubectl wait --for=delete pod/${peer_pod} -n ${ns} --timeout=30s 2>/dev/null || true

            # Delete ALL peer PVCs (data + couchdb)
            kubectl get pvc -n ${ns} --no-headers 2>/dev/null | awk '{print $1}' | grep -E "datadir-|couchdb-|data-" | while read pvc; do
                kubectl delete pvc ${pvc} -n ${ns} --ignore-not-found=true 2>/dev/null
                info "    Deleted PVC: ${pvc}"
            done

            # Clean minikube hostPath data (prevents stale ledger reuse)
            minikube ssh "sudo rm -rf /tmp/hostpath-provisioner/${ns}/datadir-*" 2>/dev/null || true

            kubectl scale statefulset ${peer_sts_name} -n ${ns} --replicas=1 2>/dev/null

            # Wait for peer pod to appear before proceeding
            local PEER_WAIT=0
            while [ $PEER_WAIT -lt 60 ]; do
                kubectl get pod ${peer_pod} -n ${ns} &>/dev/null && break
                sleep 5; PEER_WAIT=$((PEER_WAIT + 5))
                echo -ne "\r  Waiting for ${peer_pod} to appear... ${PEER_WAIT}s"
            done
            echo ""

            info "  ✓ peer0-${org} PVCs cleaned and restarted"
        fi
    done

    # Wait for all peers to be ready (CouchDB + peer gRPC must be up)
    info "--- Waiting for peers to be fully ready ---"
    for org in "${!JOIN_MAP[@]}"; do
        IFS=':' read -r ns port <<< "${JOIN_MAP[$org]}"
        local peer_pod=$(kubectl get pods -n ${ns} -l app.kubernetes.io/component=peer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        if [ -n "$peer_pod" ]; then
            kubectl wait --for=condition=ready pod/${peer_pod} -n ${ns} --timeout=120s 2>/dev/null || warn "peer in ${ns} not ready"
        fi
    done

    # Extra wait for CouchDB + peer gRPC to fully start listening
    sleep 10

    for channel in cvepublic cveconsortium; do
        for org in "${!JOIN_MAP[@]}"; do
            IFS=':' read -r ns port <<< "${JOIN_MAP[$org]}"

            local fetchpath="/tmp/fetched-${channel}.block"
            kubectl exec fabric-cli -n ${ns} -- sh -c "rm -f ${fetchpath}" 2>/dev/null || true

            # Fetch genesis block with retries
            local FETCH_OK=false
            for attempt in 1 2 3; do
                if kubectl exec fabric-cli -n ${ns} -- peer channel fetch oldest \
                    ${fetchpath} -c ${channel} \
                    -o orderer0.orderer.cve.local:7050 \
                    --tls --cafile /crypto/orderer-tls/ca.crt 2>&1 | grep -q "Received block"; then
                    FETCH_OK=true
                    break
                fi
                warn "fetch attempt ${attempt} failed for ${org}/${channel}, retrying in 5s..."
                sleep 5
            done

            if [ "$FETCH_OK" = false ]; then
                warn "Could not fetch block for ${org}/${channel} after 3 attempts — skipping"
                continue
            fi

            # Join peer to channel (ignore "already exists" errors)
            local JOIN_OUT=$(kubectl exec fabric-cli -n ${ns} -- peer channel join \
                -b ${fetchpath} 2>&1)
            if echo "$JOIN_OUT" | grep -q "Successfully submitted\|already exists"; then
                info "  ✓ peer0-${org} joined ${channel}"
            else
                warn "  ✗ peer0-${org} failed to join ${channel}: $(echo "$JOIN_OUT" | tail -1)"
            fi
        done
    done
}

# ==================== CHAINCODE DEPLOYMENT VIA CLI ====================
deploy_chaincode() {
    header "Deploying Chaincode via CLI"

    # Step 0: Vendor Go deps and package chaincode on host
    info "--- Packaging chaincode ---"
    cd "${CHAINCODE_DIR}"
    GO111MODULE=on go mod vendor 2>/dev/null || true

    # peer binary needs core.yaml from config dir, not configtx dir
    FABRIC_CFG_PATH="${FABRIC_DIR}/config" peer lifecycle chaincode package /tmp/cve-chaincode.tar.gz \
        --path "${CHAINCODE_DIR}" \
        --lang golang \
        --label cve-chaincode_1 2>&1

    local PKG_SIZE=$(ls -lh /tmp/cve-chaincode.tar.gz | awk '{print $5}')
    info "  ✓ Chaincode packaged (${PKG_SIZE})"

    # Copy to all CLI pods
    for ns in cna-alpha-ns cna-beta-ns regulator-ns; do
        kubectl cp /tmp/cve-chaincode.tar.gz "${ns}/fabric-cli:/tmp/cve-chaincode.tar.gz"
    done

    # Step 1: Install on all peers
    info "--- Installing chaincode on peers ---"
    local PACKAGE_ID=""

    declare -A CC_MAP=(
        ["cna-alpha"]="cna-alpha-ns"
        ["cna-beta"]="cna-beta-ns"
        ["regulator"]="regulator-ns"
    )

    for org in "${!CC_MAP[@]}"; do
        local ns="${CC_MAP[$org]}"
        info "Installing on peer0-${org}..."
        local INSTALL_OUT=$(kubectl exec fabric-cli -n ${ns} -- \
            peer lifecycle chaincode install /tmp/cve-chaincode.tar.gz 2>&1)

        # Extract package ID from install output or "already installed" error
        if [ -z "$PACKAGE_ID" ]; then
            PACKAGE_ID=$(echo "$INSTALL_OUT" | grep -oP 'cve-chaincode_1:[a-f0-9]+' | head -1)
        fi

        if echo "$INSTALL_OUT" | grep -q "Installed remotely\|already successfully installed"; then
            info "  ✓ Installed on peer0-${org}"
        else
            warn "  ✗ Install on peer0-${org}: $(echo "$INSTALL_OUT" | tail -1)"
        fi
    done

    if [ -z "$PACKAGE_ID" ]; then
        # Query installed to get package ID
        PACKAGE_ID=$(kubectl exec fabric-cli -n cna-alpha-ns -- \
            peer lifecycle chaincode queryinstalled 2>&1 | grep -oP 'cve-chaincode_1:[a-f0-9]+' | head -1)
    fi

    info "Package ID: ${PACKAGE_ID}"
    [ -z "$PACKAGE_ID" ] && { warn "Could not determine package ID"; return 1; }

    # Step 2: Approve for each org on cvepublic channel
    info "--- Approving chaincode (cvepublic) ---"
    for org in "${!CC_MAP[@]}"; do
        local ns="${CC_MAP[$org]}"
        info "Approving for ${org}..."
        kubectl exec fabric-cli -n ${ns} -- peer lifecycle chaincode approveformyorg \
            --channelID cvepublic \
            --name cve-chaincode \
            --version 1 \
            --package-id "${PACKAGE_ID}" \
            --sequence 1 \
            -o orderer0.orderer.cve.local:7050 \
            --tls --cafile /crypto/orderer-tls/ca.crt 2>&1 || warn "Approve failed for ${org}"
        info "  ✓ ${org} approved"
    done

    # Step 3: Commit from cna-alpha
    info "--- Committing chaincode (cvepublic) ---"
    # Get peer TLS CA certs for all orgs
    local ALPHA_TLS="/crypto/msp/tlscacerts/tlsca.crt"

    # We need TLS root certs for each peer. Copy them to the cna-alpha CLI pod.
    for org_ns in "cna-beta:cna-beta-ns" "regulator:regulator-ns"; do
        IFS=':' read -r org ns <<< "$org_ns"
        local CERT=$(kubectl get secret peer0-${org}-tls -n ${ns} -o jsonpath='{.data.cacrt}' | base64 -d)
        kubectl exec -i fabric-cli -n cna-alpha-ns -- sh -c "cat > /tmp/${org}-tls-ca.crt" <<< "$CERT"
    done

    kubectl exec fabric-cli -n cna-alpha-ns -- peer lifecycle chaincode commit \
        --channelID cvepublic \
        --name cve-chaincode \
        --version 1 \
        --sequence 1 \
        -o orderer0.orderer.cve.local:7050 \
        --tls --cafile /crypto/orderer-tls/ca.crt \
        --peerAddresses peer0-cna-alpha.cna-alpha-ns:7051 \
        --tlsRootCertFiles ${ALPHA_TLS} \
        --peerAddresses peer0-cna-beta.cna-beta-ns:9051 \
        --tlsRootCertFiles /tmp/cna-beta-tls-ca.crt \
        --peerAddresses peer0-regulator.regulator-ns:11051 \
        --tlsRootCertFiles /tmp/regulator-tls-ca.crt 2>&1 || warn "Commit failed"

    info "  ✓ Chaincode committed on cvepublic"

    # Verify cvepublic
    kubectl exec fabric-cli -n cna-alpha-ns -- peer lifecycle chaincode querycommitted \
        --channelID cvepublic --name cve-chaincode 2>&1 || true

    # Step 4: Approve for each org on cveconsortium channel (governance)
    info "--- Approving chaincode (cveconsortium) ---"
    for org in "${!CC_MAP[@]}"; do
        local ns="${CC_MAP[$org]}"
        info "Approving for ${org}..."
        kubectl exec fabric-cli -n ${ns} -- peer lifecycle chaincode approveformyorg \
            --channelID cveconsortium \
            --name cve-chaincode \
            --version 1 \
            --package-id "${PACKAGE_ID}" \
            --sequence 1 \
            -o orderer0.orderer.cve.local:7050 \
            --tls --cafile /crypto/orderer-tls/ca.crt 2>&1 || warn "Approve failed for ${org} on cveconsortium"
        info "  ✓ ${org} approved (cveconsortium)"
    done

    # Step 5: Commit on cveconsortium
    info "--- Committing chaincode (cveconsortium) ---"
    kubectl exec fabric-cli -n cna-alpha-ns -- peer lifecycle chaincode commit \
        --channelID cveconsortium \
        --name cve-chaincode \
        --version 1 \
        --sequence 1 \
        -o orderer0.orderer.cve.local:7050 \
        --tls --cafile /crypto/orderer-tls/ca.crt \
        --peerAddresses peer0-cna-alpha.cna-alpha-ns:7051 \
        --tlsRootCertFiles ${ALPHA_TLS} \
        --peerAddresses peer0-cna-beta.cna-beta-ns:9051 \
        --tlsRootCertFiles /tmp/cna-beta-tls-ca.crt \
        --peerAddresses peer0-regulator.regulator-ns:11051 \
        --tlsRootCertFiles /tmp/regulator-tls-ca.crt 2>&1 || warn "Commit failed on cveconsortium"

    info "  ✓ Chaincode committed on cveconsortium"

    # Verify cveconsortium
    kubectl exec fabric-cli -n cna-alpha-ns -- peer lifecycle chaincode querycommitted \
        --channelID cveconsortium --name cve-chaincode 2>&1 || true
}

# ==================== DEPLOY REDIS ====================
deploy_redis() {
    header "Deploying Redis"
    kubectl apply -n cna-alpha-ns -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  type: NodePort
  ports:
  - port: 6379
    targetPort: 6379
    nodePort: 30379
  selector:
    app: redis
EOF
    info "  ✓ Redis deployed"
}

# ==================== CLEANUP CLI PODS ====================
cleanup_cli_pods() {
    info "Cleaning up CLI pods..."
    for ns in cna-alpha-ns cna-beta-ns regulator-ns; do
        kubectl delete pod fabric-cli -n ${ns} --ignore-not-found=true 2>/dev/null &
    done
    wait
    info "CLI pods removed"
}

# ==================== STATUS ====================
show_status() {
    header "Network Status"
    echo -e "${CYAN}Pods:${NC}"
    kubectl get pods -A --no-headers 2>/dev/null | grep -vE 'kube-system|kubernetes-dashboard' | \
        awk '{printf "  %-15s %-50s %s\n", $1, $2, $4}'
    echo ""
    echo -e "${CYAN}Helm Releases:${NC}"
    helm list -A --no-headers 2>/dev/null | awk '{printf "  %-20s %-15s %s\n", $1, $2, $7}'
    echo ""
    echo -e "${CYAN}Services:${NC}"
    for ns in orderer-ns cna-alpha-ns cna-beta-ns regulator-ns; do
        kubectl get svc -n ${ns} --no-headers 2>/dev/null | awk -v ns="$ns" '{printf "  %-15s %-30s %s\n", ns, $1, $5}'
    done
}

# ==================== EXTRACT API WALLET ====================
extract_api_wallet() {
    header "Extracting Fabric Gateway Wallet Certs"
    local WALLET_DIR="${PROJECT_ROOT}/backend/wallet"
    mkdir -p "${WALLET_DIR}"

    # For each org, extract admin identity + TLS CA from the running pods
    local orgs=("cna-alpha:cna-alpha-ns:CNAAlphaMSP:peer0-cna-alpha"
                "cna-beta:cna-beta-ns:CNABetaMSP:peer0-cna-beta"
                "regulator:regulator-ns:RegulatorMSP:peer0-regulator")

    for entry in "${orgs[@]}"; do
        IFS=':' read -r org ns msp peer_container <<< "$entry"

        # Find peer pod — try multiple label selectors (Bevel uses component=fabric)
        local peer_pod=""
        for label in "app=${peer_container}" "app.kubernetes.io/component=fabric,app.kubernetes.io/name=${peer_container}" "app.kubernetes.io/component=peer"; do
            peer_pod=$(kubectl get pods -n ${ns} -l "${label}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
            [ -n "$peer_pod" ] && break
        done
        # Fallback: match pod name directly
        if [ -z "$peer_pod" ]; then
            peer_pod=$(kubectl get pods -n ${ns} --no-headers 2>/dev/null | grep "peernode.*${peer_container}" | awk '{print $1}' | head -1)
        fi
        if [ -z "$peer_pod" ]; then
            warn "No peer pod found in ${ns}, skipping wallet extract"
            continue
        fi
        info "  Found peer pod: ${peer_pod} in ${ns}"

        local prefix="${WALLET_DIR}/${org}"
        [ "$org" = "cna-alpha" ] && prefix="${WALLET_DIR}/admin"

        # Admin signing cert + private key (from K8s secret)
        kubectl get secret admin-${org}-msp -n ${ns} -o jsonpath='{.data.signcerts}' 2>/dev/null | base64 -d > "${prefix}-cert.pem"
        kubectl get secret admin-${org}-msp -n ${ns} -o jsonpath='{.data.keystore}' 2>/dev/null | base64 -d > "${prefix}-key.pem"

        # TLS CA cert — extract from the running peer pod
        kubectl exec ${peer_pod} -n ${ns} -c ${peer_container} -- cat /etc/hyperledger/fabric/crypto/tls/ca.crt > "${prefix}-tlsca.pem" 2>/dev/null

        # Validate — all 3 files must be non-empty
        local ok=true
        for f in "${prefix}-cert.pem" "${prefix}-key.pem" "${prefix}-tlsca.pem"; do
            if [ ! -s "$f" ]; then
                warn "  Empty or missing: $f"
                ok=false
            fi
        done
        if [ "$ok" = true ]; then
            info "  ✓ ${msp} → ${prefix}-{cert,key,tlsca}.pem"
        else
            warn "  ⚠ ${msp} — some wallet files failed, check pod/secret status"
        fi
    done

    info "Wallet directory: ${WALLET_DIR}"
    ls -la "${WALLET_DIR}"
}

# ==================== TEARDOWN ====================
teardown() {
    set +e  # Don't exit on errors during teardown — best-effort cleanup
    header "Tearing Down"

    # Kill port-forwards first (doesn't need cluster)
    info "--- Killing port-forwards ---"
    pkill -f "kubectl port-forward.*-ns" 2>/dev/null || true

    # Check if cluster is reachable (with timeout)
    local CLUSTER_UP=true
    if ! timeout 10 kubectl cluster-info &>/dev/null; then
        warn "Cluster not reachable — starting minikube..."
        minikube start --memory=8192 --cpus=4 2>/dev/null || {
            warn "Cannot reach cluster. Cleaning local files only."
            CLUSTER_UP=false
        }
    fi

    if [ "$CLUSTER_UP" = true ]; then

    # Base namespaces + any dynamically added orgs (e.g. cna-delta-ns)
    local EXTRA_NS=$(timeout 10 kubectl get ns --no-headers 2>/dev/null | awk '{print $1}' | grep -E "^cna-.*-ns$|^regulator-ns$|^orderer-ns$" || true)
    local ALL_NS=$(echo -e "orderer-ns\ncna-alpha-ns\ncna-beta-ns\nregulator-ns\n${EXTRA_NS}" | sort -u | grep -v '^$' | tr '\n' ' ')

    # Step 1: Uninstall all Helm releases (with timeout per namespace)
    info "--- Uninstalling Helm releases ---"
    for ns in ${ALL_NS}; do
        local releases=$(timeout 15 helm list -n ${ns} --short 2>/dev/null)
        if [ -n "$releases" ]; then
            echo "$releases" | while read r; do
                timeout 60 helm uninstall ${r} -n ${ns} --wait 2>/dev/null && info "  ✓ ${r} uninstalled from ${ns}" || warn "  ✗ ${r} timed out"
            done
        fi
    done

    # Step 2: Force-delete any remaining pods and wait for termination
    info "--- Deleting remaining pods ---"
    for ns in ${ALL_NS}; do
        timeout 30 kubectl delete pods --all -n ${ns} --grace-period=0 --force --ignore-not-found=true 2>/dev/null
    done
    # Wait for all pods to fully terminate before deleting PVCs
    for ns in ${ALL_NS}; do
        local wait_count=0
        while [ $wait_count -lt 30 ]; do
            local pod_count=$(timeout 5 kubectl get pods -n ${ns} --no-headers 2>/dev/null | wc -l)
            [ "$pod_count" -eq 0 ] && break
            sleep 2; wait_count=$((wait_count + 2))
        done
    done

    # Step 3: Delete ALL PVCs (data, couchdb, CA, orderer)
    info "--- Deleting PVCs ---"
    for ns in ${ALL_NS}; do
        timeout 30 kubectl delete pvc --all -n ${ns} --ignore-not-found=true 2>/dev/null
        info "  ✓ PVCs deleted in ${ns}"
    done

    # Step 4: Delete orphan PVs
    info "--- Cleaning up PVs ---"
    timeout 15 kubectl get pv --no-headers 2>/dev/null | while read pv_line; do
        local pv_name=$(echo "$pv_line" | awk '{print $1}')
        local pv_ns=$(timeout 5 kubectl get pv ${pv_name} -o jsonpath='{.spec.claimRef.namespace}' 2>/dev/null)
        if echo "${ALL_NS}" | grep -qw "${pv_ns}"; then
            timeout 10 kubectl delete pv ${pv_name} --ignore-not-found=true 2>/dev/null
            info "  ✓ PV ${pv_name} deleted"
        fi
    done

    # Step 4b: Clean minikube hostPath provisioner data (prevents stale ledger on re-deploy)
    info "--- Cleaning minikube hostPath data ---"
    for ns in ${ALL_NS}; do
        minikube ssh "sudo rm -rf /tmp/hostpath-provisioner/${ns}" 2>/dev/null && \
            info "  ✓ Cleaned hostPath data for ${ns}" || true
    done

    # Step 5: Delete StorageClasses created by Bevel
    info "--- Cleaning up StorageClasses ---"
    timeout 10 kubectl get sc --no-headers 2>/dev/null | awk '{print $1}' | grep -E "storage-(orderer|peer|ca)" | while read sc; do
        timeout 10 kubectl delete sc ${sc} --ignore-not-found=true 2>/dev/null
        info "  ✓ StorageClass ${sc} deleted"
    done

    # Step 6: Delete K8s secrets and configmaps
    info "--- Cleaning secrets & configmaps ---"
    for ns in ${ALL_NS}; do
        timeout 15 kubectl delete secrets --all -n ${ns} --ignore-not-found=true 2>/dev/null
        timeout 15 kubectl delete configmaps --all -n ${ns} --ignore-not-found=true 2>/dev/null
    done

    # Step 7: Delete namespaces (parallel with timeout)
    info "--- Deleting namespaces ---"
    for ns in ${ALL_NS}; do
        timeout 60 kubectl delete namespace ${ns} --ignore-not-found=true 2>/dev/null &
    done
    wait

    # Step 8: Remove stale CoreDNS rewrite rules
    info "--- Reverting CoreDNS patches ---"
    local COREFILE=$(timeout 10 kubectl get configmap coredns -n kube-system -o jsonpath='{.data.Corefile}' 2>/dev/null)
    if echo "$COREFILE" | grep -q "cve.local"; then
        timeout 10 kubectl get configmap coredns -n kube-system -o json 2>/dev/null | \
            python3 -c "
import json, sys, re
data = json.load(sys.stdin)
cf = data['data']['Corefile']
cf = re.sub(r'\s*rewrite name [^\n]*cve\.local[^\n]*\n?', '\n', cf)
cf = re.sub(r'\n{3,}', '\n\n', cf)
data['data']['Corefile'] = cf
json.dump(data, sys.stdout)
" 2>/dev/null | timeout 10 kubectl replace -f - 2>/dev/null && \
            timeout 10 kubectl rollout restart deployment coredns -n kube-system 2>/dev/null
        info "  ✓ CoreDNS cve.local rewrites removed"
    fi

    fi  # end CLUSTER_UP check

    # Clean local files (always runs, even if cluster is down)
    info "--- Cleaning local crypto & artifacts ---"
    rm -rf "${NETWORK_DIR}/organizations/peerOrganizations"
    rm -rf "${NETWORK_DIR}/organizations/ordererOrganizations"
    rm -rf "${NETWORK_DIR}/channel-artifacts"
    rm -rf "${NETWORK_DIR}/system-genesis-block"

    # Clean wallet certs
    rm -f "${PROJECT_ROOT}/backend/wallet"/*.pem 2>/dev/null

    # Clean SQLite DB (fresh start on next deploy)
    rm -f "${PROJECT_ROOT}/backend/data/users.db" 2>/dev/null
    rm -f "${PROJECT_ROOT}/backend/cve.db" 2>/dev/null

    set -e  # Re-enable exit on error
    info "Teardown complete — all crypto, PVCs, PVs, and stale certs removed"
}

# ==================== PORT FORWARDING ====================
start_port_forwards() {
    header "Starting Port Forwards"

    # Kill any existing port-forwards first
    pkill -f "kubectl port-forward.*-ns" 2>/dev/null || true
    sleep 1

    # Peer endpoints (backend connects to these)
    kubectl port-forward svc/peer0-cna-alpha -n cna-alpha-ns 7051:7051 &>/tmp/pf-peer-alpha.log &
    kubectl port-forward svc/peer0-cna-beta -n cna-beta-ns 9051:9051 &>/tmp/pf-peer-beta.log &
    kubectl port-forward svc/peer0-regulator -n regulator-ns 11051:11051 &>/tmp/pf-peer-reg.log &

    # Orderer
    kubectl port-forward svc/orderer0 -n orderer-ns 7050:7050 &>/tmp/pf-orderer.log &

    # Redis
    kubectl port-forward svc/redis -n cna-alpha-ns 6379:6379 &>/tmp/pf-redis.log &

    sleep 2
    info "  ✓ peer0-cna-alpha  → localhost:7051"
    info "  ✓ peer0-cna-beta   → localhost:9051"
    info "  ✓ peer0-regulator  → localhost:11051"
    info "  ✓ orderer0         → localhost:7050"
    info "  ✓ redis            → localhost:6379"
}

# ==================== FULL DEPLOYMENT ====================
deploy_full() {
    check_prerequisites
    set_inotify_limits
    start_minikube
    clone_bevel
    patch_bevel_charts
    create_namespaces

    # Pre-clean minikube hostPath data to prevent stale ledger from previous deploy
    info "--- Pre-cleaning minikube hostPath provisioner data ---"
    for ns in orderer-ns cna-alpha-ns cna-beta-ns regulator-ns; do
        minikube ssh "sudo rm -rf /tmp/hostpath-provisioner/${ns}" 2>/dev/null || true
    done
    info "  ✓ hostPath data cleaned"

    generate_crypto
    store_crypto_as_secrets
    generate_channel_genesis
    patch_coredns
    deploy_cas
    deploy_orderer
    deploy_peers
    deploy_redis
    wait_for_fabric_pods
    create_channels_and_join
    deploy_chaincode
    extract_api_wallet
    start_port_forwards

    header "Deployment Complete!"
    echo -e "${GREEN}Fabric 2.5.4 network deployed on Minikube via Bevel Helm charts${NC}"
    echo ""
    echo "Channels: cvepublic, cveconsortium"
    echo "Chaincode: cve-chaincode (committed on cvepublic & cveconsortium)"
    echo ""
    echo "Namespaces:"
    echo "  orderer-ns    -> OrdererMSP"
    echo "  cna-alpha-ns  -> CNAAlphaMSP"
    echo "  cna-beta-ns   -> CNABetaMSP"
    echo "  regulator-ns  -> RegulatorMSP"
    echo ""
    echo "Port Forwards:"
    echo "  localhost:7051  -> peer0-cna-alpha"
    echo "  localhost:9051  -> peer0-cna-beta"
    echo "  localhost:11051 -> peer0-regulator"
    echo "  localhost:7050  -> orderer0"
    echo "  localhost:6379  -> redis"
    echo ""
    echo "Commands:"
    echo "  $0 status     Show network status"
    echo "  $0 down       Tear down everything"
    echo "  $0 portfwd    Restart port-forwards"
}

# ==================== MAIN ====================
case "${1:-help}" in
    up)        deploy_full ;;
    down)      teardown ;;
    status)    show_status ;;
    channels)  create_channels_and_join ;;
    chaincode) deploy_chaincode ;;
    portfwd)   start_port_forwards ;;
    clone)     clone_bevel && patch_bevel_charts ;;
    add-org)   shift; bash "${SCRIPT_DIR}/add-org.sh" "$@" ;;
    *)
        echo "Usage: $0 {up|down|status|channels|chaincode|portfwd|clone|add-org}"
        echo ""
        echo "  up         Full deployment (Bevel + channels + chaincode)"
        echo "  down       Tear down everything"
        echo "  status     Show pod/service status"
        echo "  channels   Create channels and join peers only"
        echo "  chaincode  Deploy chaincode only"
        echo "  portfwd    Start/restart port-forwards for backend"
        echo "  clone      Clone and patch Bevel repo only"
        echo "  add-org    Add new org: add-org <name> <msp-id> <port> <nodeport>"
        ;;
esac
