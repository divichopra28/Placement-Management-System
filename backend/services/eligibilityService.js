const db = require('../config/db');

/**
 * ELIGIBILITY.eligible_branches and ELIGIBILITY.skills_required are stored as
 * comma-separated text in the supplied schema (e.g. 'Computer Engineering,Information Technology').
 * Branches are matched case-insensitively against DEPARTMENT.dept_name and
 * skills against SKILL.skill_name. An empty list means "no restriction".
 */
function splitList(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Pure evaluation of one student against one job's criteria.
 * status: PASS | FAIL | UNKNOWN. UNKNOWN is never silently treated as PASS
 * for CGPA, and backlogs are always UNKNOWN because the schema does not
 * store a student's backlog count.
 */
function evaluate(student, criteria, studentSkillNames) {
  const checks = [];

  if (!criteria) {
    checks.push({
      key: 'criteria', label: 'Eligibility criteria', status: 'FAIL', blocking: true,
      detail: 'No eligibility record is defined for this job yet, so applications cannot be accepted.',
    });
    return finalize(checks);
  }

  // 1. CGPA (also enforced in Oracle by TRG_CHECK_ELIGIBILITY)
  if (criteria.minCgpa === null || criteria.minCgpa === undefined) {
    checks.push({ key: 'cgpa', label: 'Minimum CGPA', status: 'PASS', blocking: true, detail: 'No minimum CGPA set.' });
  } else if (student.cgpa === null || student.cgpa === undefined) {
    checks.push({
      key: 'cgpa', label: 'Minimum CGPA', status: 'UNKNOWN', blocking: true,
      detail: `CGPA is not recorded for this student; ${criteria.minCgpa} is required.`,
    });
  } else {
    const ok = Number(student.cgpa) >= Number(criteria.minCgpa);
    checks.push({
      key: 'cgpa', label: 'Minimum CGPA', status: ok ? 'PASS' : 'FAIL', blocking: true,
      detail: ok
        ? `CGPA ${student.cgpa} meets the minimum of ${criteria.minCgpa}.`
        : `CGPA ${student.cgpa} is below the required ${criteria.minCgpa}.`,
    });
  }

  // 2. Branch / department
  const branches = splitList(criteria.eligibleBranches);
  if (!branches.length) {
    checks.push({ key: 'branch', label: 'Eligible branch', status: 'PASS', blocking: true, detail: 'Open to all branches.' });
  } else {
    const ok = branches.some((b) => b.toLowerCase() === String(student.deptName || '').toLowerCase());
    checks.push({
      key: 'branch', label: 'Eligible branch', status: ok ? 'PASS' : 'FAIL', blocking: true,
      detail: ok
        ? `${student.deptName} is an eligible branch.`
        : `${student.deptName || 'Your department'} is not in the eligible branches (${branches.join(', ')}).`,
    });
  }

  // 3. Required skills
  const required = splitList(criteria.skillsRequired);
  if (!required.length) {
    checks.push({ key: 'skills', label: 'Required skills', status: 'PASS', blocking: true, detail: 'No specific skills required.' });
  } else {
    const have = new Set((studentSkillNames || []).map((s) => s.toLowerCase()));
    const missing = required.filter((s) => !have.has(s.toLowerCase()));
    checks.push({
      key: 'skills', label: 'Required skills', status: missing.length ? 'FAIL' : 'PASS', blocking: true,
      detail: missing.length
        ? `Missing required skill(s): ${missing.join(', ')}.`
        : `Has all required skills (${required.join(', ')}).`,
      missing,
    });
  }

  // 4. Backlogs - not stored anywhere in the schema, so it cannot be verified.
  checks.push({
    key: 'backlogs', label: 'Backlogs', status: 'UNKNOWN', blocking: false,
    detail: `Up to ${criteria.backlogsAllowed ?? 0} backlog(s) allowed. Backlog data is not stored in the database, so this must be verified manually by the placement cell.`,
  });

  return finalize(checks);
}

function finalize(checks) {
  const unmet = checks.filter((c) => c.blocking && c.status !== 'PASS');
  return {
    eligible: unmet.length === 0,
    checks,
    unmet: unmet.map((c) => c.detail),
  };
}

const STUDENT_SQL = `
  SELECT s.person_id AS student_id, p.name, s.roll_no, s.cgpa, s.dept_id, d.dept_name
    FROM STUDENT s
    JOIN PERSON p ON p.person_id = s.person_id
    JOIN DEPARTMENT d ON d.dept_id = s.dept_id`;

const CRITERIA_SQL = `
  SELECT j.job_id, j.job_title, j.application_deadline,
         e.job_id AS criteria_job_id, e.min_cgpa, e.eligible_branches, e.skills_required, e.backlogs_allowed
    FROM JOB_POSTING j
    LEFT JOIN ELIGIBILITY e ON e.job_id = j.job_id`;

function criteriaFromRow(row) {
  if (!row || row.criteriaJobId === null || row.criteriaJobId === undefined) return null;
  return {
    minCgpa: row.minCgpa,
    eligibleBranches: row.eligibleBranches,
    skillsRequired: row.skillsRequired,
    backlogsAllowed: row.backlogsAllowed,
  };
}

async function loadStudentSkills(studentIds) {
  const rows = await db.query(
    `SELECT ss.student_id, sk.skill_name
       FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id`,
  );
  const map = new Map();
  for (const r of rows) {
    if (studentIds && !studentIds.includes(r.studentId)) continue;
    if (!map.has(r.studentId)) map.set(r.studentId, []);
    map.get(r.studentId).push(r.skillName);
  }
  return map;
}

function isOpen(deadline) {
  if (!deadline) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(deadline) >= today;
}

/** Eligibility of one student for one job, loaded from Oracle. */
async function checkStudentForJob(studentId, jobId) {
  const student = await db.queryOne(`${STUDENT_SQL} WHERE s.person_id = :id`, { id: studentId });
  if (!student) return null;
  const jobRow = await db.queryOne(`${CRITERIA_SQL} WHERE j.job_id = :id`, { id: jobId });
  if (!jobRow) return null;
  const skills = (await loadStudentSkills([studentId])).get(studentId) || [];
  const criteria = criteriaFromRow(jobRow);
  return {
    jobId,
    jobTitle: jobRow.jobTitle,
    student: { studentId: student.studentId, name: student.name, rollNo: student.rollNo, cgpa: student.cgpa, deptName: student.deptName },
    criteria,
    applicationOpen: isOpen(jobRow.applicationDeadline),
    ...evaluate(student, criteria, skills),
  };
}

/** Matrix of every (student, job) pair - used by dashboards and the eligibility report. */
async function matrix({ studentId, jobId } = {}) {
  const students = await db.query(
    `${STUDENT_SQL}${studentId ? ' WHERE s.person_id = :sid' : ''} ORDER BY s.roll_no`,
    studentId ? { sid: studentId } : {},
  );
  const jobs = await db.query(
    `${CRITERIA_SQL}${jobId ? ' WHERE j.job_id = :jid' : ''} ORDER BY j.job_id`,
    jobId ? { jid: jobId } : {},
  );
  const skills = await loadStudentSkills(students.map((s) => s.studentId));
  const out = [];
  for (const job of jobs) {
    const criteria = criteriaFromRow(job);
    for (const s of students) {
      out.push({
        jobId: job.jobId,
        jobTitle: job.jobTitle,
        applicationOpen: isOpen(job.applicationDeadline),
        student: s,
        ...evaluate(s, criteria, skills.get(s.studentId) || []),
      });
    }
  }
  return out;
}

module.exports = { evaluate, splitList, checkStudentForJob, matrix, isOpen };
