import { useState } from 'react';
import { Download, History } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Alert, DataState, PageHeader, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { downloadCsv, formatDateTime } from '../../utils/format';

const STATUSES = ['APPLIED', 'SHORTLISTED', 'REJECTED', 'SELECTED', 'WITHDRAWN'];
const CSV_COLS = [
  { key: 'auditId', label: 'Audit ID' }, { key: 'applicationId', label: 'Application ID' }, { key: 'studentName', label: 'Student' },
  { key: 'rollNo', label: 'Roll no' }, { key: 'jobTitle', label: 'Job' }, { key: 'companyName', label: 'Company' },
  { key: 'oldStatus', label: 'Previous status' }, { key: 'newStatus', label: 'New status' }, { key: 'changedOn', label: 'Changed on' },
  { key: 'changedBy', label: 'Changed by (DB user)' },
];

export default function AuditLogs() {
  const { data, loading, error, reload } = useApi('/audit-logs', { initial: [] });
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rows = data.filter((a) => {
    if (status && a.newStatus !== status) return false;
    const d = new Date(a.changedOn);
    if (from && d < new Date(`${from}T00:00`)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Application status history written by the TRG_APPLICATION_AUDIT trigger."
        actions={<button type="button" className="btn btn-secondary" disabled={!rows.length} onClick={() => downloadCsv('application-audit.csv', CSV_COLS, rows)}><Download size={16} /> Export CSV</button>} />
      <div style={{ marginBottom: 16 }}>
        <Alert type="info">Audit entries are read-only. “Changed by” is the Oracle session user recorded by the trigger (USER), which is the application's database account.</Alert>
      </div>
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="auditId"
            searchKeys={['studentName', 'rollNo', 'jobTitle', 'companyName', 'oldStatus', 'newStatus', 'applicationId']}
            searchPlaceholder="Search student, job, status or application ID…"
            initialSort={{ key: 'changedOn', dir: 'desc' }}
            pageSize={25}
            empty={{ icon: History, title: 'No audit entries yet', message: 'Entries appear when an application status changes.' }}
            filters={(
              <>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="New status"><option value="">Any new status</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </>
            )}
            columns={[
              { key: 'auditId', label: 'Audit ID', className: 'num' },
              { key: 'applicationId', label: 'Application', className: 'num' },
              { key: 'studentName', label: 'Student / Job', render: (a) => <>{a.studentName || <span className="muted">Deleted</span>}<span className="sub">{a.jobTitle ? `${a.jobTitle} · ${a.companyName}` : ''}</span></> },
              { key: 'oldStatus', label: 'Previous', render: (a) => <StatusBadge status={a.oldStatus} /> },
              { key: 'newStatus', label: 'New', render: (a) => <StatusBadge status={a.newStatus} /> },
              { key: 'changedOn', label: 'Date & time', render: (a) => formatDateTime(a.changedOn) },
              { key: 'changedBy', label: 'DB user', render: (a) => <code className="small">{a.changedBy}</code> },
            ]}
          />
        </DataState>
      </div>
    </>
  );
}
