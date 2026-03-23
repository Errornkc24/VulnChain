const { body, validationResult } = require('express-validator');
const fabricService = require('../services/fabricService');
const cache = require('../config/redis');
const logger = require('../services/logger');

const createProposalValidation = [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').trim().notEmpty().withMessage('Description required'),
  body('type').optional().isIn(['POLICY_CHANGE', 'CNA_MEMBERSHIP', 'SEVERITY_THRESHOLD', 'EMBARGO_EXTENSION']),
];

async function createProposal(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const proposalData = JSON.stringify(req.body);
    const proposalId = await fabricService.submitTransaction('governance:CreateProposal', [proposalData], req.user);
    await cache.del('proposals:all');
    logger.info(`Proposal created: ${proposalId} by ${req.user.username}`);
    res.status(201).json({ proposalId, message: 'Proposal created successfully' });
  } catch (err) {
    logger.error('Create proposal error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function listProposals(req, res) {
  try {
    const { status } = req.query;
    let result;

    if (status) {
      result = await fabricService.evaluateTransaction('governance:GetProposalsByStatus', [status], req.user);
    } else {
      const cached = await cache.get('proposals:all');
      if (cached) return res.json({ proposals: cached });
      result = await fabricService.evaluateTransaction('governance:GetAllProposals', [], req.user);
    }

    const proposals = JSON.parse(result);
    if (!status) await cache.set('proposals:all', proposals, 60);
    res.json({ proposals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getProposal(req, res) {
  try {
    const result = await fabricService.evaluateTransaction('governance:GetProposal', [req.params.id], req.user);
    res.json({ proposal: JSON.parse(result) });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
}

async function activateProposal(req, res) {
  try {
    await fabricService.submitTransaction('governance:ActivateProposal', [req.params.id], req.user);
    await cache.del('proposals:all');
    res.json({ message: 'Proposal activated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function vote(req, res) {
  try {
    const { decision, reason } = req.body;
    if (!decision || !['YES', 'NO', 'ABSTAIN'].includes(decision)) {
      return res.status(400).json({ error: 'Valid decision required (YES/NO/ABSTAIN)' });
    }

    await fabricService.submitTransaction(
      'governance:VoteOnProposal',
      [req.params.id, decision, reason || ''],
      req.user
    );
    await cache.del('proposals:all');
    logger.info(`Vote cast on ${req.params.id}: ${decision} by ${req.user.username}`);
    res.json({ message: 'Vote recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function tally(req, res) {
  try {
    const result = await fabricService.submitTransaction('governance:TallyVotes', [req.params.id], req.user);
    await cache.del('proposals:all');
    res.json({ result: JSON.parse(result) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function enactProposal(req, res) {
  try {
    await fabricService.submitTransaction('governance:EnactProposal', [req.params.id], req.user);
    await cache.del('proposals:all');
    res.json({ message: 'Proposal enacted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createProposal, createProposalValidation, listProposals, getProposal, activateProposal, vote, tally, enactProposal };
