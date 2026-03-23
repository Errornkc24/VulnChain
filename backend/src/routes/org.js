const router = require('express').Router();
const ctrl = require('../controllers/orgController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// List all organizations (public)
router.get('/', optionalAuth, ctrl.listOrganizations);

// Get specific organization
router.get('/:mspId', optionalAuth, ctrl.getOrganization);

// Create CNA_MEMBERSHIP governance proposal to add new org
router.post('/propose', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.createOrgProposalValidation, ctrl.createOrgProposal);

// Activate a pending organization (after Fabric infra is set up)
router.put('/:mspId/activate', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.activateOrg);

// Suspend an organization (regulator only)
router.put('/:mspId/suspend', authenticate, requireRole('NATIONAL_BODY', 'ADMIN'), ctrl.suspendOrg);

// Trigger Fabric-level onboarding (deploy peer, join channels, install CC)
router.post('/:mspId/onboard', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.onboardOrg);

// Get onboarding job status
router.get('/:mspId/onboard/status', authenticate, ctrl.getOnboardingStatus);

// List all onboarding jobs
router.get('/jobs/onboarding', authenticate, ctrl.listOnboardingJobs);

module.exports = router;
