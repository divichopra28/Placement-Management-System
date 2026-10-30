import { useState } from 'react';
import { Building2, ExternalLink, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import api, { errorMessage, fieldErrors } from '../services/api';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/AuthContext';
import { useFeedback } from '../components/Feedback';
import { DataState, Field, PageHeader, StatusBadge } from '../components/ui';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { formatDate, lpa } from '../utils/format';

const EMPTY = { companyName: '', industry: '', website: '', location: '', contactPerson: '', contactEmail: '', phone: '' };

function validate(f) {
  const e = {};
  if (!f.companyName.trim()) e.companyName = 'Company name is required.';
  if (f.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.contactEmail.trim())) e.contactEmail = 'Enter a valid email address.';
  if (f.phone && !/^[+]?[0-9][0-9\s-]{5,13}[0-9]$/.test(f.phone.trim())) e.phone = 'Enter a valid phone number (7–15 digits).';
  if (f.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(f.website.trim())) e.website = 'Website must start with http:// or https://';
  return e;
}

function CompanyForm({ company, onClose, onSaved }) {
  const { toast } = useFeedback();
  const [form, setForm] = useState(company ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, company[k] ?? ''])) : EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      if (company) await api.put(`/companies/${company.companyId}`, form);
      else await api.post('/companies', form);
      toast(company ? 'Company updated.' : 'Company added.');
      onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const input = (k, label, props = {}) => (
    <Field label={label} required={k === 'companyName'} error={errors[k]} htmlFor={`c-${k}`}>
      <input id={`c-${k}`} className={`input ${errors[k] ? 'invalid' : ''}`} value={form[k]} onChange={set(k)} {...props} />
    </Field>
  );

  return (
    <Modal wide title={company ? `Edit ${company.companyName}` : 'Add company'} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="company-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save company'}</button>
      </>
    )}>
      <form id="company-form" className="form-grid" onSubmit={submit} noValidate>
        {input('companyName', 'Company name', { maxLength: 150 })}
        {input('industry', 'Industry', { maxLength: 100, placeholder: 'e.g. IT Services' })}
        {input('website', 'Website', { maxLength: 200, placeholder: 'https://' })}
        {input('location', 'Location', { maxLength: 150 })}
        {input('contactPerson', 'Contact person', { maxLength: 100 })}
        {input('contactEmail', 'Contact email', { type: 'email', maxLength: 100 })}
        {input('phone', 'Phone', { inputMode: 'tel', maxLength: 15 })}
      </form>
    </Modal>
  );
}

function CompanyDetail({ id, isOfficer, onClose }) {
  const { data, loading, error, reload } = useApi(`/companies/${id}`);
  return (
    <Modal wide title={data?.companyName || 'Company'} onClose={onClose}>
      <DataState loading={loading} error={error} onRetry={reload}>
        {data && (
          <div className="stack">
            <div className="grid grid-2">
              <dl className="dl">
                <dt>Industry</dt><dd>{data.industry || '—'}</dd>
                <dt>Location</dt><dd>{data.location || '—'}</dd>
                <dt>Website</dt><dd>{data.website ? <a href={data.website} target="_blank" rel="noopener noreferrer">{data.website}</a> : '—'}</dd>
                {isOfficer && <><dt>Contact</dt><dd>{data.contactPerson || '—'}<span className="sub small muted">{[data.contactEmail, data.phone].filter(Boolean).join(' · ')}</span></dd></>}
              </dl>
              <div className="stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 0 }}>
                <div className="card stat"><div><div className="stat-label">Job postings</div><div className="stat-value">{data.jobCount}</div></div></div>
                <div className="card stat"><div><div className="stat-label">Applications</div><div className="stat-value">{data.applicationCount}</div></div></div>
                <div className="card stat"><div><div className="stat-label">Offers</div><div className="stat-value">{data.offerCount}</div></div></div>
                <div className="card stat"><div><div className="stat-label">Placed</div><div className="stat-value">{data.stats.placed}</div>{data.stats.avgPackage && <div className="stat-hint">Avg {lpa(data.stats.avgPackage)} · Max {lpa(data.stats.maxPackage)}</div>}</div></div>
              </div>
            </div>
            {isOfficer && data.applicationsByStatus.length > 0 && (
              <div className="row small">Applications by status: {data.applicationsByStatus.map((s) => <span key={s.status} className="row" style={{ gap: 4 }}><StatusBadge status={s.status} /> {s.count}</span>)}</div>
            )}
            <div>
              <h3 style={{ marginBottom: 8 }}>Job postings</h3>
              {data.jobs.length === 0 ? <p className="muted">No job postings yet.</p> : (
                <div className="table-wrap card">
                  <table className="table">
                    <thead><tr><th>Job</th><th>Package</th><th>Vacancies</th><th>Drive date</th><th>Deadline</th><th>Applicants</th></tr></thead>
                    <tbody>
                      {data.jobs.map((j) => (
                        <tr key={j.jobId}>
                          <td><strong>{j.jobTitle}</strong><span className="sub">{j.jobType} · {j.location}</span></td>
                          <td>{lpa(j.salaryLpa)}</td><td className="num">{j.vacancies}</td>
                          <td>{formatDate(j.driveDate)}</td><td>{formatDate(j.applicationDeadline)}</td><td className="num">{j.applicantCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </DataState>
    </Modal>
  );
}

export default function Companies() {
  const { user } = useAuth();
  const isOfficer = user.role === 'OFFICER';
  const { toast, confirm } = useFeedback();
  const { data, loading, error, reload } = useApi('/companies', { initial: [] });
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const uniq = (key) => [...new Set(data.map((c) => c[key]).filter(Boolean))].sort();
  const rows = data.filter((c) => (!industry || c.industry === industry) && (!location || c.location === location));

  const remove = async (c) => {
    if (c.jobCount > 0 || c.placementCount > 0) {
      toast(`${c.companyName} has ${c.jobCount} job posting(s) and cannot be deleted. Remove its jobs first.`, 'error');
      return;
    }
    const ok = await confirm({ title: `Delete ${c.companyName}?`, message: 'This permanently removes the company from the database. This cannot be undone.', confirmLabel: 'Delete company', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/companies/${c.companyId}`);
      toast('Company deleted.');
      reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const columns = [
    { key: 'companyName', label: 'Company', render: (c) => <><strong>{c.companyName}</strong>{c.website && <a className="sub" href={c.website} target="_blank" rel="noopener noreferrer">{c.website.replace(/^https?:\/\//, '')} <ExternalLink size={11} /></a>}</> },
    { key: 'industry', label: 'Industry' },
    { key: 'location', label: 'Location' },
    ...(isOfficer ? [{ key: 'contactPerson', label: 'Contact', render: (c) => <>{c.contactPerson || '—'}<span className="sub">{c.contactEmail}</span><span className="sub">{c.phone}</span></> }] : []),
    { key: 'jobCount', label: 'Jobs', className: 'num', render: (c) => <>{c.jobCount}{c.openJobCount > 0 && <span className="sub">{c.openJobCount} open</span>}</> },
    ...(isOfficer ? [{ key: 'offerCount', label: 'Offers', className: 'num' }] : []),
    { key: 'placementCount', label: 'Placed', className: 'num' },
    {
      key: '_actions', label: '', className: 'actions', render: (c) => (
        <>
          <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setViewing(c.companyId)} aria-label={`View ${c.companyName}`}><Eye size={15} /></button>
          {isOfficer && <>
            <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setEditing(c)} aria-label={`Edit ${c.companyName}`}><Pencil size={14} /></button>
            <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => remove(c)} aria-label={`Delete ${c.companyName}`}><Trash2 size={14} /></button>
          </>}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={isOfficer ? 'Recruiters registered with the placement cell.' : 'Recruiters visiting campus this season.'}
        actions={isOfficer && <button type="button" className="btn btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add company</button>}
      />
      <div className="card">
        <DataState loading={loading && !data.length} error={error} onRetry={reload}>
          <DataTable
            rows={rows}
            rowKey="companyId"
            columns={columns}
            searchKeys={['companyName', 'industry', 'location', 'contactPerson']}
            searchPlaceholder="Search companies…"
            initialSort={{ key: 'companyName', dir: 'asc' }}
            empty={{ icon: Building2, title: 'No companies yet', message: isOfficer ? 'Add the first recruiter to start creating drives.' : 'No recruiters have been added yet.' }}
            filters={(
              <>
                <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry"><option value="">All industries</option>{uniq('industry').map((x) => <option key={x}>{x}</option>)}</select>
                <select className="select" value={location} onChange={(e) => setLocation(e.target.value)} aria-label="Location"><option value="">All locations</option>{uniq('location').map((x) => <option key={x}>{x}</option>)}</select>
              </>
            )}
          />
        </DataState>
      </div>
      {editing && <CompanyForm company={editing.companyId ? editing : null} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {viewing && <CompanyDetail id={viewing} isOfficer={isOfficer} onClose={() => setViewing(null)} />}
    </>
  );
}
