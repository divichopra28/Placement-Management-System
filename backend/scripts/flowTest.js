/*
 * End-to-end test of the placement workflow over HTTP against the real Oracle schema.
 * Requires the API to be running (npm start). Creates its own temporary officer,
 * company, jobs and students (prefixed ZZTEST) and removes them afterwards, so the
 * sample data is left untouched.
 *   npm run test:flow
 */
const db = require('../config/db');
const { setPassword } = require('../services/accountService');

const BASE = process.env.API_URL || 'http://localhost:5000/api';
const TAG = `ZZTEST${Date.now().toString().slice(-6)}`;
const PASSWORD = 'FlowTest123';
let passed = 0;
let failed = 0;

function ok(cond, label, extra) {
  if (cond) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.log(`  FAIL  ${label}${extra ? `  -> ${JSON.stringify(extra)}` : ''}`); }
}

function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
  };
}

const ids = { students: [], jobs: [], company: null, officer: null };

async function main() {
  console.log(`Flow test against ${BASE} (tag ${TAG})\n`);

  // Temporary officer created directly in Oracle (officers have no self-registration).
  ids.officer = await db.withTransaction(async (conn) => {
    const r = await db.run(conn,
      `INSERT INTO PERSON (person_id, name, email) VALUES (person_seq.NEXTVAL, :n, :e) RETURNING person_id INTO :id`,
      { n: `${TAG} Officer`, e: `${TAG.toLowerCase()}.officer@test.local`, id: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } });
    const id = r.outBinds.id[0];
    await db.run(conn, 'INSERT INTO PLACEMENT_OFFICER (person_id, employee_id, designation) VALUES (:id, :emp, :d)',
      { id, emp: `${TAG}PO`, d: 'Test Officer' });
    await setPassword(conn, id, PASSWORD);
    return id;
  });

  const officer = client();
  const a = client();
  const b = client();

  console.log('Authentication');
  ok((await officer('POST', '/auth/login', { identifier: `${TAG}PO`, password: 'wrong-pass1', role: 'OFFICER' })).status === 401, 'wrong password rejected (401)');
  ok((await officer('POST', '/auth/login', { identifier: `${TAG}PO`, password: PASSWORD, role: 'STUDENT' })).status === 403, 'officer on student tab rejected (403)');
  ok((await officer('POST', '/auth/login', { identifier: `${TAG}PO`, password: PASSWORD, role: 'OFFICER' })).status === 200, 'officer login by employee id');
  ok((await client()('GET', '/students')).status === 401, 'unauthenticated request rejected (401)');

  console.log('Companies');
  ok((await officer('POST', '/companies', { companyName: `${TAG} Corp`, contactEmail: 'not-an-email' })).status === 400, 'invalid email rejected');
  const comp = await officer('POST', '/companies', { companyName: `${TAG} Corp`, industry: 'Testing', website: 'https://example.com', location: 'Pune', contactEmail: 'hr@example.com', phone: '9000000099' });
  ok(comp.status === 201, 'company created', comp.data);
  ids.company = comp.data?.companyId;
  ok((await officer('PUT', `/companies/${ids.company}`, { ...comp.data, location: 'Mumbai' })).data?.location === 'Mumbai', 'company edited');

  console.log('Jobs & eligibility');
  const future = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const job1 = await officer('POST', '/jobs', {
    companyId: ids.company, jobTitle: `${TAG} Engineer`, jobType: 'Full Time', salaryLpa: 12, location: 'Pune', vacancies: 2,
    driveDate: future(20), applicationDeadline: future(10),
    eligibility: { minCgpa: 8, eligibleBranches: 'Computer Engineering', skillsRequired: 'Java', backlogsAllowed: 0 },
  });
  ok(job1.status === 201 && job1.data.minCgpa === 8, 'job + eligibility created in one transaction', job1.data);
  ids.jobs.push(job1.data.jobId);
  const job2 = await officer('POST', '/jobs', {
    companyId: ids.company, jobTitle: `${TAG} Analyst`, vacancies: 1, applicationDeadline: future(10), eligibility: { minCgpa: 6 },
  });
  ids.jobs.push(job2.data.jobId);
  ok((await officer('POST', '/jobs', { companyId: ids.company, jobTitle: 'x', vacancies: 0 })).status === 400, 'vacancies = 0 rejected');

  console.log('Students');
  const deptCE = (await officer('GET', '/departments')).data.find((d) => d.deptName === 'Computer Engineering').deptId;
  const sa = await officer('POST', '/students', { name: `${TAG} Alice`, email: `${TAG.toLowerCase()}.a@test.local`, rollNo: `${TAG}A`, cgpa: 8.6, batchYear: 2027, gender: 'F', deptId: deptCE, password: PASSWORD });
  const sb = await officer('POST', '/students', { name: `${TAG} Bob`, email: `${TAG.toLowerCase()}.b@test.local`, rollNo: `${TAG}B`, cgpa: 7.1, batchYear: 2027, gender: 'M', deptId: deptCE, password: PASSWORD });
  ok(sa.status === 201 && sb.status === 201, 'students created with login accounts', sa.data);
  ids.students.push(sa.data.studentId, sb.data.studentId);
  ok((await officer('POST', '/students', { name: 'x', email: 'y@z.com', rollNo: 'Q1', cgpa: 11, deptId: deptCE })).status === 400, 'CGPA > 10 rejected');
  ok((await officer('POST', '/students', { name: 'Dup', email: `${TAG.toLowerCase()}.a@test.local`, rollNo: `${TAG}Z`, deptId: deptCE })).status === 409, 'duplicate email rejected (unique constraint)');

  ok((await a('POST', '/auth/login', { identifier: `${TAG}A`, password: PASSWORD, role: 'STUDENT' })).status === 200, 'student login by roll number');
  await b('POST', '/auth/login', { identifier: `${TAG.toLowerCase()}.b@test.local`, password: PASSWORD, role: 'STUDENT' });

  console.log('Authorization');
  ok((await a('GET', `/students/${ids.students[1]}`)).status === 403, "student cannot read another student's profile");
  ok((await a('GET', '/students')).status === 403, 'student cannot list students');
  ok((await a('POST', '/companies', { companyName: 'x' })).status === 403, 'student cannot create companies');
  ok((await a('PUT', '/students/me', { cgpa: 10 })).status === 400, 'student cannot edit own CGPA');
  ok((await a('PUT', '/students/me', { phone: '9123456789' })).data?.phone === '9123456789', 'student can edit own phone');

  console.log('Applications');
  const javaId = (await a('GET', '/skills')).data.find((s) => s.skillName === 'Java').skillId;
  const noSkill = await a('POST', '/applications', { jobId: ids.jobs[0] });
  ok(noSkill.status === 422 && /Java/.test(noSkill.data.error), 'missing required skill blocks application', noSkill.data);
  await a('PUT', `/students/me/skills/${javaId}`, { proficiencyLevel: 'Advanced', certification: 'Test cert' });
  await b('PUT', `/students/me/skills/${javaId}`, { proficiencyLevel: 'Beginner' });
  const elig = await a('GET', `/jobs/${ids.jobs[0]}/eligibility/me`);
  ok(elig.data?.eligible === true, 'eligibility checker: eligible', elig.data?.unmet);
  ok(elig.data?.checks.find((c) => c.key === 'backlogs').status === 'UNKNOWN', 'backlogs reported as UNKNOWN (not fabricated)');
  const bobApply = await b('POST', '/applications', { jobId: ids.jobs[0] });
  ok(bobApply.status === 422 && /Minimum CGPA required/.test(bobApply.data.error) && bobApply.data.details?.oracle === 'ORA-20001',
    'TRG_CHECK_ELIGIBILITY rejects low CGPA (ORA-20001)', bobApply.data);
  const app1 = await a('POST', '/applications', { jobId: ids.jobs[0] });
  ok(app1.status === 201 && app1.data.status === 'APPLIED', 'APPLY_FOR_JOB procedure inserts application', app1.data);
  const dupApply = await a('POST', '/applications', { jobId: ids.jobs[0] });
  ok(dupApply.status === 409 && dupApply.data.details?.constraint === 'UQ_STUDENT_JOB', 'duplicate application blocked by UQ_STUDENT_JOB', dupApply.data);
  const app2 = await a('POST', '/applications', { jobId: ids.jobs[1] });
  const appId = app1.data.applicationId;

  ok((await officer('PATCH', `/applications/${appId}/status`, { status: 'SELECTED' })).status === 400, 'officer cannot set SELECTED directly');
  const sl = await officer('PATCH', `/applications/${appId}/status`, { status: 'SHORTLISTED' });
  ok(sl.data?.status === 'SHORTLISTED', 'officer shortlists application');

  console.log('Interviews');
  const when = new Date(); when.setDate(when.getDate() + 5); when.setHours(10, 30, 0, 0);
  const iv = await officer('POST', '/interviews', { applicationId: appId, officerId: ids.officer, interviewDate: when.toISOString(), interviewType: 'Technical', roundNo: 1 });
  ok(iv.status === 201 && iv.data.result === 'PENDING', 'SCHEDULE_INTERVIEW procedure creates interview', iv.data);
  ok((await officer('POST', '/interviews', { applicationId: appId, officerId: ids.officer, interviewDate: when.toISOString(), interviewType: 'HR', roundNo: 1 })).status === 409, 'duplicate round blocked');
  const past = new Date(Date.now() - 86400000).toISOString();
  ok((await officer('POST', '/interviews', { applicationId: appId, officerId: ids.officer, interviewDate: past, interviewType: 'HR', roundNo: 2 })).status === 400, 'past interview date rejected');
  const ivu = await officer('PUT', `/interviews/${iv.data.interviewId}`, { officerId: ids.officer, interviewDate: when.toISOString(), interviewType: 'Technical', roundNo: 1, result: 'PASS', feedback: 'Internal: strong Java' });
  ok(ivu.data?.result === 'PASS', 'interview result recorded');
  const studentIv = (await a('GET', '/interviews')).data;
  ok(studentIv.length === 1 && !('feedback' in studentIv[0]), 'student sees own interview without internal feedback');

  console.log('Offers & placement (trigger-driven)');
  const off = await officer('POST', '/offers', { applicationId: appId, offeredSalaryLpa: 12, ctc: 13.5, joiningDate: future(60) });
  ok(off.status === 201 && off.data.offerStatus === 'PENDING', 'CREATE_OFFER procedure creates offer', off.data);
  ok(off.data?.applicationStatus === 'SELECTED', 'TRG_OFFER_APPLICATION set application to SELECTED');
  ok((await officer('POST', '/offers', { applicationId: appId, offeredSalaryLpa: 12 })).status === 409, 'second offer for same application blocked');
  const acc = await a('PATCH', `/offers/${off.data.offerId}/status`, { status: 'ACCEPTED' });
  ok(acc.data?.offerStatus === 'ACCEPTED' && acc.data?.placementId, 'TRG_CREATE_PLACEMENT created placement on acceptance', acc.data);
  const pls = (await a('GET', '/placements')).data;
  ok(pls.length === 1 && pls[0].packageLpa === 12, 'placement visible via PLACEMENT_DETAILS view');

  await officer('PATCH', `/applications/${app2.data.applicationId}/status`, { status: 'SHORTLISTED' });
  const off2 = await officer('POST', '/offers', { applicationId: app2.data.applicationId, offeredSalaryLpa: 8 });
  const acc2 = await officer('PATCH', `/offers/${off2.data.offerId}/status`, { status: 'ACCEPTED' });
  ok(acc2.status === 422 && /already has a placement/.test(acc2.data.error), 'TRG_ONE_PLACEMENT_PER_STUDENT blocks a second placement (ORA-20003)', acc2.data);
  const off2After = (await officer('GET', '/offers')).data.find((o) => o.offerId === off2.data.offerId);
  ok(off2After.offerStatus === 'PENDING', 'failed acceptance was rolled back (offer still PENDING)');

  console.log('Audit, dashboard, reports');
  const hist = (await officer('GET', `/applications/${appId}`)).data.history.map((h) => `${h.oldStatus}>${h.newStatus}`);
  ok(hist.join(',') === 'APPLIED>SHORTLISTED,SHORTLISTED>SELECTED', 'TRG_APPLICATION_AUDIT logged both status changes', hist);
  ok((await a('GET', '/audit-logs')).status === 403, 'students cannot read audit logs');
  const dash = await officer('GET', '/dashboard/admin');
  ok(typeof dash.data?.totals?.placementPercentage === 'number' && dash.data.totals.placed >= 1, 'admin dashboard uses PLACEMENT_PERCENTAGE()', dash.data?.totals);
  const sdash = await a('GET', '/dashboard/student');
  ok(sdash.data?.placement?.companyName === `${TAG} Corp`, 'student dashboard shows confirmed placement');
  const rep = await officer('GET', `/reports/placements?companyId=${ids.company}`);
  ok(rep.data?.rows?.length === 1, 'filtered placement report');

  console.log('Delete protections');
  ok((await officer('DELETE', `/companies/${ids.company}`)).status === 409, 'company with jobs cannot be deleted');
  ok((await officer('DELETE', `/jobs/${ids.jobs[0]}`)).status === 409, 'job with applications cannot be deleted');
}

async function cleanup() {
  await db.withTransaction(async (conn) => {
    const studentList = ids.students.length ? ids.students : [-1];
    const sBind = Object.fromEntries(studentList.map((s, i) => [`s${i}`, s]));
    const sIn = studentList.map((_, i) => `:s${i}`).join(',');
    const apps = `(SELECT application_id FROM APPLICATION WHERE student_id IN (${sIn}))`;
    await db.run(conn, `DELETE FROM PLACEMENT WHERE student_id IN (${sIn})`, sBind);
    await db.run(conn, `DELETE FROM OFFER WHERE application_id IN ${apps}`, sBind);
    await db.run(conn, `DELETE FROM INTERVIEW WHERE application_id IN ${apps}`, sBind);
    await db.run(conn, `DELETE FROM APPLICATION_AUDIT WHERE application_id IN ${apps}`, sBind);
    await db.run(conn, `DELETE FROM APPLICATION WHERE student_id IN (${sIn})`, sBind);
    await db.run(conn, `DELETE FROM STUDENT_SKILL WHERE student_id IN (${sIn})`, sBind);
    await db.run(conn, `DELETE FROM STUDENT_RESUME WHERE student_id IN (${sIn})`, sBind);
    for (const j of ids.jobs) {
      await db.run(conn, 'DELETE FROM ELIGIBILITY WHERE job_id = :j', { j });
      await db.run(conn, 'DELETE FROM JOB_POSTING WHERE job_id = :j', { j });
    }
    if (ids.company) await db.run(conn, 'DELETE FROM COMPANY WHERE company_id = :c', { c: ids.company });
    await db.run(conn, `DELETE FROM USER_ACCOUNT WHERE person_id IN (SELECT person_id FROM PERSON WHERE name LIKE :t)`, { t: `${TAG}%` });
    await db.run(conn, `DELETE FROM STUDENT WHERE person_id IN (${sIn})`, sBind);
    await db.run(conn, 'DELETE FROM PLACEMENT_OFFICER WHERE employee_id = :e', { e: `${TAG}PO` });
    await db.run(conn, 'DELETE FROM PERSON WHERE name LIKE :t', { t: `${TAG}%` });
  });
}

main()
  .catch((err) => { failed += 1; console.error('\nTest aborted:', err); })
  .finally(async () => {
    try { await cleanup(); console.log('\nTemporary test data removed.'); } catch (err) { console.error('Cleanup failed:', err.message); }
    await db.closePool();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
