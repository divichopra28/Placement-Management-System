const db = require('../config/db');
const { validate } = require('../validators');

async function departments(req, res) {
  res.json(await db.query(
    `SELECT d.dept_id, d.dept_name, d.hod_name, d.hod_email, d.contact_no,
            (SELECT COUNT(*) FROM STUDENT s WHERE s.dept_id = d.dept_id) AS student_count
       FROM DEPARTMENT d ORDER BY d.dept_name`,
  ));
}

async function skills(req, res) {
  res.json(await db.query('SELECT skill_id, skill_name, category, description FROM SKILL ORDER BY category, skill_name'));
}

async function createSkill(req, res) {
  const v = validate(req.body, {
    skillName: { type: 'string', required: true, max: 100, label: 'Skill name' },
    category: { type: 'string', max: 100, label: 'Category' },
    description: { type: 'string', max: 300, label: 'Description' },
  });
  const r = await db.execute(
    `INSERT INTO SKILL (skill_id, skill_name, category, description)
     VALUES (skill_seq.NEXTVAL, :skillName, :category, :description)
     RETURNING skill_id INTO :newId`,
    { ...v, newId: { dir: db.oracledb.BIND_OUT, type: db.oracledb.NUMBER } },
  );
  res.status(201).json({ skillId: r.outBinds.newId[0], ...v });
}

async function officers(req, res) {
  res.json(await db.query(
    `SELECT po.person_id AS officer_id, p.name, p.email, po.employee_id, po.designation
       FROM PLACEMENT_OFFICER po JOIN PERSON p ON p.person_id = po.person_id ORDER BY p.name`,
  ));
}

module.exports = { departments, skills, createSkill, officers };
