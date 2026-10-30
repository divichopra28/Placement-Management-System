/*
 * Creates login accounts for every student and placement officer that does not
 * have one yet. Each gets a random password, which is printed ONCE here and
 * stored only as a bcrypt hash. Existing accounts are never changed.
 *   npm run seed-accounts
 */
const crypto = require('crypto');
const db = require('../config/db');
const { setPassword } = require('../services/accountService');

function randomPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  let p = '';
  for (let i = 0; i < 8; i += 1) p += letters[crypto.randomInt(letters.length)];
  for (let i = 0; i < 3; i += 1) p += digits[crypto.randomInt(digits.length)];
  return p;
}

(async () => {
  try {
    const people = await db.query(`
      SELECT p.person_id, p.name, p.email,
             COALESCE(s.roll_no, po.employee_id) AS college_id,
             CASE WHEN po.person_id IS NOT NULL THEN 'OFFICER' ELSE 'STUDENT' END AS role
        FROM PERSON p
        LEFT JOIN STUDENT s ON s.person_id = p.person_id
        LEFT JOIN PLACEMENT_OFFICER po ON po.person_id = p.person_id
       WHERE (s.person_id IS NOT NULL OR po.person_id IS NOT NULL)
         AND NOT EXISTS (SELECT 1 FROM USER_ACCOUNT ua WHERE ua.person_id = p.person_id)
       ORDER BY role, p.person_id`);
    if (!people.length) {
      console.log('Every student and officer already has an account. Use create-account to reset a password.');
      return;
    }
    const created = [];
    for (const person of people) {
      const password = randomPassword();
      await db.withTransaction((conn) => setPassword(conn, person.personId, password));
      created.push({ role: person.role, name: person.name, email: person.email, collegeId: person.collegeId, password });
    }
    console.log('\nCreated accounts (passwords are shown only now - store them safely):\n');
    console.table(created);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.closePool();
  }
})();
