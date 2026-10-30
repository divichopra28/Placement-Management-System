import { useState } from 'react';
import { ListChecks, Pencil, UserSearch } from 'lucide-react';
import api, { errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { Alert, Badge, DataState, PageHeader, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import EligibilityFields, { eligibilityPayload, validateEligibility } from '../../components/EligibilityFields';

function EditCriteria({ job, onClose, onSaved }) {
  const { toast } = useFeedback();
  const [value, setValue] = useState({
    minCgpa: job.minCgpa ?? '',
    eligibleBranches: job.eligibleBranches || '',
    skillsRequired: job.skillsRequired || '',
    backlogsAllowed: job.backlogsAllowed ?? 0,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateEligibility(value);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await api.put(`/jobs/${job.jobId}/eligibility`, eligibilityPayload(value));
      toast('Eligibility criteria saved.');
      onSaved();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={`Eligibility — ${job.jobTitle} (${job.companyName})`} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="elig-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save criteria'}</button>
      </>
    )}>
      <form id="elig-form" className="form-grid" onSubmit={submit} noValidate>
        {job.applicantCount > 0 && <div className="full"><Alert type="warning">{job.applicantCount} student(s) have already applied. Changing criteria does not affect existing applications.</Alert></div>}
        <EligibilityFields value={value} onChange={setValue} errors={errors} />
      </form>
    </Modal>
  );
}

function Matrix({ job, onClose }) {
  const { data, loading, error, reload } = useApi(`/jobs/${job.jobId}/eligibility-matrix`, { initial: [] });
  const eligible = data.filter((r) => r.eligible).length;
  return (
    <Modal wide title={`Student eligibility — ${job.jobTitle}`} onClose={onClose}>
      <DataState loading={loading} error={error} onRetry={reload}>
        <p className="small muted" style={{ marginBottom: 10 }}>{eligible} of {data.length} students meet the blocking criteria. Backlogs cannot be verified because they are not stored in the database.</p>
        <div className="card">
          <DataTable
            rows={data.map((r) => ({ ...r, name: r.student.name, rollNo: r.student.rollNo, deptName: r.student.deptName, cgpa: r.student.cgpa, result: r.eligible ? 'ELIGIBLE' : 'INELIGIBLE' }))}
            rowKey="rollNo"
            searchKeys={['name', 'rollNo', 'deptName', 'result']}
            initialSort={{ key: 'result', dir: 'asc' }}
            columns={[
              { key: 'rollNo', label: 'Roll no' },
              { key: 'name', label: 'Student' },
              { key: 'deptName', label: 'Department' },
              { key: 'cgpa', label: 'CGPA', className: 'num' },
              { key: 'result', label: 'Result', render: (r) => <StatusBadge status={r.result} /> },
              { key: 'unmet', label: 'Unmet criteria', sortable: false, render: (r) => <span className="small">{r.unmet.length ? r.unmet.join(' ') : <span className="muted">—</span>}</span> },
            ]}
          />
        </div>
      </DataState>
    </Modal>
  );
}

export default function EligibilityAdmin() {
  const { data, loading, error, reload } = useApi('/jobs', { initial: [] });
  const [editing, setEditing] = useState(null);
  const [matrix, setMatrix] = useState(null);

  return (
    <>
      <PageHeader title="Eligibility management" subtitle="Criteria stored in the ELIGIBILITY table. Branches and skills are comma-separated names matched against DEPARTMENT and SKILL." />
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={data}
            rowKey="jobId"
            searchKeys={['jobTitle', 'companyName', 'eligibleBranches', 'skillsRequired']}
            searchPlaceholder="Search jobs or criteria…"
            empty={{ icon: ListChecks, title: 'No job postings', message: 'Create a job posting to define its eligibility.' }}
            columns={[
              { key: 'jobTitle', label: 'Job', render: (j) => <><strong>{j.jobTitle}</strong><span className="sub">{j.companyName}</span></> },
              { key: 'minCgpa', label: 'Min CGPA', className: 'num', render: (j) => (j.hasEligibility == null ? <Badge tone="error">Missing</Badge> : j.minCgpa ?? '—') },
              { key: 'eligibleBranches', label: 'Branches', render: (j) => <span className="small">{j.eligibleBranches ? j.eligibleBranches.split(',').join(', ') : <span className="muted">All branches</span>}</span> },
              { key: 'skillsRequired', label: 'Required skills', render: (j) => (j.skillsRequired ? <div className="chips">{j.skillsRequired.split(',').map((s) => <Badge key={s}>{s}</Badge>)}</div> : <span className="muted small">None</span>) },
              { key: 'backlogsAllowed', label: 'Backlogs', className: 'num' },
              { key: 'driveStatus', label: 'Drive', render: (j) => <StatusBadge status={j.driveStatus} /> },
              {
                key: '_actions', label: '', className: 'actions', render: (j) => (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMatrix(j)}><UserSearch size={14} /> Check students</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(j)}><Pencil size={14} /> Edit</button>
                  </>
                ),
              },
            ]}
          />
        </DataState>
      </div>
      {editing && <EditCriteria job={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {matrix && <Matrix job={matrix} onClose={() => setMatrix(null)} />}
    </>
  );
}
