const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validate, parseId } = require('../validators');

const RULES = {
  companyName: { type: 'string', required: true, max: 150, label: 'Company name' },
  industry: { type: 'string', max: 100, label: 'Industry' },
  website: { type: 'url', max: 200, label: 'Website' },
  location: { type: 'string', max: 150, label: 'Location' },
  contactPerson: { type: 'string', max: 100, label: 'Contact person' },
  contactEmail: { type: 'email', label: 'Contact email' },
  phone: { type: 'phone', label: 'Phone' },
};

const LIST_SQL = `
  SELECT c.company_id, c.company_name, c.industry, c.website, c.location,
         c.contact_person, c.contact_email, c.phone,
         (SELECT COUNT(*) FROM JOB_POSTING j WHERE j.company_id = c.company_id) AS job_count,
         (SELECT COUNT(*) FROM JOB_POSTING j
           WHERE j.company_id = c.company_id
             AND (j.application_deadline IS NULL OR j.application_deadline >= TRUNC(SYSDATE))) AS open_job_count,
         (SELECT COUNT(*) FROM APPLICATION a JOIN JOB_POSTING j ON j.job_id = a.job_id
           WHERE j.company_id = c.company_id) AS application_count,
         (SELECT COUNT(*) FROM OFFER o JOIN APPLICATION a ON a.application_id = o.application_id
            JOIN JOB_POSTING j ON j.job_id = a.job_id WHERE j.company_id = c.company_id) AS offer_count,
         (SELECT COUNT(*) FROM PLACEMENT pl WHERE pl.company_id = c.company_id) AS placement_count
    FROM COMPANY c`;

// Students see public company information only - no recruiter contact details.
function forRole(row, role) {
  if (role === 'OFFICER') return row;
  const { contactPerson, contactEmail, phone, ...rest } = row;
  return rest;
}

async function list(req, res) {
  const rows = await db.query(`${LIST_SQL} ORDER BY c.company_name`);
  res.json(rows.map((r) => forRole(r, req.user.role)));
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'company id');
  const company = await db.queryOne(`${LIST_SQL} WHERE c.company_id = :id`, { id });
  if (!company) throw new AppError(404, 'Company not found.');
  const jobs = await db.query(
    `SELECT j.job_id, j.job_title, j.job_type, j.salary_lpa, j.location, j.vacancies,
            j.drive_date, j.application_deadline,
            (SELECT COUNT(*) FROM APPLICATION a WHERE a.job_id = j.job_id) AS applicant_count
       FROM JOB_POSTING j WHERE j.company_id = :id ORDER BY j.drive_date DESC NULLS LAST`,
    { id },
  );
  const stats = await db.queryOne(
    `SELECT COUNT(*) AS placed, ROUND(AVG(package_lpa), 2) AS avg_package, MAX(package_lpa) AS max_package
       FROM PLACEMENT WHERE company_id = :id`,
    { id },
  );
  const statusRows = await db.query(
    `SELECT a.status, COUNT(*) AS count
       FROM APPLICATION a JOIN JOB_POSTING j ON j.job_id = a.job_id
      WHERE j.company_id = :id GROUP BY a.status`,
    { id },
  );
  res.json({ ...forRole(company, req.user.role), jobs, stats, applicationsByStatus: statusRows });
}

async function create(req, res) {
  const v = validate(req.body, RULES);
  const r = await db.execute(
    `INSERT INTO COMPANY (company_id, company_name, industry, website, location, contact_person, contact_email, phone)
     VALUES (company_seq.NEXTVAL, :companyName, :industry, :website, :location, :contactPerson, :contactEmail, :phone)
     RETURNING company_id INTO :newId`,
    { ...v, newId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } },
  );
  const created = await db.queryOne(`${LIST_SQL} WHERE c.company_id = :id`, { id: r.outBinds.newId[0] });
  res.status(201).json(created);
}

async function update(req, res) {
  const id = parseId(req.params.id, 'company id');
  const v = validate(req.body, RULES);
  const r = await db.execute(
    `UPDATE COMPANY SET company_name = :companyName, industry = :industry, website = :website,
            location = :location, contact_person = :contactPerson, contact_email = :contactEmail, phone = :phone
      WHERE company_id = :id`,
    { ...v, id },
  );
  if (!r.rowsAffected) throw new AppError(404, 'Company not found.');
  res.json(await db.queryOne(`${LIST_SQL} WHERE c.company_id = :id`, { id }));
}

async function remove(req, res) {
  const id = parseId(req.params.id, 'company id');
  const deps = await db.queryOne(
    `SELECT (SELECT COUNT(*) FROM JOB_POSTING WHERE company_id = :id) AS jobs,
            (SELECT COUNT(*) FROM PLACEMENT WHERE company_id = :id) AS placements FROM DUAL`,
    { id },
  );
  if (deps.jobs || deps.placements) {
    throw new AppError(409, `Cannot delete: this company has ${deps.jobs} job posting(s) and ${deps.placements} placement(s). Remove those first.`);
  }
  const r = await db.execute('DELETE FROM COMPANY WHERE company_id = :id', { id });
  if (!r.rowsAffected) throw new AppError(404, 'Company not found.');
  res.json({ ok: true });
}

module.exports = { list, getOne, create, update, remove };
