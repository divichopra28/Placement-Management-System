import { useState } from 'react';
import { Eye, KeyRound, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { Badge, DataState, Field, PageHeader } from '../../components/ui';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StudentProfileView from '../../components/StudentProfileView';
import { SkillManager } from '../student/MySkills';
import { lpa } from '../../utils/format';

const EMPTY = { name: '', email: '', phone: '', address: '', rollNo: '', cgpa: '', batchYear: new Date().getFullYear() + 1, gender: '', deptId: '', password: '' };

function pwProblem(pw) {
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'At least 8 characters, with a letter and a number.';
  return null;
}

function StudentForm({ student, departments, onClose, onSaved }) {
  const { toast } = useFeedback();
  const isEdit = Boolean(student);
  const [form, setForm] = useState(isEdit ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, student[k] ?? ''])) : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!form.rollNo.trim()) errs.rollNo = 'Roll number is required.';
    if (!form.deptId) errs.deptId = 'Choose a department.';
    if (form.cgpa !== '' && !(Number(form.cgpa) >= 0 && Number(form.cgpa) <= 10)) errs.cgpa = 'CGPA must be between 0 and 10.';
    if (form.batchYear !== '' && !(Number.isInteger(Number(form.batchYear)) && Number(form.batchYear) >= 2000 && Number(form.batchYear) <= 2100)) errs.batchYear = 'Enter a valid year.';
    if (form.phone && !/^[+]?[0-9][0-9\s-]{5,13}[0-9]$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
    if (!isEdit && form.password && pwProblem(form.password)) errs.password = pwProblem(form.password);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const { password, ...rest } = form;
    const payload = { ...rest, deptId: Number(form.deptId), cgpa: form.cgpa === '' ? null : Number(form.cgpa), batchYear: form.batchYear === '' ? null : Number(form.batchYear) };
    setBusy(true);
    try {
      if (isEdit) await api.put(`/students/${student.studentId}`, payload);
      else await api.post('/students', { ...payload, password: password || undefined });
      toast(isEdit ? 'Student updated.' : 'Student added.');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = (k, label, { hint, ...props } = {}, req) => (
    <Field label={label} required={req} error={errors[k]} htmlFor={`s-${k}`} hint={hint}>
      <input id={`s-${k}`} className={`input ${errors[k] ? 'invalid' : ''}`} value={form[k]} onChange={set(k)} {...props} />
    </Field>
  );

  return (
    <Modal wide title={isEdit ? `Edit ${student.name}` : 'Add student'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="student-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save student'}</button>
      </>
    )}>
      <form id="student-form" className="form-grid" onSubmit={submit} noValidate>
        {input('name', 'Full name', { maxLength: 100 }, true)}
        {input('email', 'Email', { type: 'email', maxLength: 100 }, true)}
        {input('rollNo', 'Roll number', { maxLength: 30, style: { textTransform: 'uppercase' } }, true)}
        <Field label="Department" required error={errors.deptId} htmlFor="s-dept">
          <select id="s-dept" className={`select ${errors.deptId ? 'invalid' : ''}`} value={form.deptId} onChange={set('deptId')}>
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.deptId} value={d.deptId}>{d.deptName}</option>)}
          </select>
        </Field>
        {input('cgpa', 'CGPA', { type: 'number', step: '0.01', min: 0, max: 10 })}
        {input('batchYear', 'Graduation batch', { type: 'number', min: 2000, max: 2100 })}
        <Field label="Gender" htmlFor="s-gender">
          <select id="s-gender" className="select" value={form.gender} onChange={set('gender')}>
            <option value="">Not specified</option><option value="F">Female</option><option value="M">Male</option><option value="Other">Other</option>
          </select>
        </Field>
        {input('phone', 'Phone', { inputMode: 'tel', maxLength: 15 })}
        <Field label="Address" full htmlFor="s-address"><textarea id="s-address" className="textarea" maxLength={200} value={form.address} onChange={set('address')} /></Field>
        {!isEdit && input('password', 'Initial login password (optional)', { type: 'password', autoComplete: 'new-password', hint: 'Leave blank to set it later. Stored only as a bcrypt hash.' })}
      </form>
    </Modal>
  );
}

function PasswordForm({ student, onClose }) {
  const { toast } = useFeedback();
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const p = pwProblem(pw);
    if (p) { setError(p); return; }
    setBusy(true);
    try {
      await api.put(`/students/${student.studentId}/account`, { password: pw });
      toast(`Login password set for ${student.name}.`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`${student.hasLogin === 'Y' ? 'Reset' : 'Create'} login — ${student.name}`} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="pw-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
      </>
    )}>
      <form id="pw-form" className="stack" onSubmit={submit} noValidate>
        <p className="small muted">The student signs in with {student.email} or {student.rollNo}. Share the new password with them securely.</p>
        <Field label="New password" required error={error} hint="At least 8 characters, with a letter and a number." htmlFor="np">
          <input id="np" type="password" className="input" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

function StudentDetail({ id, onClose }) {
  const { data, loading, error, reload } = useApi(`/students/${id}`);
  return (
    <Modal wide title={data ? `${data.name} · ${data.rollNo}` : 'Student'} onClose={onClose}>
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <div className="stack">
            <StudentProfileView profile={data} />
            <SkillManager studentId={id} />
          </div>
        )}
      </DataState>
    </Modal>
  );
}

export default function Students() {
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/students', { initial: [] });
  const depts = useApi('/departments', { initial: [] });
  const [dept, setDept] = useState('');
  const [batch, setBatch] = useState('');
  const [placed, setPlaced] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [pwFor, setPwFor] = useState(null);

  const batches = [...new Set(data.map((s) => s.batchYear).filter(Boolean))].sort();
  const rows = data.filter((s) => (!dept || s.deptName === dept) && (!batch || String(s.batchYear) === batch)
    && (!placed || (placed === 'yes' ? s.placementId : !s.placementId)));

  const remove = async (s) => {
    if (s.applicationCount > 0) {
      toast(`${s.name} has ${s.applicationCount} application(s) on record and cannot be deleted.`, 'error');
      return;
    }
    const ok = await confirm({ title: `Delete ${s.name}?`, message: 'This removes the student, their skills, resume reference and login account. This cannot be undone.', confirmLabel: 'Delete student', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/students/${s.studentId}`);
      toast('Student deleted.');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <PageHeader title="Students" subtitle="Student placement profiles from the PERSON and STUDENT tables."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({})}><UserPlus size={16} /> Add student</button>} />
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="studentId"
            searchKeys={['name', 'rollNo', 'email', 'deptName', 'skills', 'placedCompany']}
            searchPlaceholder="Search name, roll no, email, skill…"
            initialSort={{ key: 'rollNo', dir: 'asc' }}
            empty={{ icon: Users, title: 'No students yet', message: 'Add the first student to begin.' }}
            filters={(
              <>
                <select className="select" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{depts.data.map((d) => <option key={d.deptId}>{d.deptName}</option>)}</select>
                <select className="select" value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Batch"><option value="">All batches</option>{batches.map((b) => <option key={b}>{b}</option>)}</select>
                <select className="select" value={placed} onChange={(e) => setPlaced(e.target.value)} aria-label="Placement"><option value="">Placed &amp; unplaced</option><option value="yes">Placed</option><option value="no">Not placed</option></select>
              </>
            )}
            columns={[
              { key: 'rollNo', label: 'Roll no', render: (s) => <strong>{s.rollNo}</strong> },
              { key: 'name', label: 'Student', render: (s) => <>{s.name}<span className="sub">{s.email}</span></> },
              { key: 'deptName', label: 'Department' },
              { key: 'cgpa', label: 'CGPA', className: 'num' },
              { key: 'batchYear', label: 'Batch', className: 'num' },
              { key: 'skills', label: 'Skills', render: (s) => <span className="small">{s.skills || <span className="muted">—</span>}</span> },
              { key: 'applicationCount', label: 'Apps', className: 'num' },
              { key: 'placedCompany', label: 'Placement', render: (s) => (s.placedCompany ? <><Badge tone="success">Placed</Badge><span className="sub">{s.placedCompany} · {lpa(s.packageLpa)}</span></> : <Badge tone="muted">Not placed</Badge>) },
              { key: 'hasLogin', label: 'Login', render: (s) => (s.hasLogin === 'Y' ? <Badge tone="info">Active</Badge> : <Badge tone="muted">None</Badge>) },
              {
                key: '_actions', label: '', className: 'actions', render: (s) => (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setViewing(s.studentId)} aria-label={`View ${s.name}`}><Eye size={15} /></button>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Pencil size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setPwFor(s)} aria-label={`Set password for ${s.name}`}><KeyRound size={14} /></button>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Trash2 size={14} /></button>
                  </>
                ),
              },
            ]}
          />
        </DataState>
      </div>
      {editing && <StudentForm student={editing.studentId ? editing : null} departments={depts.data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {viewing && <StudentDetail id={viewing} onClose={() => { setViewing(null); reload(); }} />}
      {pwFor && <PasswordForm student={pwFor} onClose={() => { setPwFor(null); reload(); }} />}
    </>
  );
}
