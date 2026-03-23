const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/user');
const logger = require('../services/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'cve-platform-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

const VALID_ROLES = ['PUBLIC', 'RESEARCHER', 'CNA_MEMBER', 'NATIONAL_BODY', 'ADMIN'];

const registerValidation = [
  body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(VALID_ROLES).withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
  body('organization').optional().trim(),
];

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, role, organization } = req.body;

    if (User.findByUsername(username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    if (User.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const user = User.createUser({ username, email, password, role: role || 'PUBLIC', organization });
    logger.info(`User registered: ${username} (${role || 'PUBLIC'})`);

    res.status(201).json({ message: 'Registration successful', user });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
}

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username required'),
  body('password').notEmpty().withMessage('Password required'),
];

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;
    const user = User.findByUsername(username);

    if (!user || !User.verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, organization: user.organization },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    logger.info(`User logged in: ${username}`);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role, organization: user.organization },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

async function getProfile(req, res) {
  try {
    const user = User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

async function updateProfile(req, res) {
  try {
    const user = User.updateUser(req.user.id, req.body);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

module.exports = { register, registerValidation, login, loginValidation, getProfile, updateProfile };
