const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: path.resolve(process.env.DB_PATH || './data/tuzi.db'),
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || 'dev-access-secret',
  accessTokenExpires: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
  refreshTokenExpires: process.env.REFRESH_TOKEN_EXPIRES || '7d',
  refreshTokenExpiresMs: 7 * 24 * 60 * 60 * 1000,
  tuziBaseUrl: process.env.TUZI_BASE_URL || 'https://api.tu-zi.com',
  tuziApiKey: process.env.TUZI_API_KEY || '',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
