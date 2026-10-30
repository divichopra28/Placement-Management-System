const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate, requireOfficer, requireStudent } = require('../middleware/auth');
const { resumeUpload } = require('../middleware/upload');

const auth = require('../controllers/authController');
const students = require('../controllers/studentController');
const companies = require('../controllers/companyController');
const lookups = require('../controllers/lookupController');
const jobs = require('../controllers/jobController');
const applications = require('../controllers/applicationController');
const interviews = require('../controllers/interviewController');
const offers = require('../controllers/offerController');
const placements = require('../controllers/placementController');
const dashboard = require('../controllers/dashboardController');
const reports = require('../controllers/reportController');
const audit = require('../controllers/auditController');
const db = require('../config/db');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
});

router.get('/health', async (req, res) => {
  try {
    const row = await db.queryOne("SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD HH24:MI:SS') AS db_time FROM DUAL");
    res.json({ ok: true, database: 'connected', dbTime: row.dbTime });
  } catch (err) {
    res.status(503).json({ ok: false, database: 'unreachable', error: err.message.split('\n')[0] });
  }
});

/* ------------------------------ auth ------------------------------ */
router.post('/auth/login', loginLimiter, auth.login);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/change-password', authenticate, auth.changePassword);

// Everything below requires a valid session.
router.use(authenticate);

/* ---------------------------- lookups ----------------------------- */
router.get('/departments', lookups.departments);
router.get('/skills', lookups.skills);
router.post('/skills', requireOfficer, lookups.createSkill);
router.get('/officers', requireOfficer, lookups.officers);

/* ---------------------------- students ---------------------------- */
router.get('/students', requireOfficer, students.list);
router.post('/students', requireOfficer, students.create);
router.get('/students/:id', students.getOne);
router.put('/students/:id', students.update);
router.delete('/students/:id', requireOfficer, students.remove);
router.put('/students/:id/account', requireOfficer, students.setAccountPassword);
router.get('/students/:id/skills', students.listSkills);
router.put('/students/:id/skills/:skillId', students.upsertSkill);
router.delete('/students/:id/skills/:skillId', students.removeSkill);
router.post('/students/:id/resume', resumeUpload, students.uploadResume);
router.get('/students/:id/resume', students.downloadResume);

/* ---------------------------- companies --------------------------- */
router.get('/companies', companies.list);
router.get('/companies/:id', companies.getOne);
router.post('/companies', requireOfficer, companies.create);
router.put('/companies/:id', requireOfficer, companies.update);
router.delete('/companies/:id', requireOfficer, companies.remove);

/* ------------------------------ jobs ------------------------------ */
router.get('/jobs', jobs.list);
router.get('/jobs/:id', jobs.getOne);
router.post('/jobs', requireOfficer, jobs.create);
router.put('/jobs/:id', requireOfficer, jobs.update);
router.patch('/jobs/:id/close', requireOfficer, jobs.close);
router.delete('/jobs/:id', requireOfficer, jobs.remove);
router.get('/jobs/:id/eligibility', jobs.getEligibility);
router.put('/jobs/:id/eligibility', requireOfficer, jobs.putEligibility);
router.get('/jobs/:id/eligibility-matrix', requireOfficer, jobs.eligibilityMatrix);
router.get('/jobs/:id/eligibility/:studentId', jobs.checkEligibility);

/* -------------------------- applications -------------------------- */
router.get('/applications', applications.list);
router.get('/applications/:id', applications.getOne);
router.post('/applications', requireStudent, applications.create);
router.patch('/applications/:id/status', applications.updateStatus);

/* --------------------------- interviews --------------------------- */
router.get('/interviews', interviews.list);
router.post('/interviews', requireOfficer, interviews.create);
router.put('/interviews/:id', requireOfficer, interviews.update);
router.delete('/interviews/:id', requireOfficer, interviews.remove);

/* ----------------------------- offers ----------------------------- */
router.get('/offers', offers.list);
router.post('/offers', requireOfficer, offers.create);
router.put('/offers/:id', requireOfficer, offers.update);
router.patch('/offers/:id/status', offers.updateStatus);

/* --------------------------- placements --------------------------- */
router.get('/placements', placements.list);
router.get('/placements/:id', placements.getOne);

/* ----------------------- dashboard & reports ---------------------- */
router.get('/dashboard/admin', requireOfficer, dashboard.admin);
router.get('/dashboard/student', requireStudent, dashboard.student);
router.get('/reports', requireOfficer, reports.catalog);
router.get('/reports/:type', requireOfficer, reports.run);
router.get('/audit-logs', requireOfficer, audit.list);

module.exports = router;
