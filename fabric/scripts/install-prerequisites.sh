#!/bin/bash
# ============================================================================
# VulnChain - Prerequisites Installer
#
# Installs all tools required by setup-k8s.sh if not already present:
#   - Docker, kubectl, Helm, Minikube, Go, Python3, jq, git
#   - Hyperledger Fabric binaries (peer, cryptogen, configtxgen, etc.)
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FABRIC_DIR="${SCRIPT_DIR}/.."
BIN_DIR="${FABRIC_DIR}/bin"
FABRIC_VERSION="2.5.4"
FABRIC_CA_VERSION="1.5.12"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()   { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
header() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}  $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Please run as root: sudo bash $0"
    fi
}

install_if_missing() {
    local cmd="$1"
    local install_fn="$2"
    if command -v "$cmd" >/dev/null 2>&1; then
        info "  ✓ $cmd already installed ($(command -v "$cmd"))"
    else
        warn "  ✗ $cmd not found — installing..."
        $install_fn
        if command -v "$cmd" >/dev/null 2>&1; then
            info "  ✓ $cmd installed successfully"
        else
            error "  ✗ Failed to install $cmd"
        fi
    fi
}

# ==================== INDIVIDUAL INSTALLERS ====================

install_docker() {
    apt-get update -qq
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    # Allow the calling user to use docker without sudo
    if [ -n "$SUDO_USER" ]; then
        usermod -aG docker "$SUDO_USER"
        info "  Added $SUDO_USER to docker group (re-login to take effect)"
    fi
    systemctl enable docker
    systemctl start docker
}

install_kubectl() {
    curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x /usr/local/bin/kubectl
}

install_helm() {
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
}

install_minikube() {
    curl -fsSLo /usr/local/bin/minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    chmod +x /usr/local/bin/minikube
}

install_go() {
    local GO_VERSION
    GO_VERSION=$(curl -fsSL https://go.dev/VERSION?m=text | head -1)
    curl -fsSLo /tmp/go.tar.gz "https://go.dev/dl/${GO_VERSION}.linux-amd64.tar.gz"
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
    ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt
}

install_python3() {
    apt-get update -qq
    apt-get install -y python3
}

install_jq() {
    apt-get update -qq
    apt-get install -y jq
}

install_git() {
    apt-get update -qq
    apt-get install -y git
}

install_fabric_binaries() {
    info "  Downloading Fabric ${FABRIC_VERSION} binaries..."
    mkdir -p "${BIN_DIR}"
    local TMP_DIR=$(mktemp -d)

    # Download fabric binaries
    curl -fsSLo "${TMP_DIR}/fabric.tar.gz" \
        "https://github.com/hyperledger/fabric/releases/download/v${FABRIC_VERSION}/hyperledger-fabric-linux-amd64-${FABRIC_VERSION}.tar.gz"
    tar -xzf "${TMP_DIR}/fabric.tar.gz" -C "${TMP_DIR}"
    cp -f "${TMP_DIR}/bin/"* "${BIN_DIR}/"

    # Download fabric-ca binaries
    curl -fsSLo "${TMP_DIR}/fabric-ca.tar.gz" \
        "https://github.com/hyperledger/fabric-ca/releases/download/v${FABRIC_CA_VERSION}/hyperledger-fabric-ca-linux-amd64-${FABRIC_CA_VERSION}.tar.gz"
    tar -xzf "${TMP_DIR}/fabric-ca.tar.gz" -C "${TMP_DIR}"
    cp -f "${TMP_DIR}/bin/"* "${BIN_DIR}/"

    chmod +x "${BIN_DIR}"/*
    rm -rf "${TMP_DIR}"
    info "  ✓ Fabric binaries installed to ${BIN_DIR}"
}

# ==================== MAIN ====================

main() {
    header "VulnChain Prerequisites Installer"
    check_root

    header "Installing System Tools"
    install_if_missing docker  install_docker
    install_if_missing kubectl install_kubectl
    install_if_missing helm    install_helm
    install_if_missing minikube install_minikube
    install_if_missing go      install_go
    install_if_missing python3 install_python3
    install_if_missing jq      install_jq
    install_if_missing git     install_git

    header "Installing Fabric Binaries"
    local FABRIC_BINS=(cryptogen configtxgen peer orderer osnadmin fabric-ca-client fabric-ca-server)
    local MISSING=false
    for bin in "${FABRIC_BINS[@]}"; do
        if [ ! -f "${BIN_DIR}/${bin}" ]; then
            warn "  ✗ ${bin} not found in ${BIN_DIR}"
            MISSING=true
        fi
    done

    if [ "$MISSING" = true ]; then
        install_fabric_binaries
    else
        info "  ✓ All Fabric binaries present in ${BIN_DIR}"
    fi

    header "Verification"
    echo ""
    for cmd in docker kubectl helm minikube go python3 jq git; do
        if command -v "$cmd" >/dev/null 2>&1; then
            local ver=""
            case "$cmd" in
                docker)   ver=$(docker --version 2>/dev/null | head -1) ;;
                kubectl)  ver=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1) ;;
                helm)     ver=$(helm version --short 2>/dev/null) ;;
                minikube) ver=$(minikube version --short 2>/dev/null) ;;
                go)       ver=$(go version 2>/dev/null) ;;
                python3)  ver=$(python3 --version 2>/dev/null) ;;
                jq)       ver=$(jq --version 2>/dev/null) ;;
                git)      ver=$(git --version 2>/dev/null) ;;
            esac
            info "  ✓ $cmd — $ver"
        else
            warn "  ✗ $cmd — NOT FOUND"
        fi
    done

    echo ""
    info "Fabric binaries in ${BIN_DIR}:"
    ls -1 "${BIN_DIR}/" 2>/dev/null | while read f; do
        info "  ✓ $f"
    done

    echo ""
    info "All prerequisites installed. You can now run:"
    info "  bash fabric/scripts/setup-k8s.sh deploy"
}

main "$@"
