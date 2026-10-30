import { useMemo, useState } from 'react';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { Badge, DataState, Field, PageHeader } from '../../components/ui';
import Modal from '../../components/Modal';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

/** Manage STUDENT_SKILL rows. studentId = 'me' for students, or a numeric id for officers. */
export function SkillManager({ studentId = 'me' }) {
  const { toast, confirm } = useFeedback();
  const skills = useApi(`/students/${studentId}/skills`, { initial: [] });
  const catalog = useApi('/skills', { initial: [] });
  const [editing, setEditing] = useState(null);

  const remove = async (s) => {
    const ok = await confirm({ title: 'Remove skill?', message: `Remove ${s.skillName} from the profile? Jobs that require it may become ineligible.`, confirmLabel: 'Remove', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/students/${studentId}/skills/${s.skillId}`);
      toast(`${s.skillName} removed.`);
      skills.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <div><h2>Skills</h2><p>Required skills on job postings are matched against this list.</p></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing({})}><Plus size={15} /> Add skill</button>
      </div>
      <DataState loading={skills.loading} error={skills.error} onRetry={skills.reload} empty={skills.data.length === 0}
        emptyProps={{ icon: Sparkles, title: 'No skills yet', message: 'Add your technical skills and certifications to qualify for more drives.' }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Skill</th><th>Category</th><th>Proficiency</th><th>Certification</th><th className="actions"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {skills.data.map((s) => (
                <tr key={s.skillId}>
                  <td><strong>{s.skillName}</strong></td>
                  <td className="muted">{s.category || '—'}</td>
                  <td><Badge>{s.proficiencyLevel || '—'}</Badge></td>
                  <td>{s.certification || <span className="muted">—</span>}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setEditing(s)} aria-label={`Edit ${s.skillName}`}><Pencil size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => remove(s)} aria-label={`Remove ${s.skillName}`}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
      {editing && (
        <SkillForm
          studentId={studentId}
          existing={editing.skillId ? editing : null}
          catalog={catalog.data}
          taken={skills.data.map((s) => s.skillId)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); skills.reload(); }}
        />
      )}
    </div>
  );
}

function SkillForm({ studentId, existing, catalog, taken, onClose, onSaved }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({
    skillId: existing?.skillId || '',
    proficiencyLevel: existing?.proficiencyLevel || 'Intermediate',
    certification: existing?.certification || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => catalog.filter((c) => !taken.includes(c.skillId) || c.skillId === existing?.skillId), [catalog, taken, existing]);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.skillId) errs.skillId = 'Choose a skill.';
    if (!LEVELS.includes(form.proficiencyLevel)) errs.proficiencyLevel = 'Choose a proficiency level.';
    if (form.certification.length > 150) errs.certification = 'At most 150 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.put(`/students/${studentId}/skills/${form.skillId}`, { proficiencyLevel: form.proficiencyLevel, certification: form.certification });
      toast(existing ? 'Skill updated.' : 'Skill added.');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={existing ? `Edit ${existing.skillName}` : 'Add a skill'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="skill-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </>
    )}>
      <form id="skill-form" className="stack" onSubmit={submit} noValidate>
        <Field label="Skill" required error={errors.skillId} htmlFor="skill">
          <select id="skill" className={`select ${errors.skillId ? 'invalid' : ''}`} value={form.skillId} disabled={Boolean(existing)} onChange={(e) => setForm({ ...form, skillId: Number(e.target.value) || '' })}>
            <option value="">Select a skill…</option>
            {options.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillName} ({s.category || 'General'})</option>)}
          </select>
        </Field>
        <Field label="Proficiency level" required error={errors.proficiencyLevel} htmlFor="lvl">
          <select id="lvl" className="select" value={form.proficiencyLevel} onChange={(e) => setForm({ ...form, proficiencyLevel: e.target.value })}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Certification" hint="Optional, e.g. Oracle Certified Associate" error={errors.certification} htmlFor="cert">
          <input id="cert" className="input" maxLength={150} value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

export default function MySkills() {
  return (
    <>
      <PageHeader title="My skills" subtitle="Keep your skills current — eligibility for each drive is checked against them." />
      <SkillManager studentId="me" />
    </>
  );
}
