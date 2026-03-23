# VulnChain — Decentralized CVE Management on Blockchain

A decentralized platform for managing Common Vulnerabilities and Exposures (CVE) records using **Hyperledger Fabric** blockchain. VulnChain ensures tamper-proof vulnerability tracking, multi-organization collaboration, and transparent governance through smart contracts.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────────────────────┐
│   Frontend   │────▶│   Backend    │────▶│     Hyperledger Fabric Network      │
│  React/Vite  │     │  Express.js  │     │                                     │
│  Tailwind    │     │  SQLite/JWT  │     │  ┌─────────┐  ┌─────────┐          │
│  Port: 5173  │     │  Port: 4000  │     │  │CNA-Alpha│  │CNA-Beta │          │
└──────────────┘     └──────────────┘     │  │  Peer   │  │  Peer   │          │
                                          │  └────┬────┘  └────┬────┘          │
                                          │       │            │               │
                                          │  ┌────┴────────────┴────┐          │
                                          │  │   Orderer (Raft)     │          │
                                          │  └────┬────────────┬────┘          │
                                          │       │            │               │
                                          │  ┌────┴────┐                      │
                                          │  │Regulator│                      │
                                          │  │  Peer   │                      │
                                          │  └─────────┘                      │
                                          └─────────────────────────────────────┘
```

## Key Features

- **Immutable CVE Records** — All vulnerability records stored on blockchain with full audit trail
- **Multi-Organization** — Three orgs (CNA-Alpha, CNA-Beta, Regulator) with distinct roles
- **Two-Channel Architecture** — `cvepublic` for CVE records, `cveconsortium` for governance
- **CVE Lifecycle Management** — Draft → Under Review → Published → Disputed → Deprecated
- **Weighted Governance** — Proposal/voting system with role-based vote weights
- **Fabric CA Enrollment** — Network-level identity management via Fabric Certificate Authority
- **Role-Based Access Control** — CNA_MEMBER, RESEARCHER, NATIONAL_BODY, PUBLIC roles
- **Dynamic Org Addition** — Add new organizations to the running network
- **Dark Cybersecurity UI** — Modern React frontend with matrix-green theme

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Recharts |
| Backend | Node.js, Express.js, SQLite, Redis, JWT |
| Blockchain | Hyperledger Fabric 2.5.4, Go chaincode |
| Smart Contracts | Go (Fabric Contract API) |
| Orchestration | Kubernetes via Hyperledger Bevel |
| Deployment | Minikube, Helm Charts |

## Project Structure

```
VulnChain/
├── backend/              # REST API server
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── services/     # Fabric gateway, logging
│   │   ├── middleware/    # Auth, RBAC
│   │   ├── routes/       # API routes
│   │   └── models/       # SQLite models
│   └── seed/             # Demo data seeder
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # 10 pages (Landing, Dashboard, CVE, Governance, Analytics)
│   │   ├── components/   # 50+ reusable components
│   │   ├── context/      # Auth context
│   │   └── services/     # API client
├── fabric/               # Blockchain network
│   ├── chaincode/cve/    # Go smart contracts
│   ├── network/          # Channel config, crypto config
│   ├── scripts/          # Deployment scripts
│   ├── bevel/            # K8s Helm values
│   └── config/           # Fabric core/orderer config
├── Diagram/              # Architecture diagrams
└── Report/               # Project documentation
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- Go 1.21+
- Minikube + kubectl + Helm
- Hyperledger Fabric binaries (`peer`, `cryptogen`, `configtxgen`)

### 1. Deploy Fabric Network

```bash
cd fabric/scripts
./setup-k8s.sh up
```

This will:
- Start Minikube cluster
- Generate crypto material
- Deploy CAs, Orderer, and Peers via Bevel Helm charts
- Create channels and join peers
- Install and commit chaincode
- Extract wallet credentials
- Start port forwards

### 2. Start Backend

```bash
cd backend
cp .env.example .env    # Edit as needed
npm install
npm run dev
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Seed Demo Data

```bash
cd backend
npm run demo
# Select option 7 for full demo
```

This creates 10 users (enrolled with Fabric CA), 25 CVEs, lifecycle transitions, and governance proposals.

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user | No |
| POST | `/api/auth/login` | Login (returns JWT) | No |
| GET | `/api/cve` | List all CVEs | Optional |
| POST | `/api/cve` | Create CVE | CNA_MEMBER, RESEARCHER |
| GET | `/api/cve/:id` | Get CVE details | Optional |
| PUT | `/api/cve/:id/status` | Transition CVE status | CNA_MEMBER, NATIONAL_BODY |
| POST | `/api/governance/propose` | Create proposal | CNA_MEMBER, NATIONAL_BODY |
| POST | `/api/governance/:id/vote` | Vote on proposal | CNA_MEMBER, NATIONAL_BODY |
| GET | `/api/governance/:id/tally` | Tally votes | Yes |
| GET | `/api/analytics/summary` | Platform statistics | Yes |

## Chaincode (Smart Contracts)

Two contracts deployed on both channels:

### CVE Contract (`cve_contract.go`)
- `CreateCVE` — Submit new vulnerability record
- `UpdateCVEStatus` — Transition through lifecycle states
- `GetCVE` / `GetAllCVEs` — Query records
- `GetCVEHistory` — Full audit trail from blockchain

### Governance Contract (`governance_contract.go`)
- `CreateProposal` — Submit governance proposal
- `VoteOnProposal` — Cast weighted vote
- `TallyVotes` — Count votes and determine outcome
- `GetProposal` / `GetAllProposals` — Query proposals

## Network Management

```bash
# Check network status
./fabric/scripts/setup-k8s.sh status

# Restart port forwards
./fabric/scripts/setup-k8s.sh portfwd

# Add new organization
./fabric/scripts/add-org.sh <name> <msp-id> <port> <nodeport>

# Tear down everything
./fabric/scripts/setup-k8s.sh down
```

## Default Demo Credentials

| Username | Role | Organization |
|----------|------|-------------|
| cna_alpha_admin | CNA_MEMBER | CNA-Alpha |
| cna_beta_admin | CNA_MEMBER | CNA-Beta |
| regulator_admin | NATIONAL_BODY | Regulator |
| researcher1 | RESEARCHER | CNA-Alpha |
| public_user | PUBLIC | — |

Password for all demo users: `Demo@123`

## Screenshots

The frontend features a dark cybersecurity theme with:
- Landing page with matrix-green accents
- Dashboard with KPI cards and recent CVEs
- CVE list with severity/status filtering
- CVE detail with blockchain audit trail
- Governance proposals with voting interface
- Analytics with charts and org statistics

## License

This project is developed as a Major Project at CHARUSAT University.
