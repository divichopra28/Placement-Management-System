import { Download, FileText } from 'lucide-react';
import { formatDate, formatDateTime, lpa } from '../utils/format';
import { Badge, StatusBadge } from './ui';

export function resumeUrl(studentId) {
  return `/api/students/${studentId}/resume`;
}

/** Read-only profile summary shared by the student profile page and the officer's student view. */
export default function StudentProfileView({ profile, selfView }) {
  const p = profile;
  return (
    <div className="stack">
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Personal details</h2></div>
          <div className="card-body">
            <dl className="dl">
              <dt>Name</dt><dd>{p.name}</dd>
              <dt>Email</dt><dd>{p.email}</dd>
              <dt>Phone</dt><dd>{p.phone || <span className="muted">Not provided</span>}</dd>
              <dt>Address</dt><dd>{p.address || <span className="muted">Not provided</span>}</dd>
              <dt>Gender</dt><dd>{p.gender || '—'}</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Academic details</h2></div>
          <div className="card-body">
            <dl className="dl">
              <dt>Roll number</dt><dd>{p.rollNo}</dd>
              <dt>Department</dt><dd>{p.deptName}</dd>
              <dt>CGPA</dt><dd className="num">{p.cgpa ?? <span className="muted">Not recorded</span>}</dd>
              <dt>Graduation batch</dt><dd>{p.batchYear ?? '—'}</dd>
              <dt>Resume</dt>
              <dd>
                {p.resume ? (
                  <a className="row" href={resumeUrl(selfView ? 'me' : p.studentId)} style={{ gap: 6 }}>
                    <FileText size={15} /> {p.resume.originalName} <Download size={14} />
                    <span className="small muted">({formatDate(p.resume.uploadedOn)})</span>
                  </a>
                ) : <span className="muted">Not uploaded</span>}
              </dd>
            </dl>
          </div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 0 }}>
        <div className="card stat"><div><div className="stat-label">Applications</div><div className="stat-value">{p.counts.applications}</div></div></div>
        <div className="card stat"><div><div className="stat-label">Interviews</div><div className="stat-value">{p.counts.interviews}</div></div></div>
        <div className="card stat"><div><div className="stat-label">Offer status</div><div className="stat-value" style={{ fontSize: 18 }}>{p.offerStatus}</div></div></div>
        <div className="card stat">
          <div>
            <div className="stat-label">Placement status</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{p.placedCompany ? 'Placed' : 'Not placed'}</div>
            {p.placedCompany && <div className="stat-hint">{p.placedCompany} · {lpa(p.packageLpa)}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>Skills &amp; certifications</h2></div>
          {p.skillList.length === 0 ? <div className="card-body muted">No skills added yet.</div> : (
            <ul className="list">
              {p.skillList.map((s) => (
                <li key={s.skillId}>
                  <div className="grow">
                    <div className="title">{s.skillName}</div>
                    <div className="small muted">{s.category}{s.certification ? ` · ${s.certification}` : ''}</div>
                  </div>
                  <Badge tone="neutral">{s.proficiencyLevel || '—'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Latest placement activity</h2></div>
          {p.activity.length === 0 ? <div className="card-body muted">No activity yet.</div> : (
            <ul className="list">
              {p.activity.map((a, i) => (
                <li key={i}>
                  <div className="grow">
                    <div className="title">{a.jobTitle} · {a.companyName}</div>
                    <div className="small muted">{formatDateTime(a.at)}</div>
                  </div>
                  {a.kind === 'APPLIED' ? <span className="small muted">Applied</span> : <><StatusBadge status={a.oldStatus} /> → </>}
                  <StatusBadge status={a.newStatus} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
