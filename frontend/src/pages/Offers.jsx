import { useState } from 'react';
import { Check, FilePlus2, FileText, Pencil, X } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/AuthContext';
import { useFeedback } from '../components/Feedback';
import { Alert, DataState, Field, PageHeader, StatusBadge } from '../components/ui';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { formatDate, lpa, toInputDate } from '../utils/format';

function OfferForm({ offer, onClose, onSaved }) {
  const { toast } = useFeedback();
  const isEdit = Boolean(offer);
  const apps = useApi(isEdit ? null : '/applications', { initial: [], params: { status: 'SHORTLISTED' } });
  const [form, setForm] = useState({
    applicationId: offer?.applicationId || '',
    offeredSalaryLpa: offer?.offeredSalaryLpa ?? '',
    ctc: offer?.ctc ?? '',
    joiningDate: toInputDate(offer?.joiningDate),
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const candidates = apps.data.filter((a) => !a.offerId);
  const chosen = candidates.find((a) => a.applicationId === Number(form.applicationId));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEdit && !form.applicationId) errs.applicationId = 'Choose a shortlisted application.';
    const sal = Number(form.offeredSalaryLpa);
    if (form.offeredSalaryLpa === '' || !(sal >= 0) || sal > 9999.99) errs.offeredSalaryLpa = 'Enter the offered salary in LPA.';
    if (form.ctc !== '' && (!(Number(form.ctc) >= 0) || Number(form.ctc) > 9999.99)) errs.ctc = 'Enter a valid CTC.';
    else if (form.ctc !== '' && Number(form.ctc) < sal) errs.ctc = 'CTC cannot be lower than the salary.';
    if (form.joiningDate && new Date(`${form.joiningDate}T00:00`) < new Date(new Date().toDateString())) errs.joiningDate = 'Joining date cannot be in the past.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const payload = { offeredSalaryLpa: sal, ctc: form.ctc === '' ? null : Number(form.ctc), joiningDate: form.joiningDate || null };
      if (isEdit) await api.put(`/offers/${offer.offerId}`, payload);
      else await api.post('/offers', { ...payload, applicationId: Number(form.applicationId) });
      toast(isEdit ? 'Offer updated.' : 'Offer created — the application is now marked SELECTED.');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit offer #${offer.offerId}` : 'Create offer'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="offer-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save' : 'Create offer'}</button>
      </>
    )}>
      <form id="offer-form" className="form-grid" onSubmit={submit} noValidate>
        {isEdit ? <div className="full small muted">{offer.studentName} · {offer.jobTitle} at {offer.companyName}</div> : (
          <Field label="Shortlisted application" required error={errors.applicationId} full htmlFor="of-app">
            <select id="of-app" className={`select ${errors.applicationId ? 'invalid' : ''}`} value={form.applicationId} onChange={(e) => {
              const a = candidates.find((x) => x.applicationId === Number(e.target.value));
              setForm({ ...form, applicationId: e.target.value, offeredSalaryLpa: form.offeredSalaryLpa === '' && a?.salaryLpa != null ? a.salaryLpa : form.offeredSalaryLpa });
            }}>
              <option value="">{apps.loading ? 'Loading…' : candidates.length ? 'Select…' : 'No shortlisted applications without an offer'}</option>
              {candidates.map((a) => <option key={a.applicationId} value={a.applicationId}>#{a.applicationId} · {a.studentName} ({a.rollNo}) — {a.jobTitle}, {a.companyName}</option>)}
            </select>
          </Field>
        )}
        {chosen && <div className="full small muted">Advertised package: {lpa(chosen.salaryLpa)} · CGPA {chosen.cgpa} · {chosen.interviewCount} interview(s)</div>}
        <Field label="Offered salary (LPA)" required error={errors.offeredSalaryLpa} htmlFor="of-sal">
          <input id="of-sal" type="number" step="0.01" min="0" className={`input ${errors.offeredSalaryLpa ? 'invalid' : ''}`} value={form.offeredSalaryLpa} onChange={set('offeredSalaryLpa')} />
        </Field>
        <Field label="CTC (LPA)" error={errors.ctc} htmlFor="of-ctc">
          <input id="of-ctc" type="number" step="0.01" min="0" className={`input ${errors.ctc ? 'invalid' : ''}`} value={form.ctc} onChange={set('ctc')} />
        </Field>
        <Field label="Joining date" error={errors.joiningDate} htmlFor="of-join">
          <input id="of-join" type="date" className={`input ${errors.joiningDate ? 'invalid' : ''}`} value={form.joiningDate} onChange={set('joiningDate')} />
        </Field>
        {!isEdit && <p className="full small muted">Creates the offer through the CREATE_OFFER procedure; TRG_OFFER_APPLICATION then marks the application SELECTED.</p>}
      </form>
    </Modal>
  );
}

export default function Offers() {
  const { user } = useAuth();
  const isOfficer = user.role === 'OFFICER';
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/offers', { initial: [] });
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [form, setForm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const decide = async (o, decision) => {
    const accepting = decision === 'ACCEPTED';
    const who = isOfficer ? `${o.studentName}'s` : 'your';
    const ok = await confirm({
      title: accepting ? 'Record acceptance?' : 'Record rejection?',
      message: accepting
        ? `Mark ${who} offer from ${o.companyName} (${lpa(o.offeredSalaryLpa)}) as ACCEPTED. A confirmed placement record will be created automatically by the database. This cannot be undone here.`
        : `Mark ${who} offer from ${o.companyName} as REJECTED. This cannot be undone here.`,
      confirmLabel: accepting ? 'Accept offer' : 'Reject offer',
      danger: !accepting,
    });
    if (!ok) return;
    setBusyId(o.offerId);
    try {
      const res = await api.patch(`/offers/${o.offerId}/status`, { status: decision });
      toast(accepting && res.data.placementId ? `Offer accepted — placement #${res.data.placementId} created.` : `Offer ${decision.toLowerCase()}.`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const companies = [...new Set(data.map((o) => o.companyName))].sort();
  const rows = data.filter((o) => (!status || o.offerStatus === status) && (!company || o.companyName === company));
  const pending = data.filter((o) => o.offerStatus === 'PENDING');

  const columns = [
    ...(isOfficer ? [{ key: 'studentName', label: 'Student', render: (o) => <><strong>{o.studentName}</strong><span className="sub">{o.rollNo} · {o.deptName}</span></> }] : []),
    { key: 'companyName', label: 'Company / Job', render: (o) => <><strong>{o.companyName}</strong><span className="sub">{o.jobTitle}</span></> },
    { key: 'offeredSalaryLpa', label: 'Salary', render: (o) => lpa(o.offeredSalaryLpa) },
    { key: 'ctc', label: 'CTC', render: (o) => lpa(o.ctc) },
    { key: 'offerDate', label: 'Offered on', render: (o) => formatDate(o.offerDate) },
    { key: 'joiningDate', label: 'Joining', render: (o) => formatDate(o.joiningDate) },
    { key: 'offerStatus', label: 'Status', render: (o) => <>{<StatusBadge status={o.offerStatus} />}{o.placementId && <span className="sub">Placement #{o.placementId}</span>}</> },
    {
      key: '_actions', label: '', className: 'actions', render: (o) => o.offerStatus === 'PENDING' && (
        <>
          {isOfficer && <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setForm(o)} aria-label="Edit offer"><Pencil size={14} /></button>}
          <button type="button" className="btn btn-success btn-sm" disabled={busyId === o.offerId} onClick={() => decide(o, 'ACCEPTED')}><Check size={14} /> Accept</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busyId === o.offerId} onClick={() => decide(o, 'REJECTED')}><X size={14} /> Reject</button>
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Offers"
        subtitle={isOfficer ? 'Create offers for shortlisted candidates and record decisions.' : 'Offers you have received.'}
        actions={isOfficer && <button type="button" className="btn btn-primary" onClick={() => setForm({})}><FilePlus2 size={16} /> Create offer</button>}
      />
      {!isOfficer && pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert type="info">You have {pending.length} pending offer(s). Accepting an offer confirms your placement — a student can hold only one placement.</Alert>
        </div>
      )}
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="offerId"
            columns={columns}
            searchKeys={['studentName', 'rollNo', 'companyName', 'jobTitle']}
            searchPlaceholder="Search offers…"
            initialSort={{ key: 'offerDate', dir: 'desc' }}
            empty={{ icon: FileText, title: 'No offers yet', message: isOfficer ? 'Create an offer for a shortlisted application.' : 'Offers from companies will appear here.' }}
            filters={(
              <>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option></select>
                {isOfficer && <select className="select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="">All companies</option>{companies.map((c) => <option key={c}>{c}</option>)}</select>}
              </>
            )}
          />
        </DataState>
      </div>
      {form && <OfferForm offer={form.offerId ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
    </>
  );
}
