const router = require('express').Router();
const ctrl = require('../controllers/cveController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/', optionalAuth, ctrl.listCVEs);
router.get('/search', optionalAuth, ctrl.searchCVEs);
router.post('/', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN', 'RESEARCHER'), ctrl.createValidation, ctrl.createCVE);
router.get('/:id', optionalAuth, ctrl.getCVE);
router.put('/:id', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.updateCVE);
router.put('/:id/status', authenticate, requireRole('CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'), ctrl.transitionStatus);
router.get('/:id/history', optionalAuth, ctrl.getCVEHistory);

module.exports = router;
