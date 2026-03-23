const { body, query, validationResult } = require('express-validator');
const fabricService = require('../services/fabricService');
const cache = require('../config/redis');
const logger = require('../services/logger');

const createValidation = [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('affectedProduct').trim().notEmpty().withMessage('Affected product required'),
  body('cvssScore').isFloat({ min: 0, max: 10 }).withMessage('CVSS score must be 0-10'),
];

async function createCVE(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const cveData = JSON.stringify(req.body);
    const cveId = await fabricService.submitTransaction('cve:CreateCVE', [cveData], req.user);
    await cache.del('cves:all');
    logger.info(`CVE created: ${cveId} by ${req.user.username}`);
    res.status(201).json({ cveId, message: 'CVE created successfully' });
  } catch (err) {
    logger.error('Create CVE error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function listCVEs(req, res) {
  try {
    const cacheKey = `cves:all:${req.user ? req.user.role : 'public'}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ cves: cached });

    const result = await fabricService.evaluateTransaction('cve:GetAllCVEs', [], req.user);
    let cves = JSON.parse(result);

    if (!req.user || req.user.role === 'PUBLIC') {
      cves = cves.filter(c => c.status === 'PUBLISHED');
    }

    await cache.set(cacheKey, cves, 60);
    res.json({ cves });
  } catch (err) {
    logger.error('List CVEs error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getCVE(req, res) {
  try {
    const { id } = req.params;
    const cacheKey = `cve:${id}`;
    const cached = await cache.get(cacheKey);
    if (cached) return res.json({ cve: cached });

    const result = await fabricService.evaluateTransaction('cve:GetCVE', [id], req.user);
    const cve = JSON.parse(result);

    if (!req.user && cve.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await cache.set(cacheKey, cve, 120);
    res.json({ cve });
  } catch (err) {
    logger.error('Get CVE error:', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
}

async function updateCVE(req, res) {
  try {
    const { id } = req.params;
    const updateData = JSON.stringify(req.body);
    await fabricService.submitTransaction('cve:UpdateCVE', [id, updateData], req.user);
    await cache.del(`cve:${id}`);
    await cache.del('cves:all');
    res.json({ message: 'CVE updated successfully' });
  } catch (err) {
    logger.error('Update CVE error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function transitionStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ error: 'Status required' });

    await fabricService.submitTransaction('cve:TransitionStatus', [id, status, notes || ''], req.user);
    await cache.del(`cve:${id}`);
    await cache.del('cves:all');
    logger.info(`CVE ${id} transitioned to ${status} by ${req.user.username}`);
    res.json({ message: `CVE status updated to ${status}` });
  } catch (err) {
    logger.error('Transition status error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getCVEHistory(req, res) {
  try {
    const result = await fabricService.evaluateTransaction('cve:GetCVEHistory', [req.params.id], req.user);
    res.json({ history: JSON.parse(result) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function searchCVEs(req, res) {
  try {
    const { severity, status, product, q, fromDate, toDate } = req.query;

    if (q) {
      const result = await fabricService.evaluateTransaction('cve:SearchCVEs', [q], req.user);
      return res.json({ cves: JSON.parse(result) });
    }

    const filter = {};
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (product) filter.product = product;
    if (fromDate) filter.fromDate = fromDate;
    if (toDate) filter.toDate = toDate;

    const result = await fabricService.evaluateTransaction('cve:QueryCVEs', [JSON.stringify(filter)], req.user);
    let cves = JSON.parse(result);

    if (!req.user || req.user.role === 'PUBLIC') {
      cves = cves.filter(c => c.status === 'PUBLISHED');
    }

    res.json({ cves });
  } catch (err) {
    logger.error('Search CVEs error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createCVE, createValidation, listCVEs, getCVE, updateCVE, transitionStatus, getCVEHistory, searchCVEs };
