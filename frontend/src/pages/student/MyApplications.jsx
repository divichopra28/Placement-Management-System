import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, History, Undo2 } from 'lucide-react';
import api, { errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { DataState, PageHeader, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import { formatDate, formatDateTime, lpa } from '../../utils/format';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];

export function HistoryModal({ applicationId, onClose }) {
  const { data, loading, error, reload } = useApi(`/applications/${applicationId}`);
  return (
    <Modal title={`Application #${applicationId} history`} onClose={onClose}>
      <DataState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="stack">
            <div className="small muted">{data.studentName} · {data.jobTitle} at {data.companyName} · Applied {formatDateTime(data.applyDate)}</div>
            {data.history.length === 0 ? <p className="muted">No status changes yet — still {data.status}.</p> : (
              <ul className="list" style={{ border: '1px solid var(--border-soft)', borderRadius: 10 }}>
                {data.history.map((h) => (
                  <li key={h.auditId}>
                    <div className="grow small muted">{formatDateTime(h.changedOn)}</div>
                    <StatusBadge status={h.oldStatus} /> → <StatusBadge status={h.newStatus} />
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted">Entries are written automatically by the TRG_APPLICATION_AUDIT trigger.</p>
          </div>
        )}
      </DataState>
    </Modal>
  );
}

export default function MyApplications() {
  const { data, loading, error, reload } = useApi('/applications', { initial: [] });
  const { toast, confirm } = useFeedback();
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState(null);

  const withdraw = async (a) => {
    const ok = await confirm({ title: 'Withdraw application?', message: `Withdraw your application for ${a.jobTitle} at ${a.companyName}? You won't be able to re-apply to this drive.`, confirmLabel: 'Withdraw', danger: true });
    if (!ok) return;
    try {
      await api.patch(`/applications/${a.applicationId}/status`, { status: 'WITHDRAWN' });
      toast('Application withdrawn.');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const rows = status ? data.filter((r) => r.status === status) : data;

  return (
    <>
      <PageHeader title="My applications" subtitle="Every drive you've applied to and where it stands." actions={<Link to="/student/jobs" className="btn btn-primary">Find more drives</Link>} />
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="applicationId"
            searchKeys={['jobTitle', 'companyName', 'status']}
            searchPlaceholder="Search job or company…"
            initialSort={{ key: 'applyDate', dir: 'desc' }}
            empty={{ icon: ClipboardList, title: 'No applications yet', message: 'Browse open drives and apply to the ones you are eligible for.' }}
            filters={(
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select>
            )}
            columns={[
              { key: 'jobTitle', label: 'Job', render: (r) => <><strong>{r.jobTitle}</strong><span className="sub">{r.jobType || ''}</span></> },
              { key: 'companyName', label: 'Company' },
              { key: 'salaryLpa', label: 'Package', render: (r) => lpa(r.salaryLpa) },
              { key: 'applyDate', label: 'Applied on', render: (r) => formatDate(r.applyDate) },
              { key: 'interviewCount', label: 'Interviews', className: 'num' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              { key: 'offerStatus', label: 'Offer', render: (r) => (r.offerStatus ? <StatusBadge status={r.offerStatus} /> : <span className="muted">—</span>) },
              {
                key: '_actions', label: '', className: 'actions', render: (r) => (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistory(r.applicationId)}><History size={14} /> History</button>
                    {['APPLIED', 'SHORTLISTED'].includes(r.status) && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => withdraw(r)}><Undo2 size={14} /> Withdraw</button>
                    )}
                  </>
                ),
              },
            ]}
          />
        </DataState>
      </div>
      {history && <HistoryModal applicationId={history} onClose={() => setHistory(null)} />}
    </>
  );
}
