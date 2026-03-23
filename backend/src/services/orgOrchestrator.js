const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

const ADD_ORG_SCRIPT = path.resolve(__dirname, '../../../fabric/scripts/add-org.sh');
const WALLET_DIR = path.resolve(__dirname, '../../wallet');
const FABRIC_SERVICE_PATH = path.resolve(__dirname, './fabricService.js');

// Port allocation: start from 13051, increment by 2000 per org
// NodePort base: start from 32051, increment by 100 per org
let nextPeerPort = 13051;
let nextNodePortBase = 32051;

// Track running onboarding processes
const onboardingJobs = new Map();

/**
 * Trigger Fabric-level org onboarding after governance enactment
 * @param {string} orgShortName - e.g. "cna-gamma"
 * @param {string} mspId - e.g. "CNAGammaMSP"
 * @param {string} proposalId - the governance proposal that approved this org
 * @returns {object} job info
 */
function startOnboarding(orgShortName, mspId, proposalId) {
  if (onboardingJobs.has(mspId)) {
    const existing = onboardingJobs.get(mspId);
    if (existing.status === 'running') {
      return { error: `Onboarding already in progress for ${mspId}`, job: existing };
    }
  }

  const peerPort = nextPeerPort;
  const nodePortBase = nextNodePortBase;
  nextPeerPort += 2000;
  nextNodePortBase += 100;

  const job = {
    mspId,
    orgShortName,
    proposalId,
    peerPort,
    nodePortBase,
    status: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    output: '',
    error: null,
  };

  onboardingJobs.set(mspId, job);

  const cmd = `bash ${ADD_ORG_SCRIPT} ${orgShortName} ${mspId} ${peerPort} ${nodePortBase}`;
  logger.info(`[ORG-ONBOARD] Starting: ${cmd}`);

  const child = exec(cmd, { timeout: 600000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    job.output = stdout + '\n' + stderr;
    job.completedAt = new Date().toISOString();

    if (error) {
      job.status = 'failed';
      job.error = error.message;
      logger.error(`[ORG-ONBOARD] Failed for ${mspId}: ${error.message}`);
    } else {
      job.status = 'completed';
      logger.info(`[ORG-ONBOARD] Completed for ${mspId}`);

      // Auto-register the new org in fabricService orgCrypto
      try {
        registerOrgCrypto(orgShortName, mspId, peerPort);
      } catch (e) {
        logger.warn(`[ORG-ONBOARD] Failed to auto-register crypto: ${e.message}`);
      }
    }
  });

  child.stdout.on('data', (data) => {
    job.output += data;
  });
  child.stderr.on('data', (data) => {
    job.output += data;
  });

  return { status: 'started', mspId, peerPort, nodePortBase };
}

/**
 * Dynamically add org crypto config to fabricService at runtime
 */
function registerOrgCrypto(orgShortName, mspId, peerPort) {
  const orgDomain = `${orgShortName}.cve.local`;
  const certPath = path.join(WALLET_DIR, `${orgShortName}-cert.pem`);
  const keyPath = path.join(WALLET_DIR, `${orgShortName}-key.pem`);
  const tlsCaPath = path.join(WALLET_DIR, `${orgShortName}-tlsca.pem`);

  // Check wallet files exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath) || !fs.existsSync(tlsCaPath)) {
    throw new Error(`Wallet files not found for ${orgShortName}`);
  }

  // Dynamically inject into fabricService's orgCrypto at runtime
  // This works because fabricService.js exports orgCrypto by reference
  try {
    const fabricService = require('./fabricService');
    // Access the orgCrypto object — we need to export it
    // Since we can't modify the cached module, we'll use the dynamic registry
    if (!global._dynamicOrgCrypto) {
      global._dynamicOrgCrypto = {};
    }
    global._dynamicOrgCrypto[mspId] = {
      cert: certPath,
      key: keyPath,
      tlsCa: tlsCaPath,
      peerEndpoint: `localhost:${peerPort}`,
      peerHostAlias: `peer0.${orgDomain}`,
    };
    logger.info(`[ORG-ONBOARD] Registered crypto for ${mspId} at runtime`);
  } catch (e) {
    logger.warn(`[ORG-ONBOARD] Runtime registration failed: ${e.message}`);
  }
}

/**
 * Get onboarding job status
 */
function getJob(mspId) {
  return onboardingJobs.get(mspId) || null;
}

/**
 * List all onboarding jobs
 */
function getAllJobs() {
  return Array.from(onboardingJobs.values());
}

module.exports = {
  startOnboarding,
  getJob,
  getAllJobs,
  registerOrgCrypto,
};
