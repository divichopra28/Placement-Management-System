const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/db');
const { AppError } = require('./errorHandler');

const COOKIE_NAME = 'pms_token';

function cookieOptions(remember) {
  const opts = {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
  };
  if (remember) opts.maxAge = config.jwt.rememberDays * 24 * 60 * 60 * 1000;
  return opts;
}

function signToken(account, remember) {
  const expiresIn = remember ? `${config.jwt.rememberDays}d` : `${config.jwt.sessionHours}h`;
  return jwt.sign(
    { sub: String(account.accountId), personId: account.personId, role: account.role },
    config.jwt.secret,
    { expiresIn },
  );
}

async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return next(new AppError(401, 'Please log in to continue.'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next(new AppError(401, 'Your session has expired. Please log in again.'));
  }
  // Re-check the account on every request so deactivated accounts lose access immediately.
  const account = await db.queryOne(
    `SELECT ua.account_id, ua.person_id, ua.role, ua.is_active, p.name, p.email
       FROM USER_ACCOUNT ua JOIN PERSON p ON p.person_id = ua.person_id
      WHERE ua.account_id = :id`,
    { id: Number(payload.sub) },
  );
  if (!account || account.isActive !== 'Y') {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next(new AppError(401, 'This account is no longer active.'));
  }
  req.user = {
    accountId: account.accountId,
    personId: account.personId,
    role: account.role,
    name: account.name,
    email: account.email,
  };
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

const requireOfficer = requireRole('OFFICER');
const requireStudent = requireRole('STUDENT');

/**
 * Resolve a :id route parameter that refers to a student. "me" maps to the
 * logged-in student. Students may only ever resolve to themselves.
 */
function resolveStudentId(req, param = 'id') {
  const raw = req.params[param];
  if (raw === 'me') {
    if (req.user.role !== 'STUDENT') throw new AppError(400, '"me" is only valid for student accounts.');
    return req.user.personId;
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Invalid student id.');
  if (req.user.role === 'STUDENT' && id !== req.user.personId) {
    throw new AppError(403, 'You can only access your own records.');
  }
  return id;
}

module.exports = {
  COOKIE_NAME,
  cookieOptions,
  signToken,
  authenticate,
  requireRole,
  requireOfficer,
  requireStudent,
  resolveStudentId,
};
