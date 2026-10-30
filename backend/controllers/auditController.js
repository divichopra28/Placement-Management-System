const db = require('../config/db');

// Read-only: there is intentionally no endpoint to edit or delete audit rows.
async function list(req, res) {
  res.json(await db.query(
    `SELECT au.audit_id, au.application_id, au.old_status, au.new_status, au.changed_on, au.changed_by,
            p.name AS student_name, s.roll_no, j.job_title, c.company_name
       FROM APPLICATION_AUDIT au
       LEFT JOIN APPLICATION a ON a.application_id = au.application_id
       LEFT JOIN STUDENT s ON s.person_id = a.student_id
       LEFT JOIN PERSON p ON p.person_id = a.student_id
       LEFT JOIN JOB_POSTING j ON j.job_id = a.job_id
       LEFT JOIN COMPANY c ON c.company_id = j.company_id
      ORDER BY au.changed_on DESC, au.audit_id DESC`,
  ));
}

module.exports = { list };
