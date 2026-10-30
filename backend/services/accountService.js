const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

const BCRYPT_ROUNDS = 12;

function assertStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new AppError(400, 'Password must be at least 8 characters long.');
  }
  if (password.length > 72) throw new AppError(400, 'Password must be at most 72 characters long.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(400, 'Password must contain at least one letter and one number.');
  }
}

async function roleForPerson(conn, personId) {
  const r = await db.run(
    conn,
    `SELECT (SELECT COUNT(*) FROM STUDENT WHERE person_id = :id) AS is_student,
            (SELECT COUNT(*) FROM PLACEMENT_OFFICER WHERE person_id = :id) AS is_officer
       FROM DUAL`,
    { id: personId },
  );
  const row = r.rows[0];
  if (row.isOfficer) return 'OFFICER';
  if (row.isStudent) return 'STUDENT';
  return null;
}

/**
 * Create or reset the login for an existing PERSON. The role is derived from
 * whether the person is in STUDENT or PLACEMENT_OFFICER - never from input.
 */
async function setPassword(conn, personId, password) {
  assertStrongPassword(password);
  const role = await roleForPerson(conn, personId);
  if (!role) throw new AppError(400, 'This person is neither a student nor a placement officer.');
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await db.run(
    conn,
    `MERGE INTO USER_ACCOUNT ua
     USING (SELECT :personId AS person_id FROM DUAL) src
        ON (ua.person_id = src.person_id)
      WHEN MATCHED THEN UPDATE SET ua.password_hash = :hash, ua.role = :role, ua.is_active = 'Y'
      WHEN NOT MATCHED THEN INSERT (account_id, person_id, password_hash, role, is_active, created_on)
           VALUES (account_seq.NEXTVAL, :personId, :hash, :role, 'Y', SYSDATE)`,
    { personId, hash, role },
  );
  return role;
}

module.exports = { setPassword, assertStrongPassword, BCRYPT_ROUNDS };
