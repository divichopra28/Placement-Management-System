const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validate, parseId } = require('../validators');
const eligibility = require('../services/eligibilityService');

const JOB_RULES = {
  companyId: { type: 'integer', required: true, min: 1, label: 'Company' },
  jobTitle: { type: 'string', required: true, max: 150, label: 'Job title' },
  jobType: { type: 'string', max: 50, label: 'Job type' },
  description: { type: 'string', max: 500, label: 'Description' },
  salaryLpa: { type: 'number', min: 0, maxNum: 9999.99, label: 'Salary (LPA)' },
  location: { type: 'string', max: 150, label: 'Location' },
  vacancies: { type: 'integer', required: true, min: 1, label: 'Vacancies' },
  driveDate: { type: 'date', label: 'Drive date' },
  applicationDeadline: { type: 'date', label: 'Application deadline' },
};

const ELIG_RULES = {
  minCgpa: { type: 'number', min: 0, maxNum: 10, label: 'Minimum CGPA' },
  eligibleBranches: { type: 'string', max: 300, label: 'Eligible branches' },
  skillsRequired: { type: 'string', max: 300, label: 'Required skills' },
  backlogsAllowed: { type: 'integer', min: 0, maxNum: 99, label: 'Backlogs allowed' },
};

// Drive status is derived from the existing deadline column (no extra status column).
const LIST_SQL = `
  SELECT j.job_id, j.company_id, c.company_name, c.industry, j.job_title, j.job_type, j.description,
         j.salary_lpa, j.location, j.vacancies, j.drive_date, j.application_deadline,
         CASE WHEN j.application_deadline IS NULL OR j.application_deadline >= TRUNC(SYSDATE)
              THEN 'OPEN' ELSE 'CLOSED' END AS drive_status,
         e.job_id AS has_eligibility, e.min_cgpa, e.eligible_branches, e.skills_required, e.backlogs_allowed,
         (SELECT COUNT(*) FROM APPLICATION a WHERE a.job_id = j.job_id) AS applicant_count,
         (SELECT COUNT(*) FROM APPLICATION a WHERE a.job_id = j.job_id AND a.status = 'SHORTLISTED') AS shortlisted_count,
         (SELECT COUNT(*) FROM APPLICATION a WHERE a.job_id = j.job_id AND a.status = 'SELECTED') AS selected_count
    FROM JOB_POSTING j
    JOIN COMPANY c ON c.company_id = j.company_id
    LEFT JOIN ELIGIBILITY e ON e.job_id = j.job_id`;

function cleanList(value) {
  if (value === null || value === undefined) return null;
  const parts = eligibility.splitList(value);
  return parts.length ? parts.join(',') : null;
}

async function attachStudentView(rows, studentId) {
  const apps = await db.query(
    'SELECT job_id, application_id, status FROM APPLICATION WHERE student_id = :id',
    { id: studentId },
  );
  const byJob = new Map(apps.map((a) => [a.jobId, a]));
  const matrix = await eligibility.matrix({ studentId });
  const eligByJob = new Map(matrix.map((m) => [m.jobId, m]));
  return rows.map((r) => {
    const e = eligByJob.get(r.jobId);
    return {
      ...r,
      myApplication: byJob.get(r.jobId) || null,
      myEligibility: e ? { eligible: e.eligible, checks: e.checks, unmet: e.unmet } : null,
    };
  });
}

async function list(req, res) {
  let rows = await db.query(`${LIST_SQL} ORDER BY j.application_deadline DESC NULLS LAST, j.job_id DESC`);
  if (req.user.role === 'STUDENT') rows = await attachStudentView(rows, req.user.personId);
  res.json(rows);
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'job id');
  let job = await db.queryOne(`${LIST_SQL} WHERE j.job_id = :id`, { id });
  if (!job) throw new AppError(404, 'Job not found.');
  if (req.user.role === 'STUDENT') {
    [job] = await attachStudentView([job], req.user.personId);
  } else {
    job.applicants = await db.query(
      `SELECT a.application_id, a.student_id, p.name AS student_name, s.roll_no, s.cgpa, d.dept_name,
              a.apply_date, a.status, a.resume_path
         FROM APPLICATION a
         JOIN STUDENT s ON s.person_id = a.student_id
         JOIN PERSON p ON p.person_id = s.person_id
         JOIN DEPARTMENT d ON d.dept_id = s.dept_id
        WHERE a.job_id = :id ORDER BY a.apply_date DESC`,
      { id },
    );
  }
  res.json(job);
}

function checkDates(v) {
  if (v.driveDate && v.applicationDeadline && v.applicationDeadline > v.driveDate) {
    throw new AppError(400, 'Application deadline must be on or before the drive date.');
  }
}

async function create(req, res) {
  const v = validate(req.body, JOB_RULES);
  const e = validate(req.body?.eligibility || {}, ELIG_RULES);
  checkDates(v);

  const jobId = await db.withTransaction(async (conn) => {
    const r = await db.run(
      conn,
      `INSERT INTO JOB_POSTING (job_id, company_id, job_title, job_type, description, salary_lpa, location,
                                vacancies, drive_date, application_deadline)
       VALUES (job_seq.NEXTVAL, :companyId, :jobTitle, :jobType, :description, :salaryLpa, :location,
               :vacancies, :driveDate, :applicationDeadline)
       RETURNING job_id INTO :newId`,
      { ...v, newId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } },
    );
    const newId = r.outBinds.newId[0];
    // Every job gets an ELIGIBILITY row: TRG_CHECK_ELIGIBILITY rejects applications without one.
    await db.run(
      conn,
      `INSERT INTO ELIGIBILITY (job_id, min_cgpa, eligible_branches, skills_required, backlogs_allowed)
       VALUES (:jobId, :minCgpa, :branches, :skills, :backlogs)`,
      {
        jobId: newId,
        minCgpa: e.minCgpa ?? 0,
        branches: cleanList(e.eligibleBranches),
        skills: cleanList(e.skillsRequired),
        backlogs: e.backlogsAllowed ?? 0,
      },
    );
    return newId;
  });
  res.status(201).json(await db.queryOne(`${LIST_SQL} WHERE j.job_id = :id`, { id: jobId }));
}

async function update(req, res) {
  const id = parseId(req.params.id, 'job id');
  const v = validate(req.body, JOB_RULES);
  checkDates(v);
  const hasElig = req.body && req.body.eligibility;
  const e = hasElig ? validate(req.body.eligibility, ELIG_RULES) : null;

  await db.withTransaction(async (conn) => {
    const r = await db.run(
      conn,
      `UPDATE JOB_POSTING SET company_id = :companyId, job_title = :jobTitle, job_type = :jobType,
              description = :description, salary_lpa = :salaryLpa, location = :location,
              vacancies = :vacancies, drive_date = :driveDate, application_deadline = :applicationDeadline
        WHERE job_id = :id`,
      { ...v, id },
    );
    if (!r.rowsAffected) throw new AppError(404, 'Job not found.');
    if (e) await mergeEligibility(conn, id, e);
  });
  res.json(await db.queryOne(`${LIST_SQL} WHERE j.job_id = :id`, { id }));
}

async function mergeEligibility(conn, jobId, e) {
  await db.run(
    conn,
    `MERGE INTO ELIGIBILITY el
     USING (SELECT :jobId AS job_id FROM DUAL) src ON (el.job_id = src.job_id)
      WHEN MATCHED THEN UPDATE SET el.min_cgpa = :minCgpa, el.eligible_branches = :branches,
                                   el.skills_required = :skills, el.backlogs_allowed = :backlogs
      WHEN NOT MATCHED THEN INSERT (job_id, min_cgpa, eligible_branches, skills_required, backlogs_allowed)
           VALUES (:jobId, :minCgpa, :branches, :skills, :backlogs)`,
    {
      jobId,
      minCgpa: e.minCgpa ?? 0,
      branches: cleanList(e.eligibleBranches),
      skills: cleanList(e.skillsRequired),
      backlogs: e.backlogsAllowed ?? 0,
    },
  );
}

/** Close a drive by moving its deadline to yesterday (status is derived from the deadline). */
async function close(req, res) {
  const id = parseId(req.params.id, 'job id');
  const r = await db.execute(
    `UPDATE JOB_POSTING SET application_deadline = TRUNC(SYSDATE) - 1
      WHERE job_id = :id AND (application_deadline IS NULL OR application_deadline >= TRUNC(SYSDATE))`,
    { id },
  );
  if (!r.rowsAffected) throw new AppError(409, 'This drive is already closed or does not exist.');
  res.json(await db.queryOne(`${LIST_SQL} WHERE j.job_id = :id`, { id }));
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'job id');
  const deps = await db.queryOne('SELECT COUNT(*) AS apps FROM APPLICATION WHERE job_id = :id', { id });
  if (deps.apps) throw new AppError(409, `Cannot delete: ${deps.apps} application(s) exist for this job. Close the drive instead.`);
  await db.withTransaction(async (conn) => {
    await db.run(conn, 'DELETE FROM ELIGIBILITY WHERE job_id = :id', { id });
    const r = await db.run(conn, 'DELETE FROM JOB_POSTING WHERE job_id = :id', { id });
    if (!r.rowsAffected) throw new AppError(404, 'Job not found.');
  });
  res.json({ ok: true });
}

/* --------------------------- eligibility --------------------------- */

async function getEligibility(req, res) {
  const id = parseId(req.params.id, 'job id');
  const row = await db.queryOne(
    `SELECT j.job_id, j.job_title, c.company_name, e.min_cgpa, e.eligible_branches, e.skills_required, e.backlogs_allowed,
            e.job_id AS has_eligibility
       FROM JOB_POSTING j JOIN COMPANY c ON c.company_id = j.company_id
       LEFT JOIN ELIGIBILITY e ON e.job_id = j.job_id WHERE j.job_id = :id`,
    { id },
  );
  if (!row) throw new AppError(404, 'Job not found.');
  res.json(row);
}

async function putEligibility(req, res) {
  const id = parseId(req.params.id, 'job id');
  const e = validate(req.body, ELIG_RULES);
  const job = await db.queryOne('SELECT job_id FROM JOB_POSTING WHERE job_id = :id', { id });
  if (!job) throw new AppError(404, 'Job not found.');
  await db.withTransaction((conn) => mergeEligibility(conn, id, e));
  return getEligibility(req, res);
}

async function checkEligibility(req, res) {
  const jobId = parseId(req.params.id, 'job id');
  let studentId;
  if (req.params.studentId === 'me' || req.user.role === 'STUDENT') {
    studentId = req.user.personId;
    if (req.params.studentId !== 'me' && Number(req.params.studentId) !== studentId) {
      throw new AppError(403, 'You can only check your own eligibility.');
    }
  } else {
    studentId = parseId(req.params.studentId, 'student id');
  }
  const result = await eligibility.checkStudentForJob(studentId, jobId);
  if (!result) throw new AppError(404, 'Student or job not found.');
  res.json(result);
}

/** Officer: eligibility of every student for one job. */
async function eligibilityMatrix(req, res) {
  const jobId = parseId(req.params.id, 'job id');
  res.json(await eligibility.matrix({ jobId }));
}

module.exports = {
  list, getOne, create, update, close, remove,
  getEligibility, putEligibility, checkEligibility, eligibilityMatrix,
};
