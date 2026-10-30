const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const config = require('../config/env');
const { AppError } = require('../middleware/errorHandler');
const { resolveStudentId } = require('../middleware/auth');
const { validate, parseId } = require('../validators');
const { setPassword } = require('../services/accountService');

const PROFICIENCY = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const LIST_SQL = `
  SELECT s.person_id AS student_id, p.name, p.email, p.phone, p.address,
         s.roll_no, s.cgpa, s.batch_year, s.gender, s.dept_id, d.dept_name,
         (SELECT COUNT(*) FROM APPLICATION a WHERE a.student_id = s.person_id) AS application_count,
         (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
           WHERE a.student_id = s.person_id) AS offer_count,
         (SELECT LISTAGG(sk.skill_name, ', ') WITHIN GROUP (ORDER BY sk.skill_name)
            FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id
           WHERE ss.student_id = s.person_id) AS skills,
         pl.placement_id, c.company_name AS placed_company, pl.package_lpa,
         CASE WHEN ua.account_id IS NULL THEN 'N' ELSE ua.is_active END AS has_login
    FROM STUDENT s
    JOIN PERSON p ON p.person_id = s.person_id
    JOIN DEPARTMENT d ON d.dept_id = s.dept_id
    LEFT JOIN PLACEMENT pl ON pl.student_id = s.person_id
    LEFT JOIN COMPANY c ON c.company_id = pl.company_id
    LEFT JOIN USER_ACCOUNT ua ON ua.person_id = s.person_id`;

async function list(req, res) {
  const rows = await db.query(`${LIST_SQL} ORDER BY s.roll_no`);
  res.json(rows);
}

async function getProfile(studentId) {
  const student = await db.queryOne(`${LIST_SQL} WHERE s.person_id = :id`, { id: studentId });
  if (!student) throw new AppError(404, 'Student not found.');

  const skills = await db.query(
    `SELECT ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level, ss.certification
       FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id
      WHERE ss.student_id = :id ORDER BY sk.skill_name`,
    { id: studentId },
  );
  const resume = await db.queryOne(
    'SELECT original_name, uploaded_on FROM STUDENT_RESUME WHERE student_id = :id',
    { id: studentId },
  );
  const counts = await db.queryOne(
    `SELECT
       (SELECT COUNT(*) FROM APPLICATION WHERE student_id = :id) AS applications,
       (SELECT COUNT(*) FROM INTERVIEW i JOIN APPLICATION a ON a.application_id = i.application_id
         WHERE a.student_id = :id) AS interviews,
       (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
         WHERE a.student_id = :id AND o.offer_status = 'PENDING') AS pending_offers,
       (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
         WHERE a.student_id = :id AND o.offer_status = 'ACCEPTED') AS accepted_offers,
       (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
         WHERE a.student_id = :id) AS total_offers
     FROM DUAL`,
    { id: studentId },
  );
  // Latest activity: status changes recorded by TRG_APPLICATION_AUDIT plus new applications.
  const activity = await db.query(
    `SELECT * FROM (
       SELECT 'STATUS' AS kind, au.changed_on AS at, au.old_status, au.new_status,
              j.job_title, c.company_name
         FROM APPLICATION_AUDIT au
         JOIN APPLICATION a ON a.application_id = au.application_id
         JOIN JOB_POSTING j ON j.job_id = a.job_id
         JOIN COMPANY c ON c.company_id = j.company_id
        WHERE a.student_id = :id
       UNION ALL
       SELECT 'APPLIED', a.apply_date, NULL, 'APPLIED', j.job_title, c.company_name
         FROM APPLICATION a
         JOIN JOB_POSTING j ON j.job_id = a.job_id
         JOIN COMPANY c ON c.company_id = j.company_id
        WHERE a.student_id = :id
       ORDER BY 2 DESC
     ) WHERE ROWNUM <= 8`,
    { id: studentId },
  );

  let offerStatus = 'No offers';
  if (counts.acceptedOffers) offerStatus = 'Accepted';
  else if (counts.pendingOffers) offerStatus = `${counts.pendingOffers} pending`;
  else if (counts.totalOffers) offerStatus = 'Declined';

  return { ...student, skillList: skills, resume, counts, offerStatus, activity };
}

async function getOne(req, res) {
  res.json(await getProfile(resolveStudentId(req)));
}

const CREATE_RULES = {
  name: { type: 'string', required: true, max: 100, label: 'Name' },
  email: { type: 'email', required: true, label: 'Email' },
  phone: { type: 'phone', label: 'Phone' },
  address: { type: 'string', max: 200, label: 'Address' },
  rollNo: { type: 'string', required: true, max: 30, label: 'Roll number' },
  cgpa: { type: 'number', min: 0, maxNum: 10, label: 'CGPA' },
  batchYear: { type: 'integer', min: 2000, maxNum: 2100, label: 'Batch year' },
  gender: { type: 'string', max: 10, enum: ['M', 'F', 'Other'], label: 'Gender' },
  deptId: { type: 'integer', required: true, min: 1, label: 'Department' },
};

async function create(req, res) {
  const v = validate(req.body, CREATE_RULES);
  const password = req.body?.password ? String(req.body.password) : null;

  const studentId = await db.withTransaction(async (conn) => {
    const r = await db.run(
      conn,
      `INSERT INTO PERSON (person_id, name, email, phone, address)
       VALUES (person_seq.NEXTVAL, :name, :email, :phone, :address)
       RETURNING person_id INTO :newId`,
      { name: v.name, email: v.email, phone: v.phone, address: v.address, newId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } },
    );
    const newId = r.outBinds.newId[0];
    await db.run(
      conn,
      `INSERT INTO STUDENT (person_id, roll_no, cgpa, batch_year, gender, dept_id)
       VALUES (:id, :rollNo, :cgpa, :batchYear, :gender, :deptId)`,
      { id: newId, rollNo: v.rollNo.toUpperCase(), cgpa: v.cgpa, batchYear: v.batchYear, gender: v.gender, deptId: v.deptId },
    );
    if (password) await setPassword(conn, newId, password);
    return newId;
  });
  res.status(201).json(await getProfile(studentId));
}

async function update(req, res) {
  const studentId = resolveStudentId(req);
  const isOfficer = req.user.role === 'OFFICER';

  // Students may only edit their contact details; academic data is officer-managed.
  const rules = isOfficer
    ? CREATE_RULES
    : { phone: CREATE_RULES.phone, address: CREATE_RULES.address };
  const v = validate(req.body, rules, { partial: true });
  if (!Object.keys(v).length) throw new AppError(400, 'No editable fields were provided.');

  const personCols = { name: 'name', email: 'email', phone: 'phone', address: 'address' };
  const studentCols = { rollNo: 'roll_no', cgpa: 'cgpa', batchYear: 'batch_year', gender: 'gender', deptId: 'dept_id' };
  for (const required of ['name', 'email', 'rollNo', 'deptId']) {
    if (required in v && v[required] === null) throw new AppError(400, `${CREATE_RULES[required].label} cannot be empty.`);
  }

  await db.withTransaction(async (conn) => {
    const pSet = Object.keys(v).filter((k) => personCols[k]);
    if (pSet.length) {
      const binds = { id: studentId };
      pSet.forEach((k) => { binds[k] = v[k]; });
      const r = await db.run(conn, `UPDATE PERSON SET ${pSet.map((k) => `${personCols[k]} = :${k}`).join(', ')} WHERE person_id = :id`, binds);
      if (!r.rowsAffected) throw new AppError(404, 'Student not found.');
    }
    const sSet = Object.keys(v).filter((k) => studentCols[k]);
    if (sSet.length) {
      const binds = { id: studentId };
      sSet.forEach((k) => { binds[k] = k === 'rollNo' ? v[k].toUpperCase() : v[k]; });
      const r = await db.run(conn, `UPDATE STUDENT SET ${sSet.map((k) => `${studentCols[k]} = :${k}`).join(', ')} WHERE person_id = :id`, binds);
      if (!r.rowsAffected) throw new AppError(404, 'Student not found.');
    }
  });
  res.json(await getProfile(studentId));
}

async function remove(req, res) {
  const studentId = parseId(req.params.id, 'student id');
  const deps = await db.queryOne(
    `SELECT (SELECT COUNT(*) FROM APPLICATION WHERE student_id = :id) AS apps,
            (SELECT COUNT(*) FROM PLACEMENT WHERE student_id = :id) AS placements
       FROM DUAL`,
    { id: studentId },
  );
  if (deps.apps || deps.placements) {
    throw new AppError(409, `Cannot delete: this student has ${deps.apps} application(s) and ${deps.placements} placement(s) on record.`);
  }
  const resume = await db.queryOne('SELECT stored_name FROM STUDENT_RESUME WHERE student_id = :id', { id: studentId });
  await db.withTransaction(async (conn) => {
    await db.run(conn, 'DELETE FROM STUDENT_SKILL WHERE student_id = :id', { id: studentId });
    await db.run(conn, 'DELETE FROM STUDENT_RESUME WHERE student_id = :id', { id: studentId });
    await db.run(conn, 'DELETE FROM USER_ACCOUNT WHERE person_id = :id', { id: studentId });
    const r = await db.run(conn, 'DELETE FROM STUDENT WHERE person_id = :id', { id: studentId });
    if (!r.rowsAffected) throw new AppError(404, 'Student not found.');
    await db.run(conn, 'DELETE FROM PERSON WHERE person_id = :id', { id: studentId });
  });
  if (resume) fs.rm(path.join(config.uploadDir, resume.storedName), { force: true }, () => {});
  res.json({ ok: true });
}

async function setAccountPassword(req, res) {
  const studentId = parseId(req.params.id, 'student id');
  const password = req.body?.password ? String(req.body.password) : '';
  await db.withTransaction((conn) => setPassword(conn, studentId, password));
  res.json({ ok: true, message: 'Login password set.' });
}

/* ----------------------------- skills ----------------------------- */

async function listSkills(req, res) {
  const studentId = resolveStudentId(req);
  res.json(await db.query(
    `SELECT ss.skill_id, sk.skill_name, sk.category, ss.proficiency_level, ss.certification
       FROM STUDENT_SKILL ss JOIN SKILL sk ON sk.skill_id = ss.skill_id
      WHERE ss.student_id = :id ORDER BY sk.skill_name`,
    { id: studentId },
  ));
}

async function upsertSkill(req, res) {
  const studentId = resolveStudentId(req);
  const skillId = parseId(req.params.skillId, 'skill id');
  const v = validate(req.body, {
    proficiencyLevel: { type: 'string', required: true, enum: PROFICIENCY, label: 'Proficiency level' },
    certification: { type: 'string', max: 150, label: 'Certification' },
  });
  await db.execute(
    `MERGE INTO STUDENT_SKILL ss
     USING (SELECT :studentId AS student_id, :skillId AS skill_id FROM DUAL) src
        ON (ss.student_id = src.student_id AND ss.skill_id = src.skill_id)
      WHEN MATCHED THEN UPDATE SET ss.proficiency_level = :lvl, ss.certification = :cert
      WHEN NOT MATCHED THEN INSERT (student_id, skill_id, proficiency_level, certification)
           VALUES (:studentId, :skillId, :lvl, :cert)`,
    { studentId, skillId, lvl: v.proficiencyLevel, cert: v.certification },
  );
  req.params.id = String(studentId);
  return listSkills(req, res);
}

async function removeSkill(req, res) {
  const studentId = resolveStudentId(req);
  const skillId = parseId(req.params.skillId, 'skill id');
  const r = await db.execute('DELETE FROM STUDENT_SKILL WHERE student_id = :studentId AND skill_id = :skillId', { studentId, skillId });
  if (!r.rowsAffected) throw new AppError(404, 'Skill not found on this profile.');
  res.json({ ok: true });
}

/* ----------------------------- resume ----------------------------- */

async function uploadResume(req, res) {
  const studentId = resolveStudentId(req);
  if (!req.file) throw new AppError(400, 'Choose a PDF, DOC or DOCX file to upload.');
  const exists = await db.queryOne('SELECT person_id FROM STUDENT WHERE person_id = :id', { id: studentId });
  if (!exists) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw new AppError(404, 'Student not found.');
  }
  const old = await db.queryOne('SELECT stored_name FROM STUDENT_RESUME WHERE student_id = :id', { id: studentId });
  const originalName = path.basename(req.file.originalname).replace(/[^\w.\- ]/g, '_').slice(0, 200);
  try {
    await db.execute(
      `MERGE INTO STUDENT_RESUME r
       USING (SELECT :id AS student_id FROM DUAL) src ON (r.student_id = src.student_id)
        WHEN MATCHED THEN UPDATE SET r.original_name = :orig, r.stored_name = :stored, r.uploaded_on = SYSDATE
        WHEN NOT MATCHED THEN INSERT (student_id, original_name, stored_name, uploaded_on)
             VALUES (:id, :orig, :stored, SYSDATE)`,
      { id: studentId, orig: originalName, stored: req.file.filename },
    );
  } catch (err) {
    fs.rm(req.file.path, { force: true }, () => {});
    throw err;
  }
  if (old && old.storedName !== req.file.filename) {
    fs.rm(path.join(config.uploadDir, old.storedName), { force: true }, () => {});
  }
  res.status(201).json({ originalName, uploadedOn: new Date() });
}

async function downloadResume(req, res) {
  const studentId = resolveStudentId(req);
  const row = await db.queryOne('SELECT original_name, stored_name FROM STUDENT_RESUME WHERE student_id = :id', { id: studentId });
  if (!row) throw new AppError(404, 'No resume has been uploaded.');
  const filePath = path.join(config.uploadDir, path.basename(row.storedName));
  if (!fs.existsSync(filePath)) throw new AppError(404, 'The resume file is missing on the server. Please upload it again.');
  res.download(filePath, row.originalName);
}

module.exports = {
  list, getOne, create, update, remove, setAccountPassword,
  listSkills, upsertSkill, removeSkill, uploadResume, downloadResume, PROFICIENCY,
};
