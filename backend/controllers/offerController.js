const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { validate, parseId } = require('../validators');

const LIST_SQL = `
  SELECT o.offer_id, o.application_id, o.offer_date, o.joining_date, o.offered_salary_lpa, o.ctc, o.offer_status,
         a.student_id, p.name AS student_name, s.roll_no, d.dept_name, a.status AS application_status,
         j.job_id, j.job_title, c.company_id, c.company_name,
         pl.placement_id
    FROM OFFER o
    JOIN APPLICATION a ON a.application_id = o.application_id
    JOIN STUDENT s ON s.person_id = a.student_id
    JOIN PERSON p ON p.person_id = s.person_id
    JOIN DEPARTMENT d ON d.dept_id = s.dept_id
    JOIN JOB_POSTING j ON j.job_id = a.job_id
    JOIN COMPANY c ON c.company_id = j.company_id
    LEFT JOIN PLACEMENT pl ON pl.offer_id = o.offer_id`;

async function list(req, res) {
  const isStudent = req.user.role === 'STUDENT';
  res.json(await db.query(
    `${LIST_SQL}${isStudent ? ' WHERE a.student_id = :me' : ''} ORDER BY o.offer_date DESC, o.offer_id DESC`,
    isStudent ? { me: req.user.personId } : {},
  ));
}

const loadOne = (id) => db.queryOne(`${LIST_SQL} WHERE o.offer_id = :id`, { id });

const RULES = {
  offeredSalaryLpa: { type: 'number', required: true, min: 0, maxNum: 9999.99, label: 'Offered salary (LPA)' },
  ctc: { type: 'number', min: 0, maxNum: 9999.99, label: 'CTC (LPA)' },
  joiningDate: { type: 'date', label: 'Joining date' },
};

/**
 * Creates an offer through the CREATE_OFFER procedure. TRG_OFFER_APPLICATION
 * then marks the application SELECTED (and TRG_APPLICATION_AUDIT logs it).
 */
async function create(req, res) {
  const applicationId = parseId(req.body?.applicationId, 'application id');
  const v = validate(req.body, RULES);
  const app = await db.queryOne(
    `SELECT a.status, (SELECT COUNT(*) FROM OFFER o WHERE o.application_id = a.application_id) AS offers
       FROM APPLICATION a WHERE a.application_id = :id`,
    { id: applicationId },
  );
  if (!app) throw new AppError(404, 'Application not found.');
  if (app.offers) throw new AppError(409, 'An offer already exists for this application.');
  if (app.status !== 'SHORTLISTED') {
    throw new AppError(409, `Offers can only be made to SHORTLISTED applications (this one is ${app.status}).`);
  }
  if (v.ctc !== null && v.ctc < v.offeredSalaryLpa) throw new AppError(400, 'CTC cannot be lower than the offered salary.');

  await db.execute(
    'BEGIN CREATE_OFFER(:applicationId, :salary, :ctc, :joiningDate); END;',
    { applicationId, salary: v.offeredSalaryLpa, ctc: v.ctc, joiningDate: v.joiningDate },
  );
  const created = await db.queryOne(`${LIST_SQL} WHERE o.application_id = :id`, { id: applicationId });
  res.status(201).json(created);
}

/** Officers may revise a PENDING offer's terms. */
async function update(req, res) {
  const id = parseId(req.params.id, 'offer id');
  const v = validate(req.body, RULES);
  const offer = await loadOne(id);
  if (!offer) throw new AppError(404, 'Offer not found.');
  if (offer.offerStatus !== 'PENDING') throw new AppError(409, 'Only pending offers can be edited.');
  if (v.ctc !== null && v.ctc < v.offeredSalaryLpa) throw new AppError(400, 'CTC cannot be lower than the offered salary.');
  await db.execute(
    'UPDATE OFFER SET offered_salary_lpa = :salary, ctc = :ctc, joining_date = :joiningDate WHERE offer_id = :id',
    { salary: v.offeredSalaryLpa, ctc: v.ctc, joiningDate: v.joiningDate, id },
  );
  res.json(await loadOne(id));
}

/**
 * Record acceptance or rejection. Accepting fires TRG_CREATE_PLACEMENT, which
 * inserts the PLACEMENT row - the backend never inserts placements itself.
 * TRG_ONE_PLACEMENT_PER_STUDENT rejects a second placement (ORA-20003), in
 * which case the whole UPDATE is rolled back by Oracle.
 */
async function updateStatus(req, res) {
  const id = parseId(req.params.id, 'offer id');
  const status = String(req.body?.status || '').toUpperCase();
  if (!['ACCEPTED', 'REJECTED'].includes(status)) throw new AppError(400, 'Status must be ACCEPTED or REJECTED.');

  const offer = await loadOne(id);
  if (!offer) throw new AppError(404, 'Offer not found.');
  if (req.user.role === 'STUDENT' && offer.studentId !== req.user.personId) {
    throw new AppError(403, 'You can only respond to your own offers.');
  }
  if (offer.offerStatus !== 'PENDING') throw new AppError(409, `This offer has already been ${offer.offerStatus.toLowerCase()}.`);

  await db.execute('UPDATE OFFER SET offer_status = :status WHERE offer_id = :id', { status, id });
  res.json(await loadOne(id));
}

module.exports = { list, create, update, updateStatus };
