const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parseId } = require('../validators');
const eligibility = require('../services/eligibilityService');

const STATUSES = ['APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];

const LIST_SQL = `
  SELECT a.application_id, a.student_id, p.name AS student_name, s.roll_no, s.cgpa, d.dept_name,
         a.job_id, j.job_title, j.job_type, j.salary_lpa, c.company_id, c.company_name,
         a.apply_date, a.status, a.resume_path,
         (SELECT LISTAGG(sk.skill_name, ', ') WITHIN GROUP (ORDER BY sk.skill_name)
            FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id
           WHERE ss.student_id = a.student_id) AS skills,
         (SELECT COUNT(*) FROM INTERVIEW i WHERE i.application_id = a.application_id) AS interview_count,
         o.offer_id, o.offer_status
    FROM APPLICATION a
    JOIN STUDENT s ON s.person_id = a.student_id
    JOIN PERSON p ON p.person_id = s.person_id
    JOIN DEPARTMENT d ON d.dept_id = s.dept_id
    JOIN JOB_POSTING j ON j.job_id = a.job_id
    JOIN COMPANY c ON c.company_id = j.company_id
    LEFT JOIN OFFER o ON o.application_id = a.application_id`;

async function list(req, res) {
  const where = [];
  const binds = {};
  if (req.user.role === 'STUDENT') {
    where.push('a.student_id = :me');
    binds.me = req.user.personId;
  }
  if (req.query.jobId) { where.push('a.job_id = :jobId'); binds.jobId = parseId(req.query.jobId, 'job id'); }
  if (req.query.status && STATUSES.includes(String(req.query.status).toUpperCase())) {
    where.push('a.status = :status'); binds.status = String(req.query.status).toUpperCase();
  }
  const sql = `${LIST_SQL}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY a.apply_date DESC, a.application_id DESC`;
  res.json(await db.query(sql, binds));
}

async function loadOne(id) {
  return db.queryOne(`${LIST_SQL} WHERE a.application_id = :id`, { id });
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'application id');
  const app = await loadOne(id);
  if (!app) throw new AppError(404, 'Application not found.');
  if (req.user.role === 'STUDENT' && app.studentId !== req.user.personId) throw new AppError(403, 'You can only view your own applications.');
  const history = await db.query(
    `SELECT audit_id, old_status, new_status, changed_on, changed_by
       FROM APPLICATION_AUDIT WHERE application_id = :id ORDER BY changed_on, audit_id`,
    { id },
  );
  res.json({ ...app, history });
}

/**
 * Student applies for a job. Branch, skill and deadline rules are checked here
 * because the schema stores them as text; the CGPA rule is left to Oracle's
 * TRG_CHECK_ELIGIBILITY trigger, and duplicates to the UQ_STUDENT_JOB constraint.
 * The insert itself is done by the APPLY_FOR_JOB stored procedure.
 */
async function create(req, res) {
  const studentId = req.user.personId;
  const jobId = parseId(req.body?.jobId, 'job id');

  const check = await eligibility.checkStudentForJob(studentId, jobId);
  if (!check) throw new AppError(404, 'Job not found.');
  if (!check.applicationOpen) throw new AppError(422, 'The application deadline for this job has passed.');
  const blocking = check.checks.filter((c) => c.blocking && c.status !== 'PASS' && c.key !== 'cgpa');
  if (blocking.length) {
    throw new AppError(422, `You are not eligible for this job: ${blocking.map((c) => c.detail).join(' ')}`, { checks: check.checks });
  }

  const resume = await db.queryOne('SELECT stored_name FROM STUDENT_RESUME WHERE student_id = :id', { id: studentId });
  const resumePath = resume ? resume.storedName : null;

  await db.execute(
    'BEGIN APPLY_FOR_JOB(:studentId, :jobId, :resumePath); END;',
    { studentId, jobId, resumePath },
  );
  const created = await db.queryOne(
    `${LIST_SQL} WHERE a.student_id = :studentId AND a.job_id = :jobId`,
    { studentId, jobId },
  );
  res.status(201).json(created);
}

/**
 * Officers: APPLIED <-> SHORTLISTED / REJECTED. SELECTED is only reached by
 * creating an offer (TRG_OFFER_APPLICATION). Students: WITHDRAWN on their own.
 * Every change is logged by TRG_APPLICATION_AUDIT.
 */
async function updateStatus(req, res) {
  const id = parseId(req.params.id, 'application id');
  const status = String(req.body?.status || '').toUpperCase();
  if (!STATUSES.includes(status)) throw new AppError(400, `Status must be one of ${STATUSES.join(', ')}.`);

  const app = await loadOne(id);
  if (!app) throw new AppError(404, 'Application not found.');
  if (app.status === status) throw new AppError(409, `Application is already ${status}.`);

  if (req.user.role === 'STUDENT') {
    if (app.studentId !== req.user.personId) throw new AppError(403, 'You can only change your own applications.');
    if (status !== 'WITHDRAWN') throw new AppError(403, 'Students can only withdraw an application.');
    if (!['APPLIED', 'SHORTLISTED'].includes(app.status)) throw new AppError(409, `An application that is ${app.status} cannot be withdrawn.`);
  } else {
    if (status === 'SELECTED') throw new AppError(400, 'Create an offer to select a candidate - the offer trigger marks the application SELECTED.');
    if (status === 'WITHDRAWN') throw new AppError(400, 'Only the student can withdraw an application.');
    if (app.offerId) throw new AppError(409, 'This application already has an offer; update the offer instead.');
    if (app.status === 'WITHDRAWN') throw new AppError(409, 'The student has withdrawn this application.');
  }

  await db.execute('UPDATE APPLICATION SET status = :status WHERE application_id = :id', { status, id });
  res.json(await loadOne(id));
}

module.exports = { list, getOne, create, updateStatus, STATUSES };
