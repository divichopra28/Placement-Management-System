const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validate, parseId } = require('../validators');

const RESULTS = ['PENDING', 'PASS', 'FAIL'];
const TYPES = ['Aptitude Test', 'Technical', 'HR', 'Group Discussion', 'Managerial', 'Coding Round'];

const LIST_SQL = `
  SELECT i.interview_id, i.application_id, i.officer_id, op.name AS officer_name,
         i.interview_date, i.interview_type, i.round_no, i.result, i.feedback,
         a.student_id, sp.name AS student_name, s.roll_no, a.status AS application_status,
         j.job_id, j.job_title, c.company_id, c.company_name
    FROM INTERVIEW i
    JOIN APPLICATION a ON a.application_id = i.application_id
    JOIN STUDENT s ON s.person_id = a.student_id
    JOIN PERSON sp ON sp.person_id = s.person_id
    JOIN PERSON op ON op.person_id = i.officer_id
    JOIN JOB_POSTING j ON j.job_id = a.job_id
    JOIN COMPANY c ON c.company_id = j.company_id`;

// Officer feedback is internal and is never sent to students.
function forRole(row, role) {
  if (role === 'OFFICER') return row;
  const { feedback, ...rest } = row;
  return rest;
}

async function list(req, res) {
  const isStudent = req.user.role === 'STUDENT';
  const rows = await db.query(
    `${LIST_SQL}${isStudent ? ' WHERE a.student_id = :me' : ''} ORDER BY i.interview_date DESC NULLS LAST`,
    isStudent ? { me: req.user.personId } : {},
  );
  res.json(rows.map((r) => forRole(r, req.user.role)));
}

const RULES = {
  officerId: { type: 'integer', required: true, min: 1, label: 'Placement officer' },
  interviewDate: { type: 'date', required: true, label: 'Interview date and time' },
  interviewType: { type: 'string', required: true, max: 50, label: 'Interview type' },
  roundNo: { type: 'integer', required: true, min: 1, maxNum: 20, label: 'Round number' },
};

/** Schedules through the SCHEDULE_INTERVIEW stored procedure. */
async function create(req, res) {
  const applicationId = parseId(req.body?.applicationId, 'application id');
  const v = validate(req.body, RULES);
  if (v.interviewDate < new Date()) throw new AppError(400, 'The interview must be scheduled in the future.');

  const app = await db.queryOne('SELECT status FROM APPLICATION WHERE application_id = :id', { id: applicationId });
  if (!app) throw new AppError(404, 'Application not found.');
  if (['REJECTED', 'WITHDRAWN'].includes(app.status)) {
    throw new AppError(409, `Cannot schedule an interview for a ${app.status} application.`);
  }
  const dup = await db.queryOne(
    'SELECT interview_id FROM INTERVIEW WHERE application_id = :id AND round_no = :round',
    { id: applicationId, round: v.roundNo },
  );
  if (dup) throw new AppError(409, `Round ${v.roundNo} is already scheduled for this application (interview #${dup.interviewId}).`);
  const clash = await db.queryOne(
    `SELECT COUNT(*) AS n FROM INTERVIEW i JOIN APPLICATION a ON a.application_id = i.application_id
      WHERE a.student_id = (SELECT student_id FROM APPLICATION WHERE application_id = :id)
        AND i.interview_date = :dt`,
    { id: applicationId, dt: v.interviewDate },
  );
  if (clash.n) throw new AppError(409, 'This student already has an interview at exactly that date and time.');

  await db.execute(
    'BEGIN SCHEDULE_INTERVIEW(:applicationId, :officerId, :interviewDate, :interviewType, :roundNo); END;',
    { applicationId, ...v },
  );
  const created = await db.queryOne(
    `${LIST_SQL} WHERE i.application_id = :id AND i.round_no = :round`,
    { id: applicationId, round: v.roundNo },
  );
  res.status(201).json(created);
}

async function update(req, res) {
  const id = parseId(req.params.id, 'interview id');
  const v = validate(req.body, {
    ...RULES,
    result: { type: 'enum', required: true, enum: RESULTS, label: 'Result' },
    feedback: { type: 'string', max: 500, label: 'Feedback' },
  });
  const existing = await db.queryOne('SELECT application_id FROM INTERVIEW WHERE interview_id = :id', { id });
  if (!existing) throw new AppError(404, 'Interview not found.');
  const dup = await db.queryOne(
    'SELECT interview_id FROM INTERVIEW WHERE application_id = :app AND round_no = :round AND interview_id <> :id',
    { app: existing.applicationId, round: v.roundNo, id },
  );
  if (dup) throw new AppError(409, `Round ${v.roundNo} already exists for this application.`);

  await db.execute(
    `UPDATE INTERVIEW SET officer_id = :officerId, interview_date = :interviewDate, interview_type = :interviewType,
            round_no = :roundNo, result = :result, feedback = :feedback
      WHERE interview_id = :id`,
    { ...v, id },
  );
  res.json(await db.queryOne(`${LIST_SQL} WHERE i.interview_id = :id`, { id }));
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'interview id');
  const row = await db.queryOne('SELECT result FROM INTERVIEW WHERE interview_id = :id', { id });
  if (!row) throw new AppError(404, 'Interview not found.');
  if (row.result !== 'PENDING') throw new AppError(409, 'Only pending interviews can be cancelled; completed results are kept for the record.');
  await db.execute('DELETE FROM INTERVIEW WHERE interview_id = :id', { id });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove, RESULTS, TYPES };
