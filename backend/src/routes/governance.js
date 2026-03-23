const router = require('express').Router();
const ctrl = require('../controllers/governanceController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/proposals', optionalAuth, ctrl.listProposals);
router.post('/proposals', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.createProposalValidation, ctrl.createProposal);
router.get('/proposals/:id', optionalAuth, ctrl.getProposal);
router.put('/proposals/:id/activate', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.activateProposal);
router.post('/proposals/:id/vote', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.vote);
router.post('/proposals/:id/tally', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.tally);
router.post('/proposals/:id/enact', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.enactProposal);

module.exports = router;
