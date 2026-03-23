#!/bin/bash
# Master network orchestration script
# Usage: ./network.sh up|down|restart|status|generate|deploy-cc
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NETWORK_DIR="${SCRIPT_DIR}/../network"
BIN_DIR="${SCRIPT_DIR}/../bin"
CHAINCODE_DIR="${SCRIPT_DIR}/../chaincode/cve"

export PATH="${BIN_DIR}:${PATH}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header() { echo -e "\n${CYAN}========================================${NC}"; echo -e "${CYAN} $1${NC}"; echo -e "${CYAN}========================================${NC}\n"; }

MODE="${1:-help}"
DEPLOY_MODE="${2:-docker}" # docker or k8s

CC_NAME="cve-chaincode"
CC_VERSION="1.0"
CC_SEQUENCE=1
CHANNEL_PUBLIC="cvepublic"
CHANNEL_CONSORTIUM="cveconsortium"

ORDERER_CA="${NETWORK_DIR}/organizations/ordererOrganizations/orderer.cve.local/orderers/orderer0.orderer.cve.local/msp/tlscacerts/tlsca.orderer.cve.local-cert.pem"
ORDERER_ADMIN_TLS="${NETWORK_DIR}/organizations/ordererOrganizations/orderer.cve.local/orderers/orderer0.orderer.cve.local/tls"

check_prerequisites() {
    info "Checking prerequisites..."
    command -v docker >/dev/null 2>&1 || error "Docker is not installed"
    command -v docker-compose >/dev/null 2>&1 || command -v docker compose >/dev/null 2>&1 || error "Docker Compose is not installed"

    if [ ! -f "${BIN_DIR}/cryptogen" ]; then
        error "Fabric binaries not found. Run: ./bootstrap.sh"
    fi
    info "Prerequisites OK"
}

generate_crypto() {
    header "Generating Crypto Material"

    info "Generating crypto material with cryptogen..."
    rm -rf "${NETWORK_DIR}/organizations/peerOrganizations"
    rm -rf "${NETWORK_DIR}/organizations/ordererOrganizations"

    cryptogen generate --config="${NETWORK_DIR}/organizations/cryptogen/crypto-config.yaml" \
        --output="${NETWORK_DIR}/organizations"

    info "Crypto material generated successfully"
}

generate_genesis() {
    header "Generating Genesis Block & Channel Transactions"

    export FABRIC_CFG_PATH="${NETWORK_DIR}/configtx"

    info "Generating orderer genesis block..."
    configtxgen -profile CVEOrdererGenesis -channelID system-channel \
        -outputBlock "${NETWORK_DIR}/system-genesis-block/genesis.block"

    info "Generating channel tx for ${CHANNEL_PUBLIC}..."
    configtxgen -profile CVEPublicChannel -outputCreateChannelTx \
        "${NETWORK_DIR}/channel-artifacts/${CHANNEL_PUBLIC}.tx" -channelID ${CHANNEL_PUBLIC}

    info "Generating channel tx for ${CHANNEL_CONSORTIUM}..."
    configtxgen -profile CVEConsortiumChannel -outputCreateChannelTx \
        "${NETWORK_DIR}/channel-artifacts/${CHANNEL_CONSORTIUM}.tx" -channelID ${CHANNEL_CONSORTIUM}

    # Generate anchor peer updates
    for ORG in CNAAlphaMSP CNABetaMSP RegulatorMSP; do
        for CHANNEL in ${CHANNEL_PUBLIC} ${CHANNEL_CONSORTIUM}; do
            PROFILE="CVEPublicChannel"
            if [ "$CHANNEL" = "${CHANNEL_CONSORTIUM}" ]; then
                PROFILE="CVEConsortiumChannel"
            fi
            info "Generating anchor peer update for ${ORG} on ${CHANNEL}..."
            configtxgen -profile ${PROFILE} -outputAnchorPeersUpdate \
                "${NETWORK_DIR}/channel-artifacts/${ORG}-${CHANNEL}-anchors.tx" \
                -channelID ${CHANNEL} -asOrg ${ORG}
        done
    done

    info "Genesis block and channel transactions generated"
}

start_network() {
    header "Starting Fabric Network"

    cd "${NETWORK_DIR}/docker"

    docker compose -f docker-compose.yaml up -d 2>/dev/null || \
        docker-compose -f docker-compose.yaml up -d

    info "Waiting for containers to start..."
    sleep 5

    # Check all containers are running
    local containers=("orderer0.orderer.cve.local" "peer0.cna-alpha.cve.local" "peer0.cna-beta.cve.local" "peer0.regulator.cve.local" "couchdb0.cna-alpha" "couchdb0.cna-beta" "couchdb0.regulator" "redis")
    for c in "${containers[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
            info "  ✓ ${c} is running"
        else
            warn "  ✗ ${c} is NOT running"
        fi
    done
}

create_channel() {
    local CHANNEL_NAME=$1
    local CHANNEL_TX="${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.tx"

    header "Creating Channel: ${CHANNEL_NAME}"

    # Create channel using osnadmin
    info "Creating channel ${CHANNEL_NAME} via osnadmin..."

    osnadmin channel join --channelID ${CHANNEL_NAME} \
        --config-block <(configtxgen -profile CVEOrdererGenesis -outputBlock /dev/stdout -channelID ${CHANNEL_NAME} 2>/dev/null) \
        -o localhost:7053 \
        --ca-file "${ORDERER_CA}" \
        --client-cert "${ORDERER_ADMIN_TLS}/server.crt" \
        --client-key "${ORDERER_ADMIN_TLS}/server.key" 2>/dev/null || true

    # Alternative: create channel block and join
    export FABRIC_CFG_PATH="${NETWORK_DIR}/configtx"

    configtxgen -profile CVEPublicChannel -outputBlock "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
        -channelID ${CHANNEL_NAME} 2>/dev/null || \
    configtxgen -profile CVEConsortiumChannel -outputBlock "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
        -channelID ${CHANNEL_NAME} 2>/dev/null || true

    # Join peers using osnadmin for Fabric 2.4+
    info "Joining orderer to ${CHANNEL_NAME}..."
    osnadmin channel join --channelID ${CHANNEL_NAME} \
        --config-block "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" \
        -o localhost:7053 \
        --ca-file "${ORDERER_CA}" \
        --client-cert "${ORDERER_ADMIN_TLS}/server.crt" \
        --client-key "${ORDERER_ADMIN_TLS}/server.key" 2>&1 || warn "Orderer join may have already completed"
}

join_channel_peer() {
    local CHANNEL_NAME=$1
    local PEER_ADDRESS=$2
    local MSP_ID=$3
    local ORG_DOMAIN=$4

    info "Joining ${PEER_ADDRESS} to ${CHANNEL_NAME}..."

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="${MSP_ID}"
    export CORE_PEER_ADDRESS="${PEER_ADDRESS}"
    export CORE_PEER_TLS_ROOTCERT_FILE="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    # Fetch genesis block
    peer channel fetch 0 "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_${MSP_ID}.block" \
        -o localhost:7050 -c ${CHANNEL_NAME} \
        --tls --cafile "${ORDERER_CA}" 2>&1 || true

    # Join channel
    peer channel join -b "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}_${MSP_ID}.block" 2>&1 || \
        peer channel join -b "${NETWORK_DIR}/channel-artifacts/${CHANNEL_NAME}.block" 2>&1 || \
        warn "Peer ${PEER_ADDRESS} may already be joined to ${CHANNEL_NAME}"
}

create_and_join_channels() {
    header "Creating and Joining Channels"

    for CHANNEL in ${CHANNEL_PUBLIC} ${CHANNEL_CONSORTIUM}; do
        create_channel ${CHANNEL}
        sleep 2

        join_channel_peer ${CHANNEL} "localhost:7051" "CNAAlphaMSP" "cna-alpha.cve.local"
        join_channel_peer ${CHANNEL} "localhost:9051" "CNABetaMSP" "cna-beta.cve.local"
        join_channel_peer ${CHANNEL} "localhost:11051" "RegulatorMSP" "regulator.cve.local"

        info "All peers joined ${CHANNEL}"
    done
}

package_chaincode() {
    header "Packaging Chaincode"

    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    info "Packaging Go chaincode..."
    peer lifecycle chaincode package "${NETWORK_DIR}/channel-artifacts/${CC_NAME}.tar.gz" \
        --path "${CHAINCODE_DIR}" \
        --lang golang \
        --label "${CC_NAME}_${CC_VERSION}"

    info "Chaincode packaged: ${CC_NAME}_${CC_VERSION}"
}

install_chaincode_on_peer() {
    local PEER_ADDRESS=$1
    local MSP_ID=$2
    local ORG_DOMAIN=$3

    info "Installing chaincode on ${PEER_ADDRESS}..."

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="${MSP_ID}"
    export CORE_PEER_ADDRESS="${PEER_ADDRESS}"
    export CORE_PEER_TLS_ROOTCERT_FILE="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    peer lifecycle chaincode install "${NETWORK_DIR}/channel-artifacts/${CC_NAME}.tar.gz" 2>&1
}

approve_chaincode() {
    local CHANNEL_NAME=$1
    local PEER_ADDRESS=$2
    local MSP_ID=$3
    local ORG_DOMAIN=$4
    local PACKAGE_ID=$5

    info "Approving chaincode for ${MSP_ID} on ${CHANNEL_NAME}..."

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="${MSP_ID}"
    export CORE_PEER_ADDRESS="${PEER_ADDRESS}"
    export CORE_PEER_TLS_ROOTCERT_FILE="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.${ORG_DOMAIN}/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp"
    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    peer lifecycle chaincode approveformyorg \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.orderer.cve.local \
        --tls --cafile "${ORDERER_CA}" \
        --channelID ${CHANNEL_NAME} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --package-id ${PACKAGE_ID} \
        --sequence ${CC_SEQUENCE} \
        --collections-config "${NETWORK_DIR}/collections_config.json" 2>&1
}

commit_chaincode() {
    local CHANNEL_NAME=$1

    info "Committing chaincode on ${CHANNEL_NAME}..."

    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="CNAAlphaMSP"
    export CORE_PEER_ADDRESS="localhost:7051"
    export CORE_PEER_TLS_ROOTCERT_FILE="${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/peers/peer0.cna-alpha.cve.local/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/users/Admin@cna-alpha.cve.local/msp"
    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    peer lifecycle chaincode commit \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.orderer.cve.local \
        --tls --cafile "${ORDERER_CA}" \
        --channelID ${CHANNEL_NAME} \
        --name ${CC_NAME} \
        --version ${CC_VERSION} \
        --sequence ${CC_SEQUENCE} \
        --collections-config "${NETWORK_DIR}/collections_config.json" \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/peers/peer0.cna-alpha.cve.local/tls/ca.crt" \
        --peerAddresses localhost:9051 \
        --tlsRootCertFiles "${NETWORK_DIR}/organizations/peerOrganizations/cna-beta.cve.local/peers/peer0.cna-beta.cve.local/tls/ca.crt" \
        --peerAddresses localhost:11051 \
        --tlsRootCertFiles "${NETWORK_DIR}/organizations/peerOrganizations/regulator.cve.local/peers/peer0.regulator.cve.local/tls/ca.crt" 2>&1
}

deploy_chaincode() {
    header "Deploying Chaincode"

    package_chaincode

    # Install on all peers
    install_chaincode_on_peer "localhost:7051" "CNAAlphaMSP" "cna-alpha.cve.local"
    install_chaincode_on_peer "localhost:9051" "CNABetaMSP" "cna-beta.cve.local"
    install_chaincode_on_peer "localhost:11051" "RegulatorMSP" "regulator.cve.local"

    # Get package ID
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="CNAAlphaMSP"
    export CORE_PEER_ADDRESS="localhost:7051"
    export CORE_PEER_TLS_ROOTCERT_FILE="${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/peers/peer0.cna-alpha.cve.local/tls/ca.crt"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/users/Admin@cna-alpha.cve.local/msp"
    export FABRIC_CFG_PATH="${SCRIPT_DIR}/../config"

    PACKAGE_ID=$(peer lifecycle chaincode queryinstalled 2>&1 | grep "${CC_NAME}_${CC_VERSION}" | awk -F'[, ]+' '{print $3}')
    info "Package ID: ${PACKAGE_ID}"

    if [ -z "${PACKAGE_ID}" ]; then
        error "Failed to get chaincode package ID"
    fi

    # Approve for each org on both channels
    for CHANNEL in ${CHANNEL_PUBLIC} ${CHANNEL_CONSORTIUM}; do
        approve_chaincode ${CHANNEL} "localhost:7051" "CNAAlphaMSP" "cna-alpha.cve.local" "${PACKAGE_ID}"
        approve_chaincode ${CHANNEL} "localhost:9051" "CNABetaMSP" "cna-beta.cve.local" "${PACKAGE_ID}"
        approve_chaincode ${CHANNEL} "localhost:11051" "RegulatorMSP" "regulator.cve.local" "${PACKAGE_ID}"

        commit_chaincode ${CHANNEL}
        info "Chaincode committed on ${CHANNEL}"
    done

    # Initialize chaincode
    info "Initializing CVE contract..."
    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.orderer.cve.local \
        --tls --cafile "${ORDERER_CA}" \
        -C ${CHANNEL_PUBLIC} -n ${CC_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/peers/peer0.cna-alpha.cve.local/tls/ca.crt" \
        -c '{"function":"cve:InitLedger","Args":[]}' 2>&1

    peer chaincode invoke \
        -o localhost:7050 \
        --ordererTLSHostnameOverride orderer0.orderer.cve.local \
        --tls --cafile "${ORDERER_CA}" \
        -C ${CHANNEL_PUBLIC} -n ${CC_NAME} \
        --peerAddresses localhost:7051 \
        --tlsRootCertFiles "${NETWORK_DIR}/organizations/peerOrganizations/cna-alpha.cve.local/peers/peer0.cna-alpha.cve.local/tls/ca.crt" \
        -c '{"function":"governance:InitGovernance","Args":[]}' 2>&1

    info "Chaincode deployed and initialized successfully!"
}

stop_network() {
    header "Stopping Fabric Network"

    cd "${NETWORK_DIR}/docker"
    docker compose -f docker-compose.yaml down --volumes --remove-orphans 2>/dev/null || \
        docker-compose -f docker-compose.yaml down --volumes --remove-orphans 2>/dev/null || true

    # Clean up chaincode containers
    docker ps -a --format '{{.Names}}' | grep "dev-peer" | xargs -r docker rm -f 2>/dev/null || true
    docker images --format '{{.Repository}}:{{.Tag}}' | grep "dev-peer" | xargs -r docker rmi -f 2>/dev/null || true

    info "Network stopped"
}

clean_network() {
    header "Cleaning Up Network Artifacts"

    stop_network

    rm -rf "${NETWORK_DIR}/organizations/peerOrganizations"
    rm -rf "${NETWORK_DIR}/organizations/ordererOrganizations"
    rm -rf "${NETWORK_DIR}/system-genesis-block/"*.block
    rm -rf "${NETWORK_DIR}/channel-artifacts/"*

    info "Network artifacts cleaned"
}

network_status() {
    header "Network Status"

    echo -e "\n${CYAN}Docker Containers:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "label=service=hyperledger-fabric" 2>/dev/null || echo "No Fabric containers running"

    echo -e "\n${CYAN}Redis:${NC}"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=redis" 2>/dev/null || echo "Redis not running"
}

network_up() {
    check_prerequisites
    generate_crypto
    generate_genesis
    start_network
    sleep 3
    create_and_join_channels
    deploy_chaincode

    header "Network Ready!"
    info "Orderer:    localhost:7050"
    info "CNA-Alpha:  localhost:7051"
    info "CNA-Beta:   localhost:9051"
    info "Regulator:  localhost:11051"
    info "Redis:      localhost:6379"
    info "CouchDB:    localhost:5984 (CNA-Alpha), :7984 (CNA-Beta), :9984 (Regulator)"
}

case "${MODE}" in
    up)
        network_up
        ;;
    down)
        stop_network
        ;;
    clean)
        clean_network
        ;;
    restart)
        stop_network
        sleep 2
        network_up
        ;;
    status)
        network_status
        ;;
    generate)
        check_prerequisites
        generate_crypto
        generate_genesis
        ;;
    deploy-cc)
        deploy_chaincode
        ;;
    *)
        echo "Usage: $0 {up|down|clean|restart|status|generate|deploy-cc}"
        echo ""
        echo "  up        - Start the complete Fabric network"
        echo "  down      - Stop the network"
        echo "  clean     - Stop network and remove all artifacts"
        echo "  restart   - Restart the network"
        echo "  status    - Show network status"
        echo "  generate  - Generate crypto material and genesis block only"
        echo "  deploy-cc - Deploy/upgrade chaincode only"
        exit 1
        ;;
esac
