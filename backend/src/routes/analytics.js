const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { optionalAuth } = require('../middleware/auth');

router.get('/summary', optionalAuth, ctrl.getSummary);
router.get('/trends', optionalAuth, ctrl.getTrends);
router.get('/orgs', optionalAuth, ctrl.getOrgStats);

module.exports = router;
