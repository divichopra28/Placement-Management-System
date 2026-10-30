const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { parseId } = require('../validators');

// Built on the PLACEMENT_DETAILS view from the supplied schema, joined back to
// PLACEMENT for the ids and department the view does not expose.
const LIST_SQL = `
  SELECT pd.placement_id, pd.student_name, pd.company_name, pd.job_title, pd.package_lpa,
         pd.joining_date, pd.placement_status,
         pl.student_id, pl.company_id, pl.offer_id, pl.placed_on, s.roll_no, d.dept_name,
         o.ctc, o.offer_date
    FROM PLACEMENT_DETAILS pd
    JOIN PLACEMENT pl ON pl.placement_id = pd.placement_id
    JOIN STUDENT s ON s.person_id = pl.student_id
    JOIN DEPARTMENT d ON d.dept_id = s.dept_id
    JOIN OFFER o ON o.offer_id = pl.offer_id`;

async function list(req, res) {
  const isStudent = req.user.role === 'STUDENT';
  res.json(await db.query(
    `${LIST_SQL}${isStudent ? ' WHERE pl.student_id = :me' : ''} ORDER BY pl.placed_on DESC`,
    isStudent ? { me: req.user.personId } : {},
  ));
}

async function getOne(req, res) {
  const id = parseId(req.params.id, 'placement id');
  const row = await db.queryOne(`${LIST_SQL} WHERE pd.placement_id = :id`, { id });
  if (!row) throw new AppError(404, 'Placement not found.');
  if (req.user.role === 'STUDENT' && row.studentId !== req.user.personId) throw new AppError(403, 'You can only view your own placement.');
  res.json(row);
}

module.exports = { list, getOne };
