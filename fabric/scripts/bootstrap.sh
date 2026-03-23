#!/bin/bash
# Download Hyperledger Fabric binaries and Docker images
set -e

FABRIC_VERSION="2.4.9"
CA_VERSION="1.5.7"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/../bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

mkdir -p "${BIN_DIR}"

# Check if binaries already exist
if [ -f "${BIN_DIR}/peer" ] && [ -f "${BIN_DIR}/configtxgen" ] && [ -f "${BIN_DIR}/cryptogen" ]; then
    EXISTING_VERSION=$("${BIN_DIR}/peer" version 2>&1 | grep "Version:" | awk '{print $2}' || echo "unknown")
    info "Fabric binaries already exist (version: ${EXISTING_VERSION})"
    read -p "Re-download? (y/N): " choice
    if [[ ! "$choice" =~ ^[Yy]$ ]]; then
        info "Skipping binary download"
        exit 0
    fi
fi

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64) ARCH="arm64" ;;
    *) error "Unsupported architecture: $ARCH" ;;
esac

OS=$(uname -s | tr '[:upper:]' '[:lower:]')

info "Downloading Fabric binaries v${FABRIC_VERSION} for ${OS}-${ARCH}..."

FABRIC_URL="https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VERSION}/hyperledger-fabric-${OS}-${ARCH}-${FABRIC_VERSION}.tar.gz"
CA_URL="https://github.com/hyperledger/fabric-ca/releases/download/v${CA_VERSION}/hyperledger-fabric-ca-${OS}-${ARCH}-${CA_VERSION}.tar.gz"

TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Download Fabric binaries
info "Downloading Fabric binaries..."
if ! curl -sSL "${FABRIC_URL}" -o "${TEMP_DIR}/fabric.tar.gz"; then
    error "Failed to download Fabric binaries from ${FABRIC_URL}"
fi

info "Extracting Fabric binaries..."
tar -xzf "${TEMP_DIR}/fabric.tar.gz" -C "${TEMP_DIR}"
cp -r "${TEMP_DIR}/bin/"* "${BIN_DIR}/"
if [ -d "${TEMP_DIR}/config" ]; then
    cp -r "${TEMP_DIR}/config" "${SCRIPT_DIR}/../"
fi

# Download Fabric CA binaries
info "Downloading Fabric CA binaries v${CA_VERSION}..."
if ! curl -sSL "${CA_URL}" -o "${TEMP_DIR}/fabric-ca.tar.gz"; then
    warn "Failed to download Fabric CA binaries, skipping CA"
else
    tar -xzf "${TEMP_DIR}/fabric-ca.tar.gz" -C "${TEMP_DIR}"
    cp -r "${TEMP_DIR}/bin/"* "${BIN_DIR}/" 2>/dev/null || true
fi

chmod +x "${BIN_DIR}"/*

info "Pulling Fabric Docker images..."
docker pull hyperledger/fabric-peer:${FABRIC_VERSION}
docker pull hyperledger/fabric-orderer:${FABRIC_VERSION}
docker pull hyperledger/fabric-tools:${FABRIC_VERSION}
docker pull hyperledger/fabric-ccenv:${FABRIC_VERSION}
docker pull hyperledger/fabric-baseos:${FABRIC_VERSION}
docker pull hyperledger/fabric-ca:${CA_VERSION}
docker pull couchdb:3.3
docker pull redis:7-alpine

# Tag images with just major.minor for compatibility
docker tag hyperledger/fabric-peer:${FABRIC_VERSION} hyperledger/fabric-peer:2.4
docker tag hyperledger/fabric-orderer:${FABRIC_VERSION} hyperledger/fabric-orderer:2.4
docker tag hyperledger/fabric-tools:${FABRIC_VERSION} hyperledger/fabric-tools:2.4
docker tag hyperledger/fabric-ccenv:${FABRIC_VERSION} hyperledger/fabric-ccenv:2.4
docker tag hyperledger/fabric-baseos:${FABRIC_VERSION} hyperledger/fabric-baseos:2.4
docker tag hyperledger/fabric-ca:${CA_VERSION} hyperledger/fabric-ca:1.5

info "Installed binaries:"
ls -la "${BIN_DIR}/"

info "Bootstrap complete! Fabric v${FABRIC_VERSION}, CA v${CA_VERSION}"
