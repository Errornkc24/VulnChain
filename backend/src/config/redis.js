const Redis = require('ioredis');
const logger = require('../services/logger');

let redis = null;
let isConnected = false;

const DEFAULT_TTL = 300;

function createClient() {
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('Redis connection failed after 3 retries, running without cache');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      isConnected = false;
      logger.warn(`Redis error: ${err.message}`);
    });

    redis.on('close', () => {
      isConnected = false;
    });

    redis.connect().catch(() => {
      logger.warn('Redis not available, running without cache');
    });
  } catch (err) {
    logger.warn(`Redis init failed: ${err.message}`);
  }
}

async function get(key) {
  if (!isConnected || !redis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttl = DEFAULT_TTL) {
  if (!isConnected || !redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // ignore cache errors
  }
}

async function del(key) {
  if (!isConnected || !redis) return;
  try {
    await redis.del(key);
  } catch {
    // ignore
  }
}

async function flush() {
  if (!isConnected || !redis) return;
  try {
    await redis.flushdb();
  } catch {
    // ignore
  }
}

createClient();

module.exports = { get, set, del, flush, getClient: () => redis };
