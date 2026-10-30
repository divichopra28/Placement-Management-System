import { useState } from 'react';
import { Check, ClipboardList, Download, History, RotateCcw, X } from 'lucide-react';
import api, { errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { DataState, PageHeader, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { HistoryModal } from '../student/MyApplications';
import { resumeUrl } from '../../components/StudentProfileView';
import { formatDate } from '../../utils/format';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];

export default function ApplicationsAdmin() {
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/applications', { initial: [] });
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [job, setJob] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [history, setHistory] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const companies = [...new Set(data.map((a) => a.companyName))].sort();
  const jobs = [...new Map(data.filter((a) => !company || a.companyName === company).map((a) => [a.jobId, `${a.jobTitle} (${a.companyName})`])).entries()];
  const rows = data.filter((a) => {
    if (status && a.status !== status) return false;
    if (company && a.companyName !== company) return false;
    if (job && a.jobId !== Number(job)) return false;
    const d = new Date(a.applyDate);
    if (from && d < new Date(`${from}T00:00`)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  });

  const setAppStatus = async (a, next) => {
    if (next === 'REJECTED') {
      const ok = await confirm({ title: 'Reject application?', message: `Reject ${a.studentName}'s application for ${a.jobTitle} at ${a.companyName}?`, confirmLabel: 'Reject', danger: true });
      if (!ok) return;
    }
    setBusyId(a.applicationId);
    try {
      await api.patch(`/applications/${a.applicationId}/status`, { status: next });
      toast(`Application #${a.applicationId} marked ${next.toLowerCase()}.`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const counts = STATUSES.map((s) => [s, data.filter((a) => a.status === s).length]);

  return (
    <>
      <PageHeader title="Applications" subtitle="Shortlist or reject applicants. Every status change is logged by TRG_APPLICATION_AUDIT. Selection happens by creating an offer." />
      <div className="row" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip-toggle ${status === '' ? 'on' : ''}`} onClick={() => setStatus('')}>All ({data.length})</button>
        {counts.map(([s, n]) => (
          <button type="button" key={s} className={`chip-toggle ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s.charAt(0) + s.slice(1).toLowerCase()} ({n})</button>
        ))}
      </div>
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="applicationId"
            searchKeys={['studentName', 'rollNo', 'jobTitle', 'companyName', 'skills', 'deptName']}
            searchPlaceholder="Search student name or roll no…"
            initialSort={{ key: 'applyDate', dir: 'desc' }}
            empty={{ icon: ClipboardList, title: 'No applications', message: 'Applications appear here when students apply to drives.' }}
            filters={(
              <>
                <select className="select" value={company} onChange={(e) => { setCompany(e.target.value); setJob(''); }} aria-label="Company"><option value="">All companies</option>{companies.map((c) => <option key={c}>{c}</option>)}</select>
                <select className="select" value={job} onChange={(e) => setJob(e.target.value)} aria-label="Job"><option value="">All jobs</option>{jobs.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Applied from" />
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Applied to" />
              </>
            )}
            columns={[
              { key: 'applicationId', label: '#', className: 'num' },
              { key: 'studentName', label: 'Student', render: (a) => <><strong>{a.studentName}</strong><span className="sub">{a.rollNo} · {a.deptName}</span></> },
              { key: 'cgpa', label: 'CGPA', className: 'num' },
              { key: 'skills', label: 'Skills', render: (a) => <span className="small">{a.skills || <span className="muted">—</span>}</span> },
              { key: 'jobTitle', label: 'Job', render: (a) => <>{a.jobTitle}<span className="sub">{a.companyName}</span></> },
              { key: 'applyDate', label: 'Applied', render: (a) => formatDate(a.applyDate) },
              { key: 'resumePath', label: 'Resume', sortable: false, render: (a) => (a.resumePath ? <a className="btn btn-ghost btn-sm" href={resumeUrl(a.studentId)} title={a.resumePath}><Download size={13} /> CV</a> : <span className="muted small">—</span>) },
              { key: 'status', label: 'Status', render: (a) => <>{<StatusBadge status={a.status} />}{a.interviewCount > 0 && <span className="sub">{a.interviewCount} interview(s)</span>}</> },
              {
                key: '_actions', label: '', className: 'actions', render: (a) => {
                  const busy = busyId === a.applicationId;
                  return (
                    <>
                      {a.status === 'APPLIED' && <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => setAppStatus(a, 'SHORTLISTED')}><Check size={13} /> Shortlist</button>}
                      {['APPLIED', 'SHORTLISTED'].includes(a.status) && !a.offerId && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setAppStatus(a, 'REJECTED')}><X size={13} /> Reject</button>}
                      {['SHORTLISTED', 'REJECTED'].includes(a.status) && !a.offerId && <button type="button" className="btn btn-ghost btn-sm icon-btn" disabled={busy} onClick={() => setAppStatus(a, 'APPLIED')} title="Move back to Applied" aria-label="Move back to Applied"><RotateCcw size={13} /></button>}
                      <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setHistory(a.applicationId)} title="Status history" aria-label="Status history"><History size={14} /></button>
                    </>
                  );
                },
              },
            ]}
          />
        </DataState>
      </div>
      {history && <HistoryModal applicationId={history} onClose={() => setHistory(null)} />}
    </>
  );
}
