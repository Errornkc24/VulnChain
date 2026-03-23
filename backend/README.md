# VulnChain Backend API

REST API server for the VulnChain platform. Connects to Hyperledger Fabric blockchain for CVE and governance operations.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | API server port |
| JWT_SECRET | — | Secret for JWT signing |
| JWT_EXPIRY | 24h | Token expiration |
| REDIS_HOST | localhost | Redis cache host |
| REDIS_PORT | 6379 | Redis cache port |
| FABRIC_CHANNEL_PUBLIC | cvepublic | Public CVE channel |
| FABRIC_CHANNEL_CONSORTIUM | cveconsortium | Governance channel |
| FABRIC_CHAINCODE_NAME | cve-chaincode | Chaincode name |
| FABRIC_MSP_ID | CNAAlphaMSP | Default MSP ID |
| FABRIC_PEER_ENDPOINT | localhost:7051 | Peer gRPC endpoint |
| DB_PATH | ./data/users.db | SQLite database path |

## Scripts

- `npm run dev` — Start with nodemon (auto-reload)
- `npm start` — Production start
- `npm run seed` — Seed dummy CVE data
- `npm run demo` — Interactive demo seeder (users, CVEs, governance)

## API Routes

- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login
- `GET /api/cve` — List CVEs
- `POST /api/cve` — Create CVE
- `GET /api/cve/:id` — CVE details
- `PUT /api/cve/:id/status` — Update CVE status
- `POST /api/governance/propose` — Create proposal
- `POST /api/governance/:id/vote` — Vote
- `GET /api/governance/:id/tally` — Tally votes
- `GET /api/analytics/summary` — Platform stats

## Multi-Org Support

The backend supports multiple Fabric organizations through wallet files:
- `wallet/admin-{cert,key,tlsca}.pem` — CNA-Alpha (default)
- `wallet/cna-beta-{cert,key,tlsca}.pem` — CNA-Beta
- `wallet/regulator-{cert,key,tlsca}.pem` — Regulator
- `wallet/*-config.json` — Dynamically added orgs
