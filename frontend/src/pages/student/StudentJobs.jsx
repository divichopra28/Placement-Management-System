import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, Building2, CalendarDays, IndianRupee, MapPin, Search, Users } from 'lucide-react';
import api, { errorMessage } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { useFeedback } from '../../components/Feedback';
import { Alert, DataState, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import Modal from '../../components/Modal';
import EligibilityPanel from '../../components/EligibilityPanel';
import { daysUntil, formatDate, lpa } from '../../utils/format';

function JobDetail({ job, onClose, onApplied }) {
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const elig = job.myEligibility;
  const open = job.driveStatus === 'OPEN';
  const canApply = open && !job.myApplication && elig?.eligible;

  const apply = async () => {
    const ok = await confirm({
      title: `Apply to ${job.companyName}?`,
      message: `Submit your application for ${job.jobTitle}. Your uploaded resume (if any) will be attached. Backlog eligibility is verified manually by the placement cell.`,
      confirmLabel: 'Submit application',
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/applications', { jobId: job.jobId });
      toast(`Applied to ${job.jobTitle} at ${job.companyName}.`);
      onApplied();
    } catch (err) {
      // e.g. ORA-20001 from TRG_CHECK_ELIGIBILITY or the unique constraint.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title={job.jobTitle} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        {job.myApplication ? <span className="row small">Your application: <StatusBadge status={job.myApplication.status} /></span>
          : <button type="button" className="btn btn-primary" disabled={!canApply || busy} onClick={apply}>{busy ? 'Submitting…' : !open ? 'Applications closed' : !elig?.eligible ? 'Not eligible' : 'Apply now'}</button>}
      </>
    )}>
      <div className="stack">
        {error && <Alert>{error}</Alert>}
        <div className="row muted small" style={{ gap: 16 }}>
          <span className="row" style={{ gap: 5 }}><Building2 size={14} /> {job.companyName}</span>
          <span className="row" style={{ gap: 5 }}><MapPin size={14} /> {job.location || '—'}</span>
          <span className="row" style={{ gap: 5 }}><Briefcase size={14} /> {job.jobType || '—'}</span>
          <span className="row" style={{ gap: 5 }}><Users size={14} /> {job.vacancies} vacancies</span>
        </div>
        <div className="grid grid-2">
          <dl className="dl">
            <dt>Package</dt><dd>{lpa(job.salaryLpa)}</dd>
            <dt>Drive date</dt><dd>{formatDate(job.driveDate)}</dd>
            <dt>Apply by</dt><dd>{formatDate(job.applicationDeadline)} {open ? '' : <StatusBadge status="CLOSED" />}</dd>
          </dl>
          <dl className="dl">
            <dt>Minimum CGPA</dt><dd>{job.minCgpa ?? '—'}</dd>
            <dt>Branches</dt><dd>{job.eligibleBranches ? job.eligibleBranches.split(',').join(', ') : 'All branches'}</dd>
            <dt>Skills</dt><dd>{job.skillsRequired ? job.skillsRequired.split(',').join(', ') : 'None specified'}</dd>
            <dt>Backlogs allowed</dt><dd>{job.backlogsAllowed ?? 0}</dd>
          </dl>
        </div>
        <div>
          <h3 style={{ marginBottom: 6 }}>Description</h3>
          <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{job.description || 'No description provided.'}</p>
        </div>
        <div className="card card-pad" style={{ background: 'var(--bg-3)' }}>
          <h3 style={{ marginBottom: 8 }}>Your eligibility</h3>
          <EligibilityPanel result={{ ...elig, applicationOpen: open }} />
        </div>
      </div>
    </Modal>
  );
}

export default function StudentJobs() {
  const { data, loading, error, reload } = useApi('/jobs', { initial: [] });
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [minPkg, setMinPkg] = useState('');
  const [show, setShow] = useState('open');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const id = Number(params.get('job'));
    if (id) setSelectedId(id);
  }, [params]);

  const uniq = (key) => [...new Set(data.map((j) => j[key]).filter(Boolean))].sort();

  const jobs = useMemo(() => data.filter((j) => {
    if (show === 'open' && j.driveStatus !== 'OPEN') return false;
    if (show === 'eligible' && !(j.driveStatus === 'OPEN' && j.myEligibility?.eligible)) return false;
    if (show === 'applied' && !j.myApplication) return false;
    if (company && j.companyName !== company) return false;
    if (location && j.location !== location) return false;
    if (type && j.jobType !== type) return false;
    if (minPkg && !(Number(j.salaryLpa) >= Number(minPkg))) return false;
    const s = q.trim().toLowerCase();
    if (s && !`${j.jobTitle} ${j.companyName} ${j.description || ''} ${j.location || ''}`.toLowerCase().includes(s)) return false;
    return true;
  }), [data, q, company, location, type, minPkg, show]);

  const selected = data.find((j) => j.jobId === selectedId);
  const closeDetail = () => { setSelectedId(null); if (params.get('job')) setParams({}, { replace: true }); };

  return (
    <>
      <PageHeader title="Jobs and drives" subtitle="Browse campus drives, check your eligibility and apply." />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters" style={{ borderRadius: 'var(--radius)', borderBottom: 0 }}>
          <div className="search input-icon"><Search size={15} /><input className="input" type="search" placeholder="Search title, company, location…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search jobs" /></div>
          <select className="select" value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
            <option value="open">Open drives</option><option value="eligible">Eligible &amp; open</option><option value="applied">Applied</option><option value="all">All drives</option>
          </select>
          <select className="select" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company"><option value="">All companies</option>{uniq('companyName').map((c) => <option key={c}>{c}</option>)}</select>
          <select className="select" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location"><option value="">All locations</option>{uniq('location').map((c) => <option key={c}>{c}</option>)}</select>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Job type"><option value="">All job types</option>{uniq('jobType').map((c) => <option key={c}>{c}</option>)}</select>
          <select className="select" value={minPkg} onChange={(e) => setMinPkg(e.target.value)} aria-label="Minimum package">
            <option value="">Any package</option><option value="5">5+ LPA</option><option value="8">8+ LPA</option><option value="10">10+ LPA</option><option value="15">15+ LPA</option>
          </select>
        </div>
      </div>

      <DataState loading={loading && !data.length} error={error} onRetry={reload}>
        {jobs.length === 0 ? (
          <div className="card"><EmptyState icon={Briefcase} title="No drives match" message="Try a different filter, or check back when the placement cell announces new drives." /></div>
        ) : (
          <div className="grid grid-3">
            {jobs.map((j) => {
              const left = daysUntil(j.applicationDeadline);
              return (
                <article className="card job-card" key={j.jobId}>
                  <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3>{j.jobTitle}</h3>
                      <div className="muted small">{j.companyName}{j.industry ? ` · ${j.industry}` : ''}</div>
                    </div>
                    <StatusBadge status={j.driveStatus} />
                  </div>
                  <div className="meta">
                    <span><IndianRupee size={13} /> {lpa(j.salaryLpa)}</span>
                    <span><MapPin size={13} /> {j.location || '—'}</span>
                    <span><Briefcase size={13} /> {j.jobType || '—'}</span>
                    <span><CalendarDays size={13} /> Apply by {formatDate(j.applicationDeadline)}{j.driveStatus === 'OPEN' && left !== null && left <= 3 ? ` (${left === 0 ? 'today' : `${left}d left`})` : ''}</span>
                  </div>
                  <div className="small muted">Min CGPA {j.minCgpa ?? '—'} · {j.skillsRequired ? j.skillsRequired.split(',').join(', ') : 'No specific skills'}</div>
                  <div className="foot">
                    {j.myApplication ? <StatusBadge status={j.myApplication.status} />
                      : <span className={`badge ${j.myEligibility?.eligible ? 'badge-success' : 'badge-error'}`}>{j.myEligibility?.eligible ? 'Eligible' : 'Not eligible'}</span>}
                    <div className="spacer" />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedId(j.jobId)}>View &amp; check eligibility</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DataState>
      {selected && <JobDetail job={selected} onClose={closeDetail} onApplied={() => { reload(); }} />}
    </>
  );
}
