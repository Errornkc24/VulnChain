# VulnChain Fabric Network

Hyperledger Fabric 2.5.4 blockchain network deployed on Kubernetes via Hyperledger Bevel.

## Network Topology

- **3 Organizations**: CNA-Alpha, CNA-Beta, Regulator
- **1 Orderer**: Raft consensus (single-node)
- **3 Peers**: One per org with CouchDB state database
- **3 Fabric CAs**: One per org for identity management
- **2 Channels**: `cvepublic` (CVE records), `cveconsortium` (governance)

## Chaincode

Smart contracts written in Go (`chaincode/cve/`):

- **CVE Contract** — CreateCVE, UpdateCVEStatus, GetCVE, GetAllCVEs, GetCVEHistory
- **Governance Contract** — CreateProposal, VoteOnProposal, TallyVotes, GetAllProposals

## Deployment

### Kubernetes (Bevel)

```bash
cd scripts
./setup-k8s.sh up      # Full deploy
./setup-k8s.sh down     # Teardown
./setup-k8s.sh status   # Check status
./setup-k8s.sh chaincode  # Redeploy chaincode only
./setup-k8s.sh portfwd    # Restart port forwards
```

### Add Organization

```bash
./scripts/add-org.sh <org-name> <msp-id> <port> <nodeport>
```

## Port Forwards (after deploy)

| Service | Local Port |
|---------|-----------|
| peer0-cna-alpha | 7051 |
| peer0-cna-beta | 9051 |
| peer0-regulator | 11051 |
| orderer0 | 7050 |
| redis | 6379 |
