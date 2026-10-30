const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  db: {
    user: required('ORACLE_USER'),
    password: required('ORACLE_PASSWORD'),
    connectString: required('ORACLE_CONNECT_STRING'),
    // 'thick' is required for Oracle Database 11g (Thin mode needs 12.1+).
    driverMode: (process.env.ORACLE_DRIVER_MODE || 'thick').toLowerCase(),
    clientLibDir: process.env.ORACLE_CLIENT_LIB_DIR || '',
    poolMin: Number(process.env.ORACLE_POOL_MIN || 1),
    poolMax: Number(process.env.ORACLE_POOL_MAX || 6),
  },
  jwt: {
    secret: jwtSecret,
    sessionHours: Number(process.env.SESSION_HOURS || 8),
    rememberDays: Number(process.env.REMEMBER_ME_DAYS || 7),
  },
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'),
  corsOrigin: process.env.CORS_ORIGIN || '',
};
