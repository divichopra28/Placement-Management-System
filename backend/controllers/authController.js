const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { COOKIE_NAME, cookieOptions, signToken } = require('../middleware/auth');
const { setPassword, BCRYPT_ROUNDS } = require('../services/accountService');

// Used to keep response time similar when the account does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-password', BCRYPT_ROUNDS);

async function login(req, res) {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = req.body?.role === 'OFFICER' ? 'OFFICER' : req.body?.role === 'STUDENT' ? 'STUDENT' : null;
  const remember = Boolean(req.body?.remember);

  if (!identifier || !password) throw new AppError(400, 'Enter your email or college ID and your password.');
  if (!role) throw new AppError(400, 'Choose whether you are signing in as a student or a placement officer.');

  const account = await db.queryOne(
    `SELECT ua.account_id, ua.person_id, ua.password_hash, ua.role, ua.is_active, p.name, p.email
       FROM USER_ACCOUNT ua
       JOIN PERSON p ON p.person_id = ua.person_id
       LEFT JOIN STUDENT s ON s.person_id = ua.person_id
       LEFT JOIN PLACEMENT_OFFICER po ON po.person_id = ua.person_id
      WHERE LOWER(p.email) = LOWER(:id)
         OR UPPER(s.roll_no) = UPPER(:id)
         OR UPPER(po.employee_id) = UPPER(:id)`,
    { id: identifier },
  );

  const valid = await bcrypt.compare(password, account ? account.passwordHash : DUMMY_HASH);
  if (!account || !valid) throw new AppError(401, 'Incorrect email/college ID or password.');
  if (account.isActive !== 'Y') throw new AppError(403, 'This account has been deactivated. Contact the placement cell.');
  if (account.role !== role) {
    throw new AppError(403, role === 'OFFICER'
      ? 'This account is a student account. Use the Student sign-in tab.'
      : 'This account is a placement officer account. Use the Placement Officer sign-in tab.');
  }

  await db.execute('UPDATE USER_ACCOUNT SET last_login = SYSDATE WHERE account_id = :id', { id: account.accountId });

  res.cookie(COOKIE_NAME, signToken(account, remember), cookieOptions(remember));
  res.json({ user: { personId: account.personId, name: account.name, email: account.email, role: account.role } });
}

function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
}

async function me(req, res) {
  const extra = req.user.role === 'STUDENT'
    ? await db.queryOne(
      `SELECT s.roll_no AS college_id, d.dept_name AS subtitle
         FROM STUDENT s JOIN DEPARTMENT d ON d.dept_id = s.dept_id WHERE s.person_id = :id`,
      { id: req.user.personId },
    )
    : await db.queryOne(
      'SELECT employee_id AS college_id, designation AS subtitle FROM PLACEMENT_OFFICER WHERE person_id = :id',
      { id: req.user.personId },
    );
  res.json({
    user: {
      personId: req.user.personId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      collegeId: extra?.collegeId || null,
      subtitle: extra?.subtitle || null,
    },
  });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw new AppError(400, 'Current and new password are required.');
  const row = await db.queryOne('SELECT password_hash FROM USER_ACCOUNT WHERE account_id = :id', { id: req.user.accountId });
  if (!row || !(await bcrypt.compare(String(currentPassword), row.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect.');
  }
  await db.withTransaction((conn) => setPassword(conn, req.user.personId, String(newPassword)));
  res.json({ ok: true, message: 'Password updated.' });
}

module.exports = { login, logout, me, changePassword };
