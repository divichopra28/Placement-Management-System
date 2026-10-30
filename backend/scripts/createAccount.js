/*
 * Create or reset the login for an existing PERSON (student or placement officer).
 *   npm run create-account -- <email> <password>
 * The role is derived from the STUDENT / PLACEMENT_OFFICER tables.
 */
const db = require('../config/db');
const { setPassword } = require('../services/accountService');

(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: npm run create-account -- <email> <password>');
    process.exit(1);
  }
  try {
    const person = await db.queryOne('SELECT person_id, name FROM PERSON WHERE LOWER(email) = LOWER(:email)', { email });
    if (!person) throw new Error(`No PERSON found with email ${email}`);
    const role = await db.withTransaction((conn) => setPassword(conn, person.personId, password));
    console.log(`Login set for ${person.name} <${email}> as ${role}.`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.closePool();
  }
})();
