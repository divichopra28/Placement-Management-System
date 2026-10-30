import { useApi } from '../hooks/useApi';
import { Field } from './ui';

export const splitList = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);

/**
 * Editor for one ELIGIBILITY row. Branches and skills are stored by the
 * supplied schema as comma-separated names; this picks them from the
 * DEPARTMENT and SKILL tables so the text always matches real records.
 */
export default function EligibilityFields({ value, onChange, errors = {} }) {
  const depts = useApi('/departments', { initial: [] });
  const skills = useApi('/skills', { initial: [] });
  const branches = splitList(value.eligibleBranches);
  const req = splitList(value.skillsRequired);

  const toggle = (list, item, key) => {
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    onChange({ ...value, [key]: next.join(',') });
  };

  return (
    <>
      <Field label="Minimum CGPA" error={errors.minCgpa} htmlFor="el-cgpa" hint="Enforced by the TRG_CHECK_ELIGIBILITY trigger.">
        <input id="el-cgpa" type="number" step="0.01" min="0" max="10" className={`input ${errors.minCgpa ? 'invalid' : ''}`} value={value.minCgpa ?? ''} onChange={(e) => onChange({ ...value, minCgpa: e.target.value })} />
      </Field>
      <Field label="Backlogs allowed" error={errors.backlogsAllowed} htmlFor="el-bl" hint="Recorded for reference; backlog counts are not stored per student.">
        <input id="el-bl" type="number" min="0" max="99" className="input" value={value.backlogsAllowed ?? 0} onChange={(e) => onChange({ ...value, backlogsAllowed: e.target.value })} />
      </Field>
      <Field label="Eligible branches" full hint={branches.length ? `${branches.length} selected` : 'None selected — open to all branches.'}>
        <div className="chips" role="group" aria-label="Eligible branches">
          {depts.data.map((d) => (
            <button type="button" key={d.deptId} className={`chip-toggle ${branches.includes(d.deptName) ? 'on' : ''}`} aria-pressed={branches.includes(d.deptName)} onClick={() => toggle(branches, d.deptName, 'eligibleBranches')}>{d.deptName}</button>
          ))}
        </div>
      </Field>
      <Field label="Required skills" full hint={req.length ? `Students must have all ${req.length} skill(s).` : 'None selected — no specific skills required.'}>
        <div className="chips" role="group" aria-label="Required skills">
          {skills.data.map((s) => (
            <button type="button" key={s.skillId} className={`chip-toggle ${req.includes(s.skillName) ? 'on' : ''}`} aria-pressed={req.includes(s.skillName)} onClick={() => toggle(req, s.skillName, 'skillsRequired')}>{s.skillName}</button>
          ))}
        </div>
      </Field>
    </>
  );
}

export function validateEligibility(e) {
  const errs = {};
  if (e.minCgpa !== '' && e.minCgpa !== null && e.minCgpa !== undefined && !(Number(e.minCgpa) >= 0 && Number(e.minCgpa) <= 10)) errs.minCgpa = 'Must be between 0 and 10.';
  if (e.backlogsAllowed !== '' && !(Number.isInteger(Number(e.backlogsAllowed)) && Number(e.backlogsAllowed) >= 0)) errs.backlogsAllowed = 'Must be a whole number ≥ 0.';
  return errs;
}

export function eligibilityPayload(e) {
  return {
    minCgpa: e.minCgpa === '' || e.minCgpa === null || e.minCgpa === undefined ? null : Number(e.minCgpa),
    eligibleBranches: e.eligibleBranches || null,
    skillsRequired: e.skillsRequired || null,
    backlogsAllowed: e.backlogsAllowed === '' ? 0 : Number(e.backlogsAllowed),
  };
}
