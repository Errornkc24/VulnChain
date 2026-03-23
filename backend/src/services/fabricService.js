const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fabricConfig = require('../config/fabric');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

// ─── Wallet / Identity helpers ─────────────────────────────────────────
const WALLET_DIR = path.resolve(__dirname, '../../wallet');

// Org-specific crypto paths
const orgCrypto = {
  CNAAlphaMSP: {
    cert: path.join(WALLET_DIR, 'admin-cert.pem'),
    key: path.join(WALLET_DIR, 'admin-key.pem'),
    tlsCa: path.join(WALLET_DIR, 'admin-tlsca.pem'),
    peerEndpoint: 'localhost:7051',
    peerHostAlias: 'peer0.cna-alpha.cve.local',
  },
  CNABetaMSP: {
    cert: path.join(WALLET_DIR, 'cna-beta-cert.pem'),
    key: path.join(WALLET_DIR, 'cna-beta-key.pem'),
    tlsCa: path.join(WALLET_DIR, 'cna-beta-tlsca.pem'),
    peerEndpoint: 'localhost:9051',
    peerHostAlias: 'peer0.cna-beta.cve.local',
  },
  RegulatorMSP: {
    cert: path.join(WALLET_DIR, 'regulator-cert.pem'),
    key: path.join(WALLET_DIR, 'regulator-key.pem'),
    tlsCa: path.join(WALLET_DIR, 'regulator-tlsca.pem'),
    peerEndpoint: 'localhost:11051',
    peerHostAlias: 'peer0.regulator.cve.local',
  },
};

// Auto-load dynamic org configs from wallet/*-config.json (created by add-org.sh)
try {
  const configFiles = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith('-config.json'));
  for (const file of configFiles) {
    const cfg = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, file), 'utf8'));
    if (cfg.mspId && !orgCrypto[cfg.mspId]) {
      orgCrypto[cfg.mspId] = {
        cert: path.join(WALLET_DIR, cfg.cert),
        key: path.join(WALLET_DIR, cfg.key),
        tlsCa: path.join(WALLET_DIR, cfg.tlsCa),
        peerEndpoint: cfg.peerEndpoint,
        peerHostAlias: cfg.peerHostAlias,
      };
      logger.info(`Loaded dynamic org: ${cfg.mspId} from ${file}`);
    }
  }
} catch (e) { /* wallet dir may not exist yet */ }

// Cache gateway connections per org
const gatewayCache = {};

async function getGateway(mspId) {
  if (gatewayCache[mspId]) return gatewayCache[mspId];

  // Check static config first, then dynamic (runtime-registered) orgs
  let orgConf = orgCrypto[mspId];
  if (!orgConf && global._dynamicOrgCrypto) {
    orgConf = global._dynamicOrgCrypto[mspId];
  }
  if (!orgConf) throw new Error(`No crypto configured for org ${mspId}`);

  const tlsCert = fs.readFileSync(orgConf.tlsCa);
  const credentials = grpc.credentials.createSsl(tlsCert);
  const client = new grpc.Client(orgConf.peerEndpoint, credentials, {
    'grpc.ssl_target_name_override': orgConf.peerHostAlias,
  });

  const certPem = fs.readFileSync(orgConf.cert);
  const keyPem = fs.readFileSync(orgConf.key);
  const privateKey = crypto.createPrivateKey(keyPem);

  const gateway = connect({
    client,
    identity: { mspId, credentials: certPem },
    signer: signers.newPrivateKeySigner(privateKey),
    evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
    endorseOptions: () => ({ deadline: Date.now() + 30000 }),
    submitOptions: () => ({ deadline: Date.now() + 30000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  gatewayCache[mspId] = { gateway, client };
  logger.info(`Fabric gateway connected for ${mspId} → ${orgConf.peerEndpoint}`);
  return { gateway, client };
}

function parseContractFunction(functionName) {
  // functionName format: "cve:CreateCVE" or "governance:VoteOnProposal"
  const [contractName, fn] = functionName.split(':');
  return { contractName, fn };
}

// ─── In-memory demo store (kept for DEMO_MODE) ────────────────────────
const demoStore = {
  cves: new Map(),
  proposals: new Map(),
  cveCounter: 0,
  proposalCounter: 0,
};

function generateCVEId() {
  demoStore.cveCounter++;
  const year = new Date().getFullYear();
  return `CVE-${year}-${String(demoStore.cveCounter).padStart(5, '0')}`;
}

function generateProposalId() {
  demoStore.proposalCounter++;
  return `PROP-${String(demoStore.proposalCounter).padStart(5, '0')}`;
}

function severityFromCVSS(score) {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  if (score >= 0.1) return 'LOW';
  return 'INFORMATIONAL';
}

// Demo mode implementations
const demoHandlers = {
  'cve:CreateCVE': (args, userOrg, userId) => {
    const data = JSON.parse(args[0]);
    const cveId = generateCVEId();
    const now = new Date().toISOString();
    const cve = {
      docType: 'cve',
      cveId,
      title: data.title || '',
      description: data.description || '',
      affectedProduct: data.affectedProduct || '',
      affectedVersions: data.affectedVersions || [],
      cpeIdentifiers: data.cpeIdentifiers || [],
      cvssScore: data.cvssScore || 0,
      cvssVector: data.cvssVector || '',
      severity: data.severity || severityFromCVSS(data.cvssScore || 0),
      cweId: data.cweId || '',
      cweDescription: data.cweDescription || '',
      status: 'DRAFT',
      submitterOrg: userOrg || 'CNAAlphaMSP',
      submitterUser: userId || 'demo-user',
      ownerOrg: userOrg || 'CNAAlphaMSP',
      embargoDate: data.embargoDate || '',
      patchInfo: data.patchInfo || '',
      references: data.references || [],
      history: [{ action: 'CREATED', actor: userId, actorOrg: userOrg, timestamp: now, notes: 'CVE record created', newValue: 'DRAFT' }],
      createdAt: now,
      updatedAt: now,
    };
    demoStore.cves.set(cveId, cve);
    return cveId;
  },

  'cve:UpdateCVE': (args) => {
    const [cveId, updateJSON] = args;
    const cve = demoStore.cves.get(cveId);
    if (!cve) throw new Error(`CVE ${cveId} not found`);
    if (cve.status !== 'DRAFT' && cve.status !== 'UNDER_REVIEW') {
      throw new Error(`CVE can only be updated in DRAFT or UNDER_REVIEW status`);
    }
    const updates = JSON.parse(updateJSON);
    Object.assign(cve, updates, { updatedAt: new Date().toISOString() });
    cve.history.push({ action: 'UPDATED', actor: 'demo-user', actorOrg: cve.ownerOrg, timestamp: new Date().toISOString(), notes: 'CVE updated' });
    demoStore.cves.set(cveId, cve);
    return 'success';
  },

  'cve:TransitionStatus': (args) => {
    const [cveId, newStatus, notes] = args;
    const cve = demoStore.cves.get(cveId);
    if (!cve) throw new Error(`CVE ${cveId} not found`);
    const oldStatus = cve.status;
    cve.status = newStatus;
    cve.updatedAt = new Date().toISOString();
    cve.history.push({ action: 'STATUS_CHANGE', actor: 'demo-user', actorOrg: cve.ownerOrg, timestamp: new Date().toISOString(), notes: notes || '', oldValue: oldStatus, newValue: newStatus });
    demoStore.cves.set(cveId, cve);
    return 'success';
  },

  'cve:GetCVE': (args) => {
    const cve = demoStore.cves.get(args[0]);
    if (!cve) throw new Error(`CVE ${args[0]} not found`);
    return JSON.stringify(cve);
  },

  'cve:GetAllCVEs': () => {
    const all = Array.from(demoStore.cves.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return JSON.stringify(all);
  },

  'cve:QueryCVEs': (args) => {
    const filter = JSON.parse(args[0]);
    let results = Array.from(demoStore.cves.values());
    if (filter.status) results = results.filter(c => c.status === filter.status);
    if (filter.severity) results = results.filter(c => c.severity === filter.severity);
    if (filter.product) results = results.filter(c => c.affectedProduct.toLowerCase().includes(filter.product.toLowerCase()));
    return JSON.stringify(results.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  'cve:GetCVEsByStatus': (args) => {
    const results = Array.from(demoStore.cves.values()).filter(c => c.status === args[0]);
    return JSON.stringify(results);
  },

  'cve:GetCVEsByProduct': (args) => {
    const results = Array.from(demoStore.cves.values()).filter(c => c.affectedProduct.toLowerCase().includes(args[0].toLowerCase()));
    return JSON.stringify(results);
  },

  'cve:GetCVEsBySeverity': (args) => {
    const results = Array.from(demoStore.cves.values()).filter(c => c.severity === args[0]);
    return JSON.stringify(results);
  },

  'cve:GetCVEHistory': (args) => {
    const cve = demoStore.cves.get(args[0]);
    if (!cve) throw new Error(`CVE ${args[0]} not found`);
    return JSON.stringify(cve.history);
  },

  'cve:GetCVECount': () => {
    const cves = Array.from(demoStore.cves.values());
    const counts = {
      draft: cves.filter(c => c.status === 'DRAFT').length,
      underReview: cves.filter(c => c.status === 'UNDER_REVIEW').length,
      embargoed: cves.filter(c => c.status === 'EMBARGOED').length,
      published: cves.filter(c => c.status === 'PUBLISHED').length,
      disputed: cves.filter(c => c.status === 'DISPUTED').length,
      deprecated: cves.filter(c => c.status === 'DEPRECATED').length,
      rejected: cves.filter(c => c.status === 'REJECTED').length,
      total: cves.length,
    };
    return JSON.stringify(counts);
  },

  'cve:SearchCVEs': (args) => {
    const term = args[0].toLowerCase();
    const results = Array.from(demoStore.cves.values()).filter(c =>
      c.title.toLowerCase().includes(term) ||
      c.description.toLowerCase().includes(term) ||
      c.affectedProduct.toLowerCase().includes(term)
    );
    return JSON.stringify(results);
  },

  'governance:CreateProposal': (args, userOrg, userId) => {
    const data = JSON.parse(args[0]);
    const proposalId = generateProposalId();
    const now = new Date().toISOString();
    const proposal = {
      docType: 'proposal',
      proposalId,
      title: data.title,
      description: data.description,
      type: data.type || 'POLICY_CHANGE',
      proposerOrg: userOrg || 'CNAAlphaMSP',
      proposerUser: userId || 'demo-user',
      status: 'PROPOSED',
      votes: {},
      quorum: data.quorum || 60,
      threshold: data.threshold || 66,
      createdAt: now,
      expiresAt: data.expiresAt || '',
      enactedAt: '',
    };
    demoStore.proposals.set(proposalId, proposal);
    return proposalId;
  },

  'governance:ActivateProposal': (args) => {
    const proposal = demoStore.proposals.get(args[0]);
    if (!proposal) throw new Error(`Proposal ${args[0]} not found`);
    proposal.status = 'ACTIVE';
    demoStore.proposals.set(args[0], proposal);
    return 'success';
  },

  'governance:VoteOnProposal': (args, userOrg, userId) => {
    const [proposalId, decision, reason] = args;
    const proposal = demoStore.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
    if (proposal.status !== 'ACTIVE') throw new Error('Can only vote on ACTIVE proposals');
    if (proposal.votes[userOrg]) throw new Error(`${userOrg} has already voted`);

    const weights = { CNAAlphaMSP: 1, CNABetaMSP: 1, RegulatorMSP: 3 };
    proposal.votes[userOrg] = {
      voterOrg: userOrg, voterUser: userId, decision, weight: weights[userOrg] || 1,
      timestamp: new Date().toISOString(), reason: reason || '',
    };
    demoStore.proposals.set(proposalId, proposal);
    return 'success';
  },

  'governance:TallyVotes': (args) => {
    const proposal = demoStore.proposals.get(args[0]);
    if (!proposal) throw new Error(`Proposal ${args[0]} not found`);

    const totalPossible = 5; // 1+1+3
    let yesW = 0, noW = 0, abstainW = 0, totalW = 0;
    Object.values(proposal.votes).forEach(v => {
      totalW += v.weight;
      if (v.decision === 'YES') yesW += v.weight;
      else if (v.decision === 'NO') noW += v.weight;
      else abstainW += v.weight;
    });

    const participation = Math.round((totalW / totalPossible) * 100);
    const active = yesW + noW;
    const approval = active > 0 ? Math.round((yesW / active) * 100) : 0;
    const quorumMet = participation >= proposal.quorum;
    const thresholdMet = approval >= proposal.threshold;

    proposal.status = (quorumMet && thresholdMet) ? 'PASSED' : 'REJECTED';
    demoStore.proposals.set(args[0], proposal);

    return JSON.stringify({
      proposalId: args[0], status: proposal.status, totalVotes: Object.keys(proposal.votes).length,
      yesWeight: yesW, noWeight: noW, abstainWeight: abstainW, participation, approvalRate: approval,
      quorumRequired: proposal.quorum, quorumMet, thresholdReq: proposal.threshold, thresholdMet,
    });
  },

  'governance:EnactProposal': (args) => {
    const proposal = demoStore.proposals.get(args[0]);
    if (!proposal) throw new Error(`Proposal ${args[0]} not found`);
    proposal.status = 'ENACTED';
    proposal.enactedAt = new Date().toISOString();
    demoStore.proposals.set(args[0], proposal);
    return 'success';
  },

  'governance:GetProposal': (args) => {
    const proposal = demoStore.proposals.get(args[0]);
    if (!proposal) throw new Error(`Proposal ${args[0]} not found`);
    return JSON.stringify(proposal);
  },

  'governance:GetAllProposals': () => {
    return JSON.stringify(Array.from(demoStore.proposals.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  'governance:GetProposalsByStatus': (args) => {
    const results = Array.from(demoStore.proposals.values()).filter(p => p.status === args[0]);
    return JSON.stringify(results);
  },
};

// Map role to MSP ID
function roleToMSP(role, org) {
  if (org) {
    if (org.toLowerCase().includes('alpha')) return 'CNAAlphaMSP';
    if (org.toLowerCase().includes('beta')) return 'CNABetaMSP';
    if (org.toLowerCase().includes('regulator')) return 'RegulatorMSP';
  }
  switch (role) {
    case 'CNA_MEMBER': return 'CNAAlphaMSP';
    case 'NATIONAL_BODY': return 'RegulatorMSP';
    case 'ADMIN': return 'CNAAlphaMSP';
    default: return '';
  }
}

// Determine which channel to use based on function name
function getChannel(functionName) {
  // Governance always on consortium channel; CVE queries on public, writes on public
  if (functionName.startsWith('governance:')) return fabricConfig.channelConsortium;
  return fabricConfig.channelPublic;
}

// Read-only functions that use evaluateTransaction instead of submitTransaction
const READ_FUNCTIONS = new Set([
  'cve:GetCVE', 'cve:GetAllCVEs', 'cve:QueryCVEs', 'cve:GetCVEsByStatus',
  'cve:GetCVEsByProduct', 'cve:GetCVEsBySeverity', 'cve:GetCVEHistory',
  'cve:GetCVECount', 'cve:SearchCVEs',
  'governance:GetProposal', 'governance:GetAllProposals', 'governance:GetProposalsByStatus',
  'governance:GetOrganization', 'governance:GetAllOrganizations', 'governance:GetActiveOrganizations',
]);

async function submitTransaction(functionName, args = [], user = null) {
  const userOrg = user ? roleToMSP(user.role, user.organization) : 'CNAAlphaMSP';
  const userId = user ? user.username : 'system';

  if (fabricConfig.demoMode) {
    logger.info(`[DEMO] ${functionName}(${args.map(a => a.substring(0, 80)).join(', ')})`);
    const handler = demoHandlers[functionName];
    if (!handler) throw new Error(`Unknown chaincode function: ${functionName}`);
    return handler(args, userOrg, userId);
  }

  // ─── Real Fabric Gateway ───────────────────────────────────────────
  const mspId = userOrg || fabricConfig.mspId;
  const { contractName, fn } = parseContractFunction(functionName);
  const channelName = getChannel(functionName);

  logger.info(`[FABRIC] ${functionName} → ${channelName}/${fabricConfig.chaincodeName}/${contractName}:${fn} as ${mspId}`);

  const { gateway } = await getGateway(mspId);
  const network = gateway.getNetwork(channelName);
  const contract = network.getContract(fabricConfig.chaincodeName, contractName);

  let result;
  if (READ_FUNCTIONS.has(functionName)) {
    const resultBytes = await contract.evaluateTransaction(fn, ...args);
    result = new TextDecoder().decode(resultBytes);
  } else {
    const resultBytes = await contract.submitTransaction(fn, ...args);
    result = new TextDecoder().decode(resultBytes);
  }

  logger.info(`[FABRIC] ${functionName} result: ${result.substring(0, 200)}`);
  return result;
}

async function evaluateTransaction(functionName, args = [], user = null) {
  return submitTransaction(functionName, args, user);
}

// Graceful shutdown
function closeGateways() {
  for (const [mspId, cached] of Object.entries(gatewayCache)) {
    try {
      cached.gateway.close();
      cached.client.close();
      logger.info(`Gateway closed for ${mspId}`);
    } catch (e) {
      logger.warn(`Error closing gateway for ${mspId}: ${e.message}`);
    }
  }
}

process.on('SIGTERM', closeGateways);
process.on('SIGINT', closeGateways);

module.exports = { submitTransaction, evaluateTransaction, demoStore, roleToMSP };
