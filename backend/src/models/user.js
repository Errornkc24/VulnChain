const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;

function createUser({ username, email, password, role = 'PUBLIC', organization = null }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

  const stmt = db.prepare(`
    INSERT INTO users (id, username, email, password, role, organization, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, username, email, hashedPassword, role, organization, now, now);

  return { id, username, email, role, organization, createdAt: now };
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findById(id) {
  return db.prepare('SELECT id, username, email, role, organization, createdAt, updatedAt FROM users WHERE id = ?').get(id);
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compareSync(plaintext, hash);
}

function updateUser(id, updates) {
  const fields = [];
  const values = [];

  if (updates.email) { fields.push('email = ?'); values.push(updates.email); }
  if (updates.organization) { fields.push('organization = ?'); values.push(updates.organization); }
  if (updates.role) { fields.push('role = ?'); values.push(updates.role); }

  if (fields.length === 0) return findById(id);

  fields.push('updatedAt = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return findById(id);
}

function getAllUsers() {
  return db.prepare('SELECT id, username, email, role, organization, createdAt FROM users').all();
}

module.exports = { createUser, findByUsername, findByEmail, findById, verifyPassword, updateUser, getAllUsers };
