const db = require('../config/db');
const eligibility = require('../services/eligibilityService');

async function placementPercentage() {
  // Calls the PLACEMENT_PERCENTAGE PL/SQL function from the supplied schema.
  const r = await db.execute(
    'BEGIN :pct := PLACEMENT_PERCENTAGE(); END;',
    { pct: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } },
  );
  return r.outBinds.pct;
}

async function admin(req, res) {
  const totals = await db.queryOne(`
    SELECT (SELECT COUNT(*) FROM STUDENT) AS students,
           (SELECT COUNT(*) FROM COMPANY) AS companies,
           (SELECT COUNT(*) FROM JOB_POSTING) AS jobs,
           (SELECT COUNT(*) FROM JOB_POSTING WHERE application_deadline IS NULL OR application_deadline >= TRUNC(SYSDATE)) AS open_jobs,
           (SELECT COUNT(*) FROM APPLICATION) AS applications,
           (SELECT COUNT(*) FROM APPLICATION WHERE status = 'SHORTLISTED') AS shortlisted,
           (SELECT COUNT(*) FROM APPLICATION WHERE status = 'SELECTED') AS selected,
           (SELECT COUNT(*) FROM OFFER WHERE offer_status = 'PENDING') AS offers_pending,
           (SELECT COUNT(*) FROM OFFER WHERE offer_status = 'ACCEPTED') AS offers_accepted,
           (SELECT COUNT(*) FROM PLACEMENT) AS placed,
           (SELECT ROUND(AVG(package_lpa), 2) FROM PLACEMENT) AS avg_package,
           (SELECT MAX(package_lpa) FROM PLACEMENT) AS max_package,
           (SELECT COUNT(*) FROM INTERVIEW WHERE interview_date >= SYSDATE AND result = 'PENDING') AS upcoming_interviews
      FROM DUAL`);
  totals.placementPercentage = await placementPercentage();

  const applicationsByStatus = await db.query(
    `SELECT status, COUNT(*) AS count FROM APPLICATION GROUP BY status ORDER BY status`,
  );
  const placementsByDepartment = await db.query(`
    SELECT d.dept_name,
           COUNT(DISTINCT s.person_id) AS students,
           COUNT(DISTINCT pl.student_id) AS placed
      FROM DEPARTMENT d
      LEFT JOIN STUDENT s ON s.dept_id = d.dept_id
      LEFT JOIN PLACEMENT pl ON pl.student_id = s.person_id
     GROUP BY d.dept_name ORDER BY d.dept_name`);
  const placementsByCompany = await db.query(`
    SELECT c.company_name, COUNT(pl.placement_id) AS placed,
           (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
              JOIN JOB_POSTING j ON j.job_id = a.job_id WHERE j.company_id = c.company_id) AS offers
      FROM COMPANY c LEFT JOIN PLACEMENT pl ON pl.company_id = c.company_id
     GROUP BY c.company_id, c.company_name ORDER BY placed DESC, c.company_name`);
  const packageDistribution = await db.query(`
    SELECT bucket, COUNT(*) AS count, MIN(sort_key) AS sort_key FROM (
      SELECT CASE WHEN package_lpa < 5 THEN '< 5 LPA'
                  WHEN package_lpa < 10 THEN '5-10 LPA'
                  WHEN package_lpa < 15 THEN '10-15 LPA'
                  ELSE '15+ LPA' END AS bucket,
             CASE WHEN package_lpa < 5 THEN 1 WHEN package_lpa < 10 THEN 2
                  WHEN package_lpa < 15 THEN 3 ELSE 4 END AS sort_key
        FROM PLACEMENT WHERE package_lpa IS NOT NULL)
     GROUP BY bucket ORDER BY sort_key`);
  const monthlyTrend = await db.query(`
    SELECT m.month,
           (SELECT COUNT(*) FROM APPLICATION a WHERE TO_CHAR(a.apply_date, 'YYYY-MM') = m.month) AS applications,
           (SELECT COUNT(*) FROM PLACEMENT p WHERE TO_CHAR(p.placed_on, 'YYYY-MM') = m.month) AS placements
      FROM (SELECT TO_CHAR(ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -LEVEL + 1), 'YYYY-MM') AS month
              FROM DUAL CONNECT BY LEVEL <= 6) m
     ORDER BY m.month`);
  const jobApplicants = await db.query(`
    SELECT j.job_id, j.job_title || ' (' || c.company_name || ')' AS job_label,
           COUNT(a.application_id) AS applicants
      FROM JOB_POSTING j JOIN COMPANY c ON c.company_id = j.company_id
      LEFT JOIN APPLICATION a ON a.job_id = j.job_id
     GROUP BY j.job_id, j.job_title, c.company_name ORDER BY applicants DESC, j.job_id`);
  const upcomingInterviews = await db.query(`
    SELECT * FROM (
      SELECT i.interview_id, i.interview_date, i.interview_type, i.round_no, p.name AS student_name,
             j.job_title, c.company_name
        FROM INTERVIEW i
        JOIN APPLICATION a ON a.application_id = i.application_id
        JOIN PERSON p ON p.person_id = a.student_id
        JOIN JOB_POSTING j ON j.job_id = a.job_id
        JOIN COMPANY c ON c.company_id = j.company_id
       WHERE i.interview_date >= SYSDATE AND i.result = 'PENDING'
       ORDER BY i.interview_date)
     WHERE ROWNUM <= 5`);
  const recentActivity = await db.query(`
    SELECT * FROM (
      SELECT au.audit_id, au.application_id, au.old_status, au.new_status, au.changed_on,
             p.name AS student_name, j.job_title
        FROM APPLICATION_AUDIT au
        JOIN APPLICATION a ON a.application_id = au.application_id
        JOIN PERSON p ON p.person_id = a.student_id
        JOIN JOB_POSTING j ON j.job_id = a.job_id
       ORDER BY au.changed_on DESC, au.audit_id DESC)
     WHERE ROWNUM <= 6`);

  res.json({
    totals, applicationsByStatus, placementsByDepartment, placementsByCompany,
    packageDistribution, monthlyTrend, jobApplicants, upcomingInterviews, recentActivity,
  });
}

async function student(req, res) {
  const id = req.user.personId;
  const profile = await db.queryOne(
    `SELECT p.name, p.email, p.phone, p.address, s.roll_no, s.cgpa, s.batch_year, d.dept_name,
            (SELECT COUNT(*) FROM STUDENT_SKILL WHERE student_id = s.person_id) AS skill_count,
            (SELECT COUNT(*) FROM STUDENT_RESUME WHERE student_id = s.person_id) AS has_resume
       FROM STUDENT s JOIN PERSON p ON p.person_id = s.person_id
       JOIN DEPARTMENT d ON d.dept_id = s.dept_id WHERE s.person_id = :id`,
    { id },
  );

  // Profile completion over fields that are actually stored.
  const items = [
    { label: 'Phone number', done: Boolean(profile.phone) },
    { label: 'Address', done: Boolean(profile.address) },
    { label: 'CGPA recorded', done: profile.cgpa !== null },
    { label: 'Batch year', done: profile.batchYear !== null },
    { label: 'At least one skill', done: profile.skillCount > 0 },
    { label: 'Resume uploaded', done: profile.hasResume > 0 },
  ];
  const completion = Math.round((items.filter((i) => i.done).length / items.length) * 100);

  const counts = await db.queryOne(
    `SELECT (SELECT COUNT(*) FROM JOB_POSTING WHERE application_deadline IS NULL OR application_deadline >= TRUNC(SYSDATE)) AS open_jobs,
            (SELECT COUNT(*) FROM APPLICATION WHERE student_id = :id) AS applications,
            (SELECT COUNT(*) FROM INTERVIEW i JOIN APPLICATION a ON a.application_id = i.application_id
              WHERE a.student_id = :id AND i.interview_date >= SYSDATE AND i.result = 'PENDING') AS upcoming_interviews,
            (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
              WHERE a.student_id = :id AND o.offer_status = 'PENDING') AS pending_offers
       FROM DUAL`,
    { id },
  );

  const matrix = await eligibility.matrix({ studentId: id });
  const applied = new Set((await db.query('SELECT job_id FROM APPLICATION WHERE student_id = :id', { id })).map((r) => r.jobId));
  const eligibleOpen = matrix.filter((m) => m.eligible && m.applicationOpen && !applied.has(m.jobId));
  counts.eligibleJobs = matrix.filter((m) => m.eligible && m.applicationOpen).length;

  const eligibleJobs = eligibleOpen.length
    ? await db.query(
      `SELECT j.job_id, j.job_title, c.company_name, j.salary_lpa, j.location, j.application_deadline
         FROM JOB_POSTING j JOIN COMPANY c ON c.company_id = j.company_id
        WHERE j.job_id IN (${eligibleOpen.map((_, i) => `:j${i}`).join(',')})
        ORDER BY j.application_deadline NULLS LAST`,
      Object.fromEntries(eligibleOpen.map((m, i) => [`j${i}`, m.jobId])),
    )
    : [];

  // Latest status updates from STUDENT_APPLICATION_VIEW plus audit trail.
  const applications = await db.query(
    `SELECT * FROM (
       SELECT student_name, company_name, job_title, apply_date, status
         FROM STUDENT_APPLICATION_VIEW WHERE student_id = :id ORDER BY apply_date DESC)
      WHERE ROWNUM <= 5`,
    { id },
  );
  const updates = await db.query(
    `SELECT * FROM (
       SELECT au.old_status, au.new_status, au.changed_on, j.job_title, c.company_name
         FROM APPLICATION_AUDIT au
         JOIN APPLICATION a ON a.application_id = au.application_id
         JOIN JOB_POSTING j ON j.job_id = a.job_id
         JOIN COMPANY c ON c.company_id = j.company_id
        WHERE a.student_id = :id ORDER BY au.changed_on DESC, au.audit_id DESC)
      WHERE ROWNUM <= 5`,
    { id },
  );
  const interviews = await db.query(
    `SELECT * FROM (
       SELECT i.interview_id, i.interview_date, i.interview_type, i.round_no, j.job_title, c.company_name
         FROM INTERVIEW i
         JOIN APPLICATION a ON a.application_id = i.application_id
         JOIN JOB_POSTING j ON j.job_id = a.job_id
         JOIN COMPANY c ON c.company_id = j.company_id
        WHERE a.student_id = :id AND i.interview_date >= SYSDATE AND i.result = 'PENDING'
        ORDER BY i.interview_date)
      WHERE ROWNUM <= 5`,
    { id },
  );
  const placement = await db.queryOne(
    `SELECT pd.placement_id, pd.company_name, pd.job_title, pd.package_lpa, pd.joining_date, pd.placement_status
       FROM PLACEMENT_DETAILS pd JOIN PLACEMENT pl ON pl.placement_id = pd.placement_id
      WHERE pl.student_id = :id`,
    { id },
  );

  res.json({ profile, completion, completionItems: items, counts, eligibleJobs, applications, updates, interviews, placement });
}

module.exports = { admin, student };
