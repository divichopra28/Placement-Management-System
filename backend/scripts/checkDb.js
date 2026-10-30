/* Verifies that every Oracle object the application depends on exists and is VALID. */
const db = require('../config/db');

const EXPECTED = {
  TABLE: ['PERSON', 'DEPARTMENT', 'STUDENT', 'PLACEMENT_OFFICER', 'COMPANY', 'SKILL', 'STUDENT_SKILL', 'JOB_POSTING',
    'ELIGIBILITY', 'APPLICATION', 'INTERVIEW', 'OFFER', 'PLACEMENT', 'APPLICATION_AUDIT', 'USER_ACCOUNT', 'STUDENT_RESUME'],
  SEQUENCE: ['PERSON_SEQ', 'DEPARTMENT_SEQ', 'COMPANY_SEQ', 'SKILL_SEQ', 'JOB_SEQ', 'APPLICATION_SEQ', 'INTERVIEW_SEQ',
    'OFFER_SEQ', 'PLACEMENT_SEQ', 'AUDIT_SEQ', 'ACCOUNT_SEQ'],
  TRIGGER: ['TRG_CHECK_ELIGIBILITY', 'TRG_OFFER_APPLICATION', 'TRG_CREATE_PLACEMENT', 'TRG_APPLICATION_AUDIT', 'TRG_ONE_PLACEMENT_PER_STUDENT'],
  PROCEDURE: ['APPLY_FOR_JOB', 'SCHEDULE_INTERVIEW', 'CREATE_OFFER'],
  FUNCTION: ['PLACEMENT_PERCENTAGE'],
  VIEW: ['STUDENT_APPLICATION_VIEW', 'PLACEMENT_DETAILS'],
};

(async () => {
  let problems = 0;
  try {
    const rows = await db.query('SELECT object_name, object_type, status FROM USER_OBJECTS');
    const found = new Map(rows.map((r) => [`${r.objectType}:${r.objectName}`, r.status]));
    for (const [type, names] of Object.entries(EXPECTED)) {
      for (const name of names) {
        const status = found.get(`${type}:${name}`);
        const mark = status === 'VALID' ? 'OK     ' : status ? 'INVALID' : 'MISSING';
        if (status !== 'VALID') problems += 1;
        console.log(`${mark}  ${type.padEnd(9)} ${name}`);
      }
    }
    const trg = await db.query("SELECT trigger_name, status FROM USER_TRIGGERS WHERE status <> 'ENABLED'");
    trg.forEach((t) => { problems += 1; console.log(`DISABLED trigger ${t.triggerName}`); });
    const accounts = await db.queryOne('SELECT COUNT(*) AS n FROM USER_ACCOUNT');
    console.log(`\nLogin accounts: ${accounts.n}${accounts.n ? '' : '  (run: npm run seed-accounts)'}`);
    console.log(problems ? `\n${problems} problem(s) found.` : '\nAll database objects are present and valid.');
  } catch (err) {
    console.error('Database check failed:', err.message);
    problems = 1;
  } finally {
    await db.closePool();
    process.exit(problems ? 1 : 0);
  }
})();
