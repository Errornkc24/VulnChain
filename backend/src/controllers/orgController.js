const { body, validationResult } = require('express-validator');
const fabricService = require('../services/fabricService');
const orgOrchestrator = require('../services/orgOrchestrator');
const cache = require('../config/redis');
const logger = require('../services/logger');

const createOrgProposalValidation = [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('metadata.orgMspId').trim().notEmpty().withMessage('Organization MSP ID required'),
  body('metadata.orgName').trim().notEmpty().withMessage('Organization name required'),
  body('metadata.orgType').optional().isIn(['CNA', 'NATIONAL_BODY', 'RESEARCHER']),
  body('metadata.voteWeight').optional().isInt({ min: 1, max: 10 }),
];

async function createOrgProposal(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const proposalData = JSON.stringify({
      title: req.body.title,
      description: req.body.description,
      type: 'CNA_MEMBERSHIP',
      quorum: req.body.quorum || 60,
      threshold: req.body.threshold || 66,
      metadata: req.body.metadata,
    });

    const proposalId = await fabricService.submitTransaction(
      'governance:CreateProposal', [proposalData], req.user
    );
    await cache.del('proposals:all');
    logger.info(`Org membership proposal created: ${proposalId} for ${req.body.metadata.orgMspId}`);
    res.status(201).json({ proposalId, message: 'CNA membership proposal created' });
  } catch (err) {
    logger.error('Create org proposal error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function listOrganizations(req, res) {
  try {
    const { status } = req.query;
    let result;

    if (status === 'ACTIVE') {
      result = await fabricService.evaluateTransaction('governance:GetActiveOrganizations', [], req.user);
    } else {
      const cached = await cache.get('orgs:all');
      if (cached) return res.json({ organizations: cached });
      result = await fabricService.evaluateTransaction('governance:GetAllOrganizations', [], req.user);
    }

    const organizations = JSON.parse(result);
    if (!status) await cache.set('orgs:all', organizations, 120);
    res.json({ organizations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOrganization(req, res) {
  try {
    const result = await fabricService.evaluateTransaction(
      'governance:GetOrganization', [req.params.mspId], req.user
    );
    res.json({ organization: JSON.parse(result) });
  } catch (err) {
    res.status(err.message.includes('does not exist') ? 404 : 500).json({ error: err.message });
  }
}

async function activateOrg(req, res) {
  try {
    await fabricService.submitTransaction(
      'governance:ActivateOrg', [req.params.mspId], req.user
    );
    await cache.del('orgs:all');
    logger.info(`Organization activated: ${req.params.mspId} by ${req.user.username}`);
    res.json({ message: `Organization ${req.params.mspId} activated` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function suspendOrg(req, res) {
  try {
    await fabricService.submitTransaction(
      'governance:SuspendOrg', [req.params.mspId], req.user
    );
    await cache.del('orgs:all');
    logger.info(`Organization suspended: ${req.params.mspId} by ${req.user.username}`);
    res.json({ message: `Organization ${req.params.mspId} suspended` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Trigger Fabric-level onboarding (deploys peer, joins channels, installs chaincode)
 * Called after a CNA_MEMBERSHIP proposal has been enacted on the ledger
 */
async function onboardOrg(req, res) {
  try {
    const { mspId } = req.params;
    const { orgShortName } = req.body;

    if (!orgShortName) {
      return res.status(400).json({ error: 'orgShortName required (e.g. "cna-gamma")' });
    }

    // Verify the org exists on ledger and is PENDING
    const orgResult = await fabricService.evaluateTransaction(
      'governance:GetOrganization', [mspId], req.user
    );
    const org = JSON.parse(orgResult);
    if (org.status !== 'PENDING' && org.status !== 'SUSPENDED') {
      return res.status(400).json({
        error: `Organization ${mspId} is ${org.status}, expected PENDING`,
      });
    }

    const job = orgOrchestrator.startOnboarding(orgShortName, mspId, org.proposalId || '');
    if (job.error) {
      return res.status(409).json(job);
    }

    await cache.del('orgs:all');
    res.status(202).json({
      message: `Fabric onboarding started for ${mspId}`,
      ...job,
    });
  } catch (err) {
    logger.error('Onboard org error:', err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get onboarding job status
 */
function getOnboardingStatus(req, res) {
  const job = orgOrchestrator.getJob(req.params.mspId);
  if (!job) {
    return res.status(404).json({ error: 'No onboarding job found' });
  }
  res.json({ job });
}

/**
 * List all onboarding jobs
 */
function listOnboardingJobs(req, res) {
  res.json({ jobs: orgOrchestrator.getAllJobs() });
}

module.exports = {
  createOrgProposal,
  createOrgProposalValidation,
  listOrganizations,
  getOrganization,
  activateOrg,
  suspendOrg,
  onboardOrg,
  getOnboardingStatus,
  listOnboardingJobs,
};
