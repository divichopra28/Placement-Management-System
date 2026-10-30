import { useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, ClipboardEdit, Trash2 } from 'lucide-react';
import api, { errorMessage } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/AuthContext';
import { useFeedback } from '../components/Feedback';
import { DataState, EmptyState, Field, PageHeader, StatusBadge } from '../components/ui';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { formatDateTime, toInputDate, toInputDateTime } from '../utils/format';

const TYPES = ['Aptitude Test', 'Coding Round', 'Technical', 'Group Discussion', 'Managerial', 'HR'];
const RESULTS = ['PENDING', 'PASS', 'FAIL'];

function InterviewForm({ interview, onClose, onSaved }) {
  const { toast } = useFeedback();
  const { user } = useAuth();
  const isEdit = Boolean(interview);
  const apps = useApi(isEdit ? null : '/applications', { initial: [] });
  const officers = useApi('/officers', { initial: [] });
  const [form, setForm] = useState({
    applicationId: interview?.applicationId || '',
    officerId: interview?.officerId || user.personId,
    interviewDate: interview ? toInputDateTime(interview.interviewDate) : '',
    interviewType: interview?.interviewType || 'Technical',
    roundNo: interview?.roundNo || 1,
    result: interview?.result || 'PENDING',
    feedback: interview?.feedback || '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const eligibleApps = apps.data.filter((a) => ['APPLIED', 'SHORTLISTED', 'SELECTED'].includes(a.status));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!isEdit && !form.applicationId) errs.applicationId = 'Choose an application.';
    if (!form.officerId) errs.officerId = 'Choose the assigned officer.';
    if (!form.interviewDate) errs.interviewDate = 'Choose a date and time.';
    else if (!isEdit && new Date(form.interviewDate) < new Date()) errs.interviewDate = 'The interview must be in the future.';
    if (!form.interviewType) errs.interviewType = 'Choose an interview type.';
    if (!(Number(form.roundNo) >= 1 && Number(form.roundNo) <= 20)) errs.roundNo = 'Round must be between 1 and 20.';
    if (form.feedback.length > 500) errs.feedback = 'At most 500 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const payload = { ...form, interviewDate: new Date(form.interviewDate).toISOString(), roundNo: Number(form.roundNo), officerId: Number(form.officerId) };
    setBusy(true);
    try {
      if (isEdit) await api.put(`/interviews/${interview.interviewId}`, payload);
      else await api.post('/interviews', { ...payload, applicationId: Number(form.applicationId) });
      toast(isEdit ? 'Interview updated.' : 'Interview scheduled.');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={isEdit ? `Interview #${interview.interviewId} — ${interview.studentName}` : 'Schedule interview'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="iv-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isEdit ? 'Save changes' : 'Schedule'}</button>
      </>
    )}>
      <form id="iv-form" className="form-grid" onSubmit={submit} noValidate>
        {isEdit ? (
          <div className="full small muted">{interview.jobTitle} at {interview.companyName} · Application #{interview.applicationId} ({interview.applicationStatus})</div>
        ) : (
          <Field label="Application" required error={errors.applicationId} full htmlFor="iv-app">
            <select id="iv-app" className={`select ${errors.applicationId ? 'invalid' : ''}`} value={form.applicationId} onChange={set('applicationId')}>
              <option value="">{apps.loading ? 'Loading…' : 'Select an application…'}</option>
              {eligibleApps.map((a) => <option key={a.applicationId} value={a.applicationId}>#{a.applicationId} · {a.studentName} ({a.rollNo}) — {a.jobTitle}, {a.companyName} [{a.status}]</option>)}
            </select>
          </Field>
        )}
        <Field label="Assigned officer" required error={errors.officerId} htmlFor="iv-off">
          <select id="iv-off" className="select" value={form.officerId} onChange={set('officerId')}>
            {officers.data.map((o) => <option key={o.officerId} value={o.officerId}>{o.name} ({o.employeeId})</option>)}
          </select>
        </Field>
        <Field label="Date and time" required error={errors.interviewDate} htmlFor="iv-date">
          <input id="iv-date" type="datetime-local" className={`input ${errors.interviewDate ? 'invalid' : ''}`} value={form.interviewDate} onChange={set('interviewDate')} min={isEdit ? undefined : `${toInputDate(new Date())}T00:00`} />
        </Field>
        <Field label="Interview type" required error={errors.interviewType} htmlFor="iv-type">
          <select id="iv-type" className="select" value={form.interviewType} onChange={set('interviewType')}>
            {[...new Set([...TYPES, form.interviewType])].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Round number" required error={errors.roundNo} htmlFor="iv-round">
          <input id="iv-round" type="number" min={1} max={20} className={`input ${errors.roundNo ? 'invalid' : ''}`} value={form.roundNo} onChange={set('roundNo')} />
        </Field>
        {isEdit && (
          <>
            <Field label="Result" required htmlFor="iv-res">
              <select id="iv-res" className="select" value={form.result} onChange={set('result')}>
                {RESULTS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
              </select>
            </Field>
            <Field label="Feedback (internal — not shown to students)" error={errors.feedback} full htmlFor="iv-fb">
              <textarea id="iv-fb" className="textarea" maxLength={500} value={form.feedback} onChange={set('feedback')} />
            </Field>
          </>
        )}
        {!isEdit && <p className="full small muted">Scheduling calls the SCHEDULE_INTERVIEW stored procedure. A round can only be scheduled once per application.</p>}
      </form>
    </Modal>
  );
}

function Upcoming({ rows }) {
  const groups = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const key = new Date(r.interviewDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [rows]);

  if (!rows.length) return <EmptyState icon={CalendarClock} title="No upcoming interviews" message="Scheduled interviews will appear here in date order." />;
  return (
    <div>
      {groups.map(([day, items]) => {
        const d = new Date(day);
        return (
          <div key={day} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', padding: '14px 20px', borderBottom: '1px solid var(--border-soft)', gap: 16 }}>
            <div className="date-box"><div className="m">{d.toLocaleString('en-IN', { month: 'short' })}</div><div className="d">{d.getDate()}</div></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small muted" style={{ marginBottom: 6 }}>{d.toLocaleDateString('en-IN', { weekday: 'long' })}</div>
              {items.sort((a, b) => new Date(a.interviewDate) - new Date(b.interviewDate)).map((i) => (
                <div key={i.interviewId} className="row" style={{ padding: '6px 0', gap: 10 }}>
                  <strong className="num" style={{ width: 70 }}>{new Date(i.interviewDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                  <span style={{ flex: 1, minWidth: 180 }}>{i.studentName} — {i.companyName}, {i.jobTitle}<span className="sub small muted">{i.interviewType} · Round {i.roundNo} · {i.officerName}</span></span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Interviews() {
  const { user } = useAuth();
  const isOfficer = user.role === 'OFFICER';
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/interviews', { initial: [] });
  const [tab, setTab] = useState('upcoming');
  const [result, setResult] = useState('');
  const [company, setCompany] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState(null);

  const now = new Date();
  const upcoming = data.filter((i) => new Date(i.interviewDate) >= now && i.result === 'PENDING');
  const companies = [...new Set(data.map((i) => i.companyName))].sort();
  const rows = data.filter((i) => {
    if (tab === 'completed' && i.result === 'PENDING') return false;
    if (result && i.result !== result) return false;
    if (company && i.companyName !== company) return false;
    const d = new Date(i.interviewDate);
    if (from && d < new Date(`${from}T00:00`)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  });

  const cancel = async (i) => {
    const ok = await confirm({ title: 'Cancel interview?', message: `Cancel round ${i.roundNo} (${i.interviewType}) for ${i.studentName} on ${formatDateTime(i.interviewDate)}?`, confirmLabel: 'Cancel interview', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/interviews/${i.interviewId}`);
      toast('Interview cancelled.');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const columns = [
    { key: 'interviewDate', label: 'Date & time', render: (i) => formatDateTime(i.interviewDate) },
    ...(isOfficer ? [{ key: 'studentName', label: 'Student', render: (i) => <><strong>{i.studentName}</strong><span className="sub">{i.rollNo}</span></> }] : []),
    { key: 'companyName', label: 'Company / Job', render: (i) => <>{i.companyName}<span className="sub">{i.jobTitle}</span></> },
    { key: 'interviewType', label: 'Type' },
    { key: 'roundNo', label: 'Round', className: 'num' },
    { key: 'officerName', label: 'Officer' },
    { key: 'result', label: 'Result', render: (i) => <StatusBadge status={i.result} /> },
    ...(isOfficer ? [
      { key: 'feedback', label: 'Feedback', render: (i) => <span className="small" title={i.feedback || ''}>{i.feedback ? (i.feedback.length > 40 ? `${i.feedback.slice(0, 40)}…` : i.feedback) : <span className="muted">—</span>}</span> },
      {
        key: '_actions', label: '', className: 'actions', render: (i) => (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(i)}><ClipboardEdit size={14} /> {i.result === 'PENDING' ? 'Record result' : 'Edit'}</button>
            {i.result === 'PENDING' && <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => cancel(i)} aria-label="Cancel interview"><Trash2 size={14} /></button>}
          </>
        ),
      },
    ] : []),
  ];

  return (
    <>
      <PageHeader
        title="Interviews"
        subtitle={isOfficer ? 'Schedule rounds, assign officers and record results.' : 'Your interview schedule and results.'}
        actions={isOfficer && <button type="button" className="btn btn-primary" onClick={() => setForm({})}><CalendarPlus size={16} /> Schedule interview</button>}
      />
      <div className="tabs" role="tablist">
        {[['upcoming', `Upcoming (${upcoming.length})`], ['all', 'All interviews'], ['completed', 'Completed']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          {tab === 'upcoming' ? <Upcoming rows={upcoming} /> : (
            <DataTable
              rows={rows}
              rowKey="interviewId"
              columns={columns}
              searchKeys={['studentName', 'rollNo', 'companyName', 'jobTitle', 'interviewType', 'officerName']}
              searchPlaceholder={isOfficer ? 'Search student, job or company…' : 'Search…'}
              initialSort={{ key: 'interviewDate', dir: 'desc' }}
              empty={{ icon: CalendarClock, title: 'No interviews', message: isOfficer ? 'Schedule an interview for an application to get started.' : 'You have no interviews yet.' }}
              filters={(
                <>
                  <select className="select" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result"><option value="">All results</option>{RESULTS.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}</select>
                  <select className="select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="">All companies</option>{companies.map((c) => <option key={c}>{c}</option>)}</select>
                  <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                  <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
                </>
              )}
            />
          )}
        </DataState>
      </div>
      {!isOfficer && <p className="small muted mt">Interviewer feedback is kept internal by the placement cell.</p>}
      {form && <InterviewForm interview={form.interviewId ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); reload(); }} />}
    </>
  );
}
