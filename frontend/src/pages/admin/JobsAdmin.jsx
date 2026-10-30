import { useState } from 'react';
import { Briefcase, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { DataState, EmptyState, Field, PageHeader, StatusBadge } from '../../components/ui';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import EligibilityFields, { eligibilityPayload, validateEligibility } from '../../components/EligibilityFields';
import { daysUntil, formatDate, lpa, toInputDate } from '../../utils/format';

const TYPES = ['Full Time', 'Internship', 'Internship + PPO', 'Part Time', 'Contract'];

function JobForm({ job, companies, onClose, onSaved }) {
  const { toast } = useFeedback();
  const isEdit = Boolean(job);
  const [form, setForm] = useState({
    companyId: job?.companyId || '',
    jobTitle: job?.jobTitle || '',
    jobType: job?.jobType || 'Full Time',
    description: job?.description || '',
    salaryLpa: job?.salaryLpa ?? '',
    location: job?.location || '',
    vacancies: job?.vacancies ?? 1,
    driveDate: toInputDate(job?.driveDate),
    applicationDeadline: toInputDate(job?.applicationDeadline),
  });
  const [elig, setElig] = useState({
    minCgpa: job?.minCgpa ?? '',
    eligibleBranches: job?.eligibleBranches || '',
    skillsRequired: job?.skillsRequired || '',
    backlogsAllowed: job?.backlogsAllowed ?? 0,
  });
  const [errors, setErrors] = useState({});
  const [eErrors, setEErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.companyId) errs.companyId = 'Choose a company.';
    if (!form.jobTitle.trim()) errs.jobTitle = 'Job title is required.';
    if (!(Number.isInteger(Number(form.vacancies)) && Number(form.vacancies) > 0)) errs.vacancies = 'Vacancies must be at least 1.';
    if (form.salaryLpa !== '' && !(Number(form.salaryLpa) >= 0)) errs.salaryLpa = 'Enter a valid package.';
    if (form.description.length > 500) errs.description = 'At most 500 characters.';
    if (form.driveDate && form.applicationDeadline && form.applicationDeadline > form.driveDate) errs.applicationDeadline = 'Deadline must be on or before the drive date.';
    const ee = validateEligibility(elig);
    setErrors(errs);
    setEErrors(ee);
    if (Object.keys(errs).length || Object.keys(ee).length) return;
    const payload = {
      ...form,
      companyId: Number(form.companyId),
      salaryLpa: form.salaryLpa === '' ? null : Number(form.salaryLpa),
      vacancies: Number(form.vacancies),
      driveDate: form.driveDate || null,
      applicationDeadline: form.applicationDeadline || null,
      eligibility: eligibilityPayload(elig),
    };
    setBusy(true);
    try {
      if (isEdit) await api.put(`/jobs/${job.jobId}`, payload);
      else await api.post('/jobs', payload);
      toast(isEdit ? 'Job posting updated.' : 'Job posting and eligibility created.');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={isEdit ? `Edit ${job.jobTitle}` : 'Create job posting'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="job-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save posting'}</button>
      </>
    )}>
      <form id="job-form" className="form-grid" onSubmit={submit} noValidate>
        <Field label="Company" required error={errors.companyId} htmlFor="j-co">
          <select id="j-co" className={`select ${errors.companyId ? 'invalid' : ''}`} value={form.companyId} onChange={set('companyId')}>
            <option value="">Select…</option>
            {companies.map((c) => <option key={c.companyId} value={c.companyId}>{c.companyName}</option>)}
          </select>
        </Field>
        <Field label="Job title" required error={errors.jobTitle} htmlFor="j-title"><input id="j-title" className={`input ${errors.jobTitle ? 'invalid' : ''}`} maxLength={150} value={form.jobTitle} onChange={set('jobTitle')} /></Field>
        <Field label="Job type" htmlFor="j-type">
          <select id="j-type" className="select" value={form.jobType} onChange={set('jobType')}>{[...new Set([...TYPES, form.jobType].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Package (LPA)" error={errors.salaryLpa} htmlFor="j-sal"><input id="j-sal" type="number" step="0.01" min="0" className={`input ${errors.salaryLpa ? 'invalid' : ''}`} value={form.salaryLpa} onChange={set('salaryLpa')} /></Field>
        <Field label="Location" htmlFor="j-loc"><input id="j-loc" className="input" maxLength={150} value={form.location} onChange={set('location')} /></Field>
        <Field label="Vacancies" required error={errors.vacancies} htmlFor="j-vac"><input id="j-vac" type="number" min="1" className={`input ${errors.vacancies ? 'invalid' : ''}`} value={form.vacancies} onChange={set('vacancies')} /></Field>
        <Field label="Application deadline" error={errors.applicationDeadline} htmlFor="j-dl" hint="The drive is open until the end of this day."><input id="j-dl" type="date" className={`input ${errors.applicationDeadline ? 'invalid' : ''}`} value={form.applicationDeadline} onChange={set('applicationDeadline')} /></Field>
        <Field label="Drive date" htmlFor="j-dd"><input id="j-dd" type="date" className="input" value={form.driveDate} onChange={set('driveDate')} /></Field>
        <Field label="Description" full error={errors.description} hint={`${form.description.length}/500`} htmlFor="j-desc"><textarea id="j-desc" className="textarea" maxLength={500} value={form.description} onChange={set('description')} /></Field>
        <h3 className="full" style={{ marginTop: 6 }}>Eligibility criteria</h3>
        <EligibilityFields value={elig} onChange={setElig} errors={eErrors} />
      </form>
    </Modal>
  );
}

function Applicants({ jobId, onClose }) {
  const { data, loading, error, reload } = useApi(`/jobs/${jobId}`);
  return (
    <Modal wide title={data ? `Applicants — ${data.jobTitle} (${data.companyName})` : 'Applicants'} onClose={onClose}>
      <DataState loading={loading} error={error} onRetry={reload}>
        {data && (data.applicants.length === 0 ? <EmptyState icon={Users} title="No applicants yet" /> : (
          <div className="table-wrap card">
            <table className="table">
              <thead><tr><th>#</th><th>Student</th><th>Department</th><th>CGPA</th><th>Applied</th><th>Status</th></tr></thead>
              <tbody>
                {data.applicants.map((a) => (
                  <tr key={a.applicationId}>
                    <td className="num">{a.applicationId}</td>
                    <td><strong>{a.studentName}</strong><span className="sub">{a.rollNo}</span></td>
                    <td>{a.deptName}</td><td className="num">{a.cgpa}</td>
                    <td>{formatDate(a.applyDate)}</td><td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </DataState>
    </Modal>
  );
}

export default function JobsAdmin() {
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/jobs', { initial: [] });
  const companies = useApi('/companies', { initial: [] });
  const [company, setCompany] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [minPkg, setMinPkg] = useState('');
  const [editing, setEditing] = useState(null);
  const [applicants, setApplicants] = useState(null);

  const uniq = (k) => [...new Set(data.map((j) => j[k]).filter(Boolean))].sort();
  const rows = data.filter((j) => (!company || j.companyName === company) && (!type || j.jobType === type) && (!location || j.location === location)
    && (!status || j.driveStatus === status) && (!minPkg || Number(j.salaryLpa) >= Number(minPkg)));

  const closeDrive = async (j) => {
    const ok = await confirm({ title: `Close ${j.jobTitle}?`, message: 'Closing sets the application deadline to yesterday, so no new applications are accepted. You can reopen it later by editing the deadline.', confirmLabel: 'Close drive' });
    if (!ok) return;
    try {
      await api.patch(`/jobs/${j.jobId}/close`);
      toast('Drive closed.');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  const remove = async (j) => {
    if (j.applicantCount > 0) { toast(`This job has ${j.applicantCount} application(s) and cannot be deleted. Close the drive instead.`, 'error'); return; }
    const ok = await confirm({ title: `Delete ${j.jobTitle}?`, message: 'The job posting and its eligibility criteria will be permanently deleted.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/jobs/${j.jobId}`);
      toast('Job posting deleted.');
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Job and drive management" subtitle="Drive status is derived from the application deadline (open until the end of that day)."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({})} disabled={!companies.data.length}><Plus size={16} /> Create job posting</button>} />
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="jobId"
            searchKeys={['jobTitle', 'companyName', 'location', 'jobType', 'description']}
            searchPlaceholder="Search jobs…"
            initialSort={{ key: 'applicationDeadline', dir: 'desc' }}
            empty={{ icon: Briefcase, title: 'No job postings', message: 'Create the first drive for a registered company.' }}
            filters={(
              <>
                <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Open &amp; closed</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select>
                <select className="select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="">All companies</option>{uniq('companyName').map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Job type"><option value="">All types</option>{uniq('jobType').map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location"><option value="">All locations</option>{uniq('location').map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" value={minPkg} onChange={(e) => setMinPkg(e.target.value)} aria-label="Minimum package"><option value="">Any package</option><option value="5">5+ LPA</option><option value="8">8+ LPA</option><option value="10">10+ LPA</option></select>
              </>
            )}
            columns={[
              { key: 'jobTitle', label: 'Job', render: (j) => <><strong>{j.jobTitle}</strong><span className="sub">{j.companyName} · {j.jobType || '—'}</span></> },
              { key: 'salaryLpa', label: 'Package', render: (j) => lpa(j.salaryLpa) },
              { key: 'location', label: 'Location' },
              { key: 'vacancies', label: 'Vacancies', className: 'num' },
              { key: 'applicationDeadline', label: 'Deadline', render: (j) => { const d = daysUntil(j.applicationDeadline); return <>{formatDate(j.applicationDeadline)}{j.driveStatus === 'OPEN' && d !== null && <span className="sub">{d === 0 ? 'closes today' : `${d} day(s) left`}</span>}</>; } },
              { key: 'driveDate', label: 'Drive date', render: (j) => formatDate(j.driveDate) },
              { key: 'minCgpa', label: 'Eligibility', render: (j) => <span className="small">CGPA ≥ {j.minCgpa ?? '—'}<span className="sub">{j.skillsRequired ? j.skillsRequired.split(',').join(', ') : 'No skills required'}</span></span> },
              { key: 'applicantCount', label: 'Applicants', className: 'num', render: (j) => <button type="button" className="btn btn-ghost btn-sm" onClick={() => setApplicants(j.jobId)}><Users size={13} /> {j.applicantCount}</button> },
              { key: 'driveStatus', label: 'Status', render: (j) => <StatusBadge status={j.driveStatus} /> },
              {
                key: '_actions', label: '', className: 'actions', render: (j) => (
                  <>
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setEditing(j)} aria-label={`Edit ${j.jobTitle}`}><Pencil size={14} /></button>
                    {j.driveStatus === 'OPEN' && <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => closeDrive(j)} aria-label={`Close ${j.jobTitle}`} title="Close drive"><Lock size={14} /></button>}
                    <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => remove(j)} aria-label={`Delete ${j.jobTitle}`}><Trash2 size={14} /></button>
                  </>
                ),
              },
            ]}
          />
        </DataState>
      </div>
      {editing && <JobForm job={editing.jobId ? editing : null} companies={companies.data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {applicants && <Applicants jobId={applicants} onClose={() => setApplicants(null)} />}
    </>
  );
}
