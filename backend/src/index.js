require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./services/logger');

// Initialize database
require('./config/database');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cve', require('./routes/cve'));
app.use('/api/governance', require('./routes/governance'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/organizations', require('./routes/org'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'fabric',
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  logger.info(`CVE Platform API running on port ${PORT}`);
  logger.info(`Mode: ${process.env.DEMO_MODE === 'true' ? 'DEMO' : 'FABRIC'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});
