const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const eligibility = require('../services/eligibilityService');

/**
 * Every report is an Oracle query. Filters are applied with bind variables;
 * only the column names below (never user input) are interpolated into SQL.
 *
 * Each definition:
 *   title, columns, sql (with a {{WHERE}} placeholder),
 *   filters: map of supported filter -> SQL column/expression
 */
const REPORTS = {
  students: {
    title: 'Student master report',
    columns: [
      ['rollNo', 'Roll no'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['deptName', 'Department'],
      ['cgpa', 'CGPA'], ['batchYear', 'Batch'], ['gender', 'Gender'], ['skills', 'Skills'], ['placedCompany', 'Placed at'],
    ],
    sql: `SELECT s.roll_no, p.name, p.email, p.phone, d.dept_name, s.cgpa, s.batch_year, s.gender,
                 (SELECT LISTAGG(sk.skill_name, ', ') WITHIN GROUP (ORDER BY sk.skill_name)
                    FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id WHERE ss.student_id = s.person_id) AS skills,
                 c.company_name AS placed_company
            FROM STUDENT s JOIN PERSON p ON p.person_id = s.person_id
            JOIN DEPARTMENT d ON d.dept_id = s.dept_id
            LEFT JOIN PLACEMENT pl ON pl.student_id = s.person_id
            LEFT JOIN COMPANY c ON c.company_id = pl.company_id
           {{WHERE}} ORDER BY s.roll_no`,
    filters: { deptId: 's.dept_id', companyId: 'pl.company_id' },
  },

  'department-students': {
    title: 'Department-wise student report',
    columns: [
      ['deptName', 'Department'], ['hodName', 'HOD'], ['students', 'Students'], ['avgCgpa', 'Average CGPA'],
      ['maxCgpa', 'Highest CGPA'], ['applications', 'Applications'], ['placed', 'Placed'],
    ],
    sql: `SELECT d.dept_name, d.hod_name, COUNT(DISTINCT s.person_id) AS students,
                 ROUND(AVG(s.cgpa), 2) AS avg_cgpa, MAX(s.cgpa) AS max_cgpa,
                 (SELECT COUNT(*) FROM APPLICATION a JOIN STUDENT s2 ON s2.person_id = a.student_id WHERE s2.dept_id = d.dept_id) AS applications,
                 COUNT(DISTINCT pl.student_id) AS placed
            FROM DEPARTMENT d LEFT JOIN STUDENT s ON s.dept_id = d.dept_id
            LEFT JOIN PLACEMENT pl ON pl.student_id = s.person_id
           {{WHERE}} GROUP BY d.dept_id, d.dept_name, d.hod_name ORDER BY d.dept_name`,
    filters: { deptId: 'd.dept_id' },
  },

  'company-jobs': {
    title: 'Company-wise job posting report',
    columns: [
      ['companyName', 'Company'], ['industry', 'Industry'], ['jobTitle', 'Job'], ['jobType', 'Type'],
      ['salaryLpa', 'Salary (LPA)'], ['vacancies', 'Vacancies'], ['driveDate', 'Drive date'],
      ['applicationDeadline', 'Deadline'], ['applicants', 'Applicants'],
    ],
    sql: `SELECT c.company_name, c.industry, j.job_title, j.job_type, j.salary_lpa, j.vacancies,
                 j.drive_date, j.application_deadline,
                 (SELECT COUNT(*) FROM APPLICATION a WHERE a.job_id = j.job_id) AS applicants
            FROM COMPANY c JOIN JOB_POSTING j ON j.company_id = c.company_id
           {{WHERE}} ORDER BY c.company_name, j.drive_date`,
    filters: { companyId: 'c.company_id', jobId: 'j.job_id', date: 'j.drive_date' },
  },

  'job-applications': {
    title: 'Job-wise application report',
    columns: [
      ['jobTitle', 'Job'], ['companyName', 'Company'], ['total', 'Total'], ['applied', 'Applied'],
      ['shortlisted', 'Shortlisted'], ['rejected', 'Rejected'], ['selected', 'Selected'], ['withdrawn', 'Withdrawn'],
    ],
    sql: `SELECT j.job_title, c.company_name, COUNT(a.application_id) AS total,
                 SUM(CASE WHEN a.status = 'APPLIED' THEN 1 ELSE 0 END) AS applied,
                 SUM(CASE WHEN a.status = 'SHORTLISTED' THEN 1 ELSE 0 END) AS shortlisted,
                 SUM(CASE WHEN a.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
                 SUM(CASE WHEN a.status = 'SELECTED' THEN 1 ELSE 0 END) AS selected,
                 SUM(CASE WHEN a.status = 'WITHDRAWN' THEN 1 ELSE 0 END) AS withdrawn
            FROM JOB_POSTING j JOIN COMPANY c ON c.company_id = j.company_id
            LEFT JOIN APPLICATION a ON a.job_id = j.job_id
           {{WHERE}} GROUP BY j.job_id, j.job_title, c.company_name ORDER BY c.company_name, j.job_title`,
    filters: { companyId: 'c.company_id', jobId: 'j.job_id', date: 'a.apply_date' },
  },

  eligibility: {
    title: 'Eligible versus ineligible student report',
    columns: [
      ['jobTitle', 'Job'], ['rollNo', 'Roll no'], ['studentName', 'Student'], ['deptName', 'Department'],
      ['cgpa', 'CGPA'], ['result', 'Result'], ['reasons', 'Unmet criteria'],
    ],
    computed: true,
  },

  'shortlist-reject': {
    title: 'Shortlisted and rejected student report',
    columns: [
      ['rollNo', 'Roll no'], ['studentName', 'Student'], ['deptName', 'Department'], ['cgpa', 'CGPA'],
      ['companyName', 'Company'], ['jobTitle', 'Job'], ['status', 'Status'], ['applyDate', 'Applied on'],
    ],
    sql: `SELECT s.roll_no, p.name AS student_name, d.dept_name, s.cgpa, c.company_name, j.job_title, a.status, a.apply_date
            FROM APPLICATION a JOIN STUDENT s ON s.person_id = a.student_id
            JOIN PERSON p ON p.person_id = s.person_id JOIN DEPARTMENT d ON d.dept_id = s.dept_id
            JOIN JOB_POSTING j ON j.job_id = a.job_id JOIN COMPANY c ON c.company_id = j.company_id
           WHERE a.status IN ('SHORTLISTED', 'REJECTED') {{AND}} ORDER BY a.status, c.company_name, s.roll_no`,
    filters: { deptId: 's.dept_id', companyId: 'c.company_id', jobId: 'j.job_id', status: 'a.status', date: 'a.apply_date' },
  },

  interviews: {
    title: 'Interview schedule and results report',
    columns: [
      ['interviewDate', 'Date & time'], ['studentName', 'Student'], ['rollNo', 'Roll no'], ['companyName', 'Company'],
      ['jobTitle', 'Job'], ['interviewType', 'Type'], ['roundNo', 'Round'], ['officerName', 'Officer'],
      ['result', 'Result'], ['feedback', 'Feedback'],
    ],
    sql: `SELECT i.interview_date, sp.name AS student_name, s.roll_no, c.company_name, j.job_title,
                 i.interview_type, i.round_no, op.name AS officer_name, i.result, i.feedback
            FROM INTERVIEW i JOIN APPLICATION a ON a.application_id = i.application_id
            JOIN STUDENT s ON s.person_id = a.student_id JOIN PERSON sp ON sp.person_id = s.person_id
            JOIN PERSON op ON op.person_id = i.officer_id
            JOIN JOB_POSTING j ON j.job_id = a.job_id JOIN COMPANY c ON c.company_id = j.company_id
           {{WHERE}} ORDER BY i.interview_date`,
    filters: { deptId: 's.dept_id', companyId: 'c.company_id', jobId: 'j.job_id', status: 'i.result', date: 'i.interview_date' },
  },

  'pending-offers': {
    title: 'Pending offer report',
    columns: [
      ['offerDate', 'Offer date'], ['studentName', 'Student'], ['rollNo', 'Roll no'], ['deptName', 'Department'],
      ['companyName', 'Company'], ['jobTitle', 'Job'], ['offeredSalaryLpa', 'Salary (LPA)'], ['ctc', 'CTC'], ['joiningDate', 'Joining'],
    ],
    sql: `SELECT o.offer_date, p.name AS student_name, s.roll_no, d.dept_name, c.company_name, j.job_title,
                 o.offered_salary_lpa, o.ctc, o.joining_date
            FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
            JOIN STUDENT s ON s.person_id = a.student_id JOIN PERSON p ON p.person_id = s.person_id
            JOIN DEPARTMENT d ON d.dept_id = s.dept_id
            JOIN JOB_POSTING j ON j.job_id = a.job_id JOIN COMPANY c ON c.company_id = j.company_id
           WHERE o.offer_status = 'PENDING' {{AND}} ORDER BY o.offer_date`,
    filters: { deptId: 's.dept_id', companyId: 'c.company_id', jobId: 'j.job_id', date: 'o.offer_date' },
  },

  'offer-decisions': {
    title: 'Accepted and rejected offer report',
    columns: [
      ['offerStatus', 'Status'], ['offerDate', 'Offer date'], ['studentName', 'Student'], ['rollNo', 'Roll no'],
      ['companyName', 'Company'], ['jobTitle', 'Job'], ['offeredSalaryLpa', 'Salary (LPA)'], ['ctc', 'CTC'],
    ],
    sql: `SELECT o.offer_status, o.offer_date, p.name AS student_name, s.roll_no, c.company_name, j.job_title,
                 o.offered_salary_lpa, o.ctc
            FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
            JOIN STUDENT s ON s.person_id = a.student_id JOIN PERSON p ON p.person_id = s.person_id
            JOIN JOB_POSTING j ON j.job_id = a.job_id JOIN COMPANY c ON c.company_id = j.company_id
           WHERE o.offer_status IN ('ACCEPTED', 'REJECTED') {{AND}} ORDER BY o.offer_status, o.offer_date`,
    filters: { deptId: 's.dept_id', companyId: 'c.company_id', jobId: 'j.job_id', status: 'o.offer_status', date: 'o.offer_date' },
  },

  placements: {
    title: 'Final placement report',
    columns: [
      ['placementId', 'ID'], ['studentName', 'Student'], ['rollNo', 'Roll no'], ['deptName', 'Department'],
      ['companyName', 'Company'], ['jobTitle', 'Job'], ['packageLpa', 'Package (LPA)'], ['placedOn', 'Placed on'],
      ['joiningDate', 'Joining'], ['placementStatus', 'Status'],
    ],
    sql: `SELECT pd.placement_id, pd.student_name, s.roll_no, d.dept_name, pd.company_name, pd.job_title,
                 pd.package_lpa, pl.placed_on, pd.joining_date, pd.placement_status
            FROM PLACEMENT_DETAILS pd JOIN PLACEMENT pl ON pl.placement_id = pd.placement_id
            JOIN STUDENT s ON s.person_id = pl.student_id JOIN DEPARTMENT d ON d.dept_id = s.dept_id
           {{WHERE}} ORDER BY pl.placed_on DESC`,
    filters: { deptId: 's.dept_id', companyId: 'pl.company_id', date: 'pl.placed_on' },
  },

  'package-wise': {
    title: 'Package-wise placement report',
    columns: [['bucket', 'Package band'], ['placed', 'Students placed'], ['minPackage', 'Lowest (LPA)'], ['maxPackage', 'Highest (LPA)'], ['avgPackage', 'Average (LPA)']],
    sql: `SELECT bucket, COUNT(*) AS placed, MIN(package_lpa) AS min_package, MAX(package_lpa) AS max_package,
                 ROUND(AVG(package_lpa), 2) AS avg_package
            FROM (SELECT pl.package_lpa,
                         CASE WHEN pl.package_lpa < 5 THEN '1. Below 5 LPA'
                              WHEN pl.package_lpa < 10 THEN '2. 5 - 10 LPA'
                              WHEN pl.package_lpa < 15 THEN '3. 10 - 15 LPA'
                              ELSE '4. 15 LPA and above' END AS bucket
                    FROM PLACEMENT pl JOIN STUDENT s ON s.person_id = pl.student_id
                   {{WHERE}})
           GROUP BY bucket ORDER BY bucket`,
    filters: { deptId: 's.dept_id', companyId: 'pl.company_id', date: 'pl.placed_on' },
  },

  'department-placement': {
    title: 'Department-wise placement percentage',
    columns: [['deptName', 'Department'], ['students', 'Students'], ['placed', 'Placed'], ['percentage', 'Placement %'], ['avgPackage', 'Average package (LPA)']],
    sql: `SELECT d.dept_name, COUNT(DISTINCT s.person_id) AS students, COUNT(DISTINCT pl.student_id) AS placed,
                 CASE WHEN COUNT(DISTINCT s.person_id) = 0 THEN 0
                      ELSE ROUND(COUNT(DISTINCT pl.student_id) / COUNT(DISTINCT s.person_id) * 100, 2) END AS percentage,
                 ROUND(AVG(pl.package_lpa), 2) AS avg_package
            FROM DEPARTMENT d LEFT JOIN STUDENT s ON s.dept_id = d.dept_id
            LEFT JOIN PLACEMENT pl ON pl.student_id = s.person_id
           {{WHERE}} GROUP BY d.dept_name ORDER BY d.dept_name`,
    filters: { deptId: 'd.dept_id' },
  },

  audit: {
    title: 'Application status history (audit) report',
    columns: [
      ['auditId', 'Audit ID'], ['applicationId', 'Application'], ['studentName', 'Student'], ['jobTitle', 'Job'],
      ['companyName', 'Company'], ['oldStatus', 'From'], ['newStatus', 'To'], ['changedOn', 'Changed on'], ['changedBy', 'DB user'],
    ],
    sql: `SELECT au.audit_id, au.application_id, p.name AS student_name, j.job_title, c.company_name,
                 au.old_status, au.new_status, au.changed_on, au.changed_by
            FROM APPLICATION_AUDIT au
            LEFT JOIN APPLICATION a ON a.application_id = au.application_id
            LEFT JOIN PERSON p ON p.person_id = a.student_id
            LEFT JOIN STUDENT s ON s.person_id = a.student_id
            LEFT JOIN JOB_POSTING j ON j.job_id = a.job_id
            LEFT JOIN COMPANY c ON c.company_id = j.company_id
           {{WHERE}} ORDER BY au.changed_on DESC, au.audit_id DESC`,
    filters: { deptId: 's.dept_id', companyId: 'c.company_id', jobId: 'j.job_id', status: 'au.new_status', date: 'au.changed_on' },
  },
};

function parseDate(value, endOfDay) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!m) throw new AppError(400, 'Dates must be in YYYY-MM-DD format.');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (endOfDay) d.setDate(d.getDate() + 1); // exclusive upper bound
  return d;
}

function buildFilters(def, q) {
  const where = [];
  const binds = {};
  const f = def.filters || {};
  const num = (v) => (v && Number.isInteger(Number(v)) ? Number(v) : null);

  if (f.deptId && num(q.deptId)) { where.push(`${f.deptId} = :deptId`); binds.deptId = num(q.deptId); }
  if (f.companyId && num(q.companyId)) { where.push(`${f.companyId} = :companyId`); binds.companyId = num(q.companyId); }
  if (f.jobId && num(q.jobId)) { where.push(`${f.jobId} = :jobId`); binds.jobId = num(q.jobId); }
  if (f.status && q.status) { where.push(`${f.status} = :status`); binds.status = String(q.status).toUpperCase().slice(0, 30); }
  if (f.date) {
    const from = parseDate(q.from, false);
    const to = parseDate(q.to, true);
    if (from) { where.push(`${f.date} >= :fromDate`); binds.fromDate = from; }
    if (to) { where.push(`${f.date} < :toDate`); binds.toDate = to; }
  }
  return { where, binds };
}

async function eligibilityReport(q) {
  const jobId = q.jobId && Number.isInteger(Number(q.jobId)) ? Number(q.jobId) : undefined;
  let rows = await eligibility.matrix({ jobId });
  if (q.deptId) rows = rows.filter((r) => r.student.deptId === Number(q.deptId));
  if (q.status) rows = rows.filter((r) => (r.eligible ? 'ELIGIBLE' : 'INELIGIBLE') === String(q.status).toUpperCase());
  return rows.map((r) => ({
    jobTitle: r.jobTitle,
    rollNo: r.student.rollNo,
    studentName: r.student.name,
    deptName: r.student.deptName,
    cgpa: r.student.cgpa,
    result: r.eligible ? 'ELIGIBLE' : 'INELIGIBLE',
    reasons: r.unmet.join(' '),
  }));
}

function catalog(req, res) {
  res.json(Object.entries(REPORTS).map(([key, def]) => ({
    key,
    title: def.title,
    filters: def.computed ? ['deptId', 'jobId', 'status'] : Object.keys(def.filters || {}),
  })));
}

async function run(req, res) {
  const def = REPORTS[req.params.type];
  if (!def) throw new AppError(404, 'Unknown report.');
  let rows;
  if (def.computed) {
    rows = await eligibilityReport(req.query);
  } else {
    const { where, binds } = buildFilters(def, req.query);
    const sql = def.sql
      .replace('{{WHERE}}', where.length ? `WHERE ${where.join(' AND ')}` : '')
      .replace('{{AND}}', where.length ? `AND ${where.join(' AND ')}` : '');
    rows = await db.query(sql, binds);
  }
  res.json({
    key: req.params.type,
    title: def.title,
    generatedAt: new Date(),
    filters: req.query,
    columns: def.columns.map(([key, label]) => ({ key, label })),
    rows,
  });
}

module.exports = { catalog, run, REPORTS };
