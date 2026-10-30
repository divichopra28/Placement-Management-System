import { useState } from 'react';
import { Award, Download } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { DataState, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import { downloadCsv, formatDate, lpa } from '../../utils/format';

const COLUMNS = [
  { key: 'placementId', label: 'Placement ID' }, { key: 'studentName', label: 'Student' }, { key: 'rollNo', label: 'Roll no' },
  { key: 'deptName', label: 'Department' }, { key: 'companyName', label: 'Company' }, { key: 'jobTitle', label: 'Job' },
  { key: 'packageLpa', label: 'Package (LPA)' }, { key: 'placedOn', label: 'Placed on' }, { key: 'joiningDate', label: 'Joining date' },
  { key: 'placementStatus', label: 'Status' },
];

export default function Placements() {
  const { data, loading, error, reload } = useApi('/placements', { initial: [] });
  const [dept, setDept] = useState('');
  const [company, setCompany] = useState('');
  const uniq = (k) => [...new Set(data.map((p) => p[k]).filter(Boolean))].sort();
  const rows = data.filter((p) => (!dept || p.deptName === dept) && (!company || p.companyName === company));
  const pkgs = rows.map((p) => Number(p.packageLpa)).filter((n) => !Number.isNaN(n));
  const avg = pkgs.length ? pkgs.reduce((a, b) => a + b, 0) / pkgs.length : null;

  return (
    <>
      <PageHeader title="Placements" subtitle="Confirmed placements from the PLACEMENT_DETAILS view. Records are created by TRG_CREATE_PLACEMENT when an offer is accepted."
        actions={<button type="button" className="btn btn-secondary" disabled={!rows.length} onClick={() => downloadCsv('placements.csv', COLUMNS, rows)}><Download size={16} /> Export CSV</button>} />
      <div className="stats">
        <StatCard icon={Award} label="Placements shown" value={rows.length} />
        <StatCard label="Average package" value={avg != null ? lpa(avg.toFixed(2)) : '—'} />
        <StatCard label="Highest package" value={pkgs.length ? lpa(Math.max(...pkgs)) : '—'} />
      </div>
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="placementId"
            searchKeys={['studentName', 'rollNo', 'companyName', 'jobTitle', 'deptName']}
            searchPlaceholder="Search placements…"
            initialSort={{ key: 'placedOn', dir: 'desc' }}
            empty={{ icon: Award, title: 'No placements yet', message: 'A placement is created automatically when a student accepts an offer.' }}
            filters={(
              <>
                <select className="select" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="">All departments</option>{uniq('deptName').map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="">All companies</option>{uniq('companyName').map((x) => <option key={x}>{x}</option>)}</select>
              </>
            )}
            columns={[
              { key: 'placementId', label: '#', className: 'num' },
              { key: 'studentName', label: 'Student', render: (p) => <><strong>{p.studentName}</strong><span className="sub">{p.rollNo} · {p.deptName}</span></> },
              { key: 'companyName', label: 'Company / Job', render: (p) => <>{p.companyName}<span className="sub">{p.jobTitle}</span></> },
              { key: 'packageLpa', label: 'Package', render: (p) => lpa(p.packageLpa) },
              { key: 'ctc', label: 'CTC', render: (p) => lpa(p.ctc) },
              { key: 'placedOn', label: 'Placed on', render: (p) => formatDate(p.placedOn) },
              { key: 'joiningDate', label: 'Joining', render: (p) => formatDate(p.joiningDate) },
              { key: 'placementStatus', label: 'Status', render: (p) => <StatusBadge status={p.placementStatus} /> },
            ]}
          />
        </DataState>
      </div>
    </>
  );
}
