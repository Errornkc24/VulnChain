const fabricService = require('../services/fabricService');
const cache = require('../config/redis');

async function getSummary(req, res) {
  try {
    const cached = await cache.get('analytics:summary');
    if (cached) return res.json(cached);

    const result = await fabricService.evaluateTransaction('cve:GetCVECount', [], req.user);
    const counts = JSON.parse(result);

    const allCVEs = JSON.parse(await fabricService.evaluateTransaction('cve:GetAllCVEs', [], req.user));
    const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFORMATIONAL: 0 };
    allCVEs.forEach(c => { if (severityCounts[c.severity] !== undefined) severityCounts[c.severity]++; });

    const summary = { statusCounts: counts, severityCounts };
    await cache.set('analytics:summary', summary, 60);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTrends(req, res) {
  try {
    const cached = await cache.get('analytics:trends');
    if (cached) return res.json(cached);

    const allCVEs = JSON.parse(await fabricService.evaluateTransaction('cve:GetAllCVEs', [], req.user));
    const monthly = {};

    allCVEs.forEach(cve => {
      const month = cve.createdAt.substring(0, 7); // YYYY-MM
      if (!monthly[month]) monthly[month] = { month, total: 0, critical: 0, high: 0, medium: 0, low: 0 };
      monthly[month].total++;
      const sev = cve.severity.toLowerCase();
      if (monthly[month][sev] !== undefined) monthly[month][sev]++;
    });

    const trends = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));
    await cache.set('analytics:trends', trends, 60);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOrgStats(req, res) {
  try {
    const allCVEs = JSON.parse(await fabricService.evaluateTransaction('cve:GetAllCVEs', [], req.user));
    const orgStats = {};

    allCVEs.forEach(cve => {
      const org = cve.submitterOrg || 'Unknown';
      if (!orgStats[org]) orgStats[org] = { org, total: 0, published: 0, draft: 0 };
      orgStats[org].total++;
      if (cve.status === 'PUBLISHED') orgStats[org].published++;
      if (cve.status === 'DRAFT') orgStats[org].draft++;
    });

    res.json(Object.values(orgStats));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getSummary, getTrends, getOrgStats };
