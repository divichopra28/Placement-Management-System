import { useRef, useState } from 'react';
import { KeyRound, Pencil, Upload } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { DataState, Field, PageHeader } from '../../components/ui';
import Modal from '../../components/Modal';
import StudentProfileView from '../../components/StudentProfileView';

function EditContact({ profile, onClose, onSaved }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ phone: profile.phone || '', address: profile.address || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.phone && !/^[+]?[0-9][0-9\s-]{5,13}[0-9]$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number (7–15 digits).';
    if (form.address.length > 200) errs.address = 'Address must be at most 200 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.put('/students/me', form);
      toast('Contact details updated.');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit contact details" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="contact-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      </>
    )}>
      <form id="contact-form" className="stack" onSubmit={submit} noValidate>
        <p className="small muted">Name, email, roll number, department and CGPA are maintained by the placement cell. Contact them for corrections.</p>
        <Field label="Phone" error={errors.phone} htmlFor="phone">
          <input id="phone" className={`input ${errors.phone ? 'invalid' : ''}`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" maxLength={15} />
        </Field>
        <Field label="Address" error={errors.address} htmlFor="address">
          <textarea id="address" className={`textarea ${errors.address ? 'invalid' : ''}`} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={200} />
        </Field>
      </form>
    </Modal>
  );
}

function ChangePassword({ onClose }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword)) {
      setError('New password must be at least 8 characters with a letter and a number.');
      return;
    }
    if (form.newPassword !== form.confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      toast('Password changed.');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Change password" onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="pw-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </>
    )}>
      <form id="pw-form" className="stack" onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        <Field label="Current password" required htmlFor="cur"><input id="cur" type="password" className="input" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
        <Field label="New password" required hint="At least 8 characters, with a letter and a number." htmlFor="new"><input id="new" type="password" className="input" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
        <Field label="Confirm new password" required htmlFor="conf"><input id="conf" type="password" className="input" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export default function MyProfile() {
  const { data, loading, error, reload } = useApi('/students/me');
  const { toast } = useFeedback();
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(pdf|docx?)$/i.test(file.name)) { toast('Only PDF, DOC or DOCX files are allowed.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('File is too large (max 5 MB).', 'error'); return; }
    const fd = new FormData();
    fd.append('resume', file);
    setUploading(true);
    try {
      await api.post('/students/me/resume', fd);
      toast('Resume uploaded. It will be attached to your future applications.');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Your record in the placement database."
        actions={(
          <>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" hidden onChange={upload} />
            <button type="button" className="btn btn-secondary" onClick={() => setPw(true)}><KeyRound size={16} /> Change password</button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}><Upload size={16} /> {uploading ? 'Uploading…' : data?.resume ? 'Replace resume' : 'Upload resume'}</button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)} disabled={!data}><Pencil size={16} /> Edit contact details</button>
          </>
        )}
      />
      <DataState loading={loading && !data} error={error} onRetry={reload}>
        {data && <StudentProfileView profile={data} selfView />}
      </DataState>
      {editing && <EditContact profile={data} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      {pw && <ChangePassword onClose={() => setPw(false)} />}
    </>
  );
}
