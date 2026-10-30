import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Eye, EyeOff, GraduationCap, Loader2, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { errorMessage } from '../services/api';
import { homeFor } from '../routes/ProtectedRoute';
import { Alert, Field } from '../components/ui';

export default function Login() {
  const { user, login, checking } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('STUDENT');
  const [form, setForm] = useState({ identifier: '', password: '', remember: false });
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Sign in · Placement Cell'; }, []);

  if (!checking && user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.identifier.trim()) errs.identifier = role === 'STUDENT' ? 'Enter your email or roll number.' : 'Enter your email or employee ID.';
    if (!form.password) errs.password = 'Enter your password.';
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const u = await login({ ...form, identifier: form.identifier.trim(), role });
      const from = location.state?.from;
      const home = homeFor(u);
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setServerError(errorMessage(err, 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-side" aria-hidden="true">
        <div className="row" style={{ gap: 12 }}>
          <div className="brand-mark" style={{ background: '#A47551' }}><GraduationCap size={20} /></div>
          <div>
            <strong style={{ color: '#FFF8EE', fontSize: 16 }}>Training &amp; Placement Cell</strong>
            <div style={{ fontSize: 12, color: '#CDB9A3' }}>College Placement Portal</div>
          </div>
        </div>
        <div>
          <h2>Every drive, application and offer — in one place.</h2>
          <p>The official portal for students and placement officers to manage campus recruitment, from eligibility to final placement.</p>
          <div className="login-feats">
            <div><Briefcase size={18} /><span>Browse drives, check eligibility instantly and apply with your profile resume.</span></div>
            <div><ShieldCheck size={18} /><span>Track every application, interview and offer with a complete audit trail.</span></div>
            <div><BarChart3 size={18} /><span>Live placement statistics and exportable reports for the placement cell.</span></div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#A8927C' }}>© {new Date().getFullYear()} Training &amp; Placement Cell</div>
      </section>

      <main className="login-main">
        <div className="login-card">
          <h1 style={{ fontSize: 26 }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 4 }}>Choose your account type and use your college credentials.</p>

          <div className="role-switch" role="tablist" aria-label="Account type">
            <button type="button" role="tab" aria-selected={role === 'STUDENT'} className={role === 'STUDENT' ? 'on' : ''} onClick={() => { setRole('STUDENT'); setServerError(''); }}>
              <GraduationCap size={16} /> Student
            </button>
            <button type="button" role="tab" aria-selected={role === 'OFFICER'} className={role === 'OFFICER' ? 'on' : ''} onClick={() => { setRole('OFFICER'); setServerError(''); }}>
              <UserCog size={16} /> Placement Officer
            </button>
          </div>

          <form className="stack" onSubmit={submit} noValidate>
            {serverError && <Alert>{serverError}</Alert>}
            <Field label={role === 'STUDENT' ? 'Email or roll number' : 'Email or employee ID'} required error={errors.identifier} htmlFor="identifier">
              <input
                id="identifier" className={`input ${errors.identifier ? 'invalid' : ''}`} autoComplete="username" autoFocus
                placeholder={role === 'STUDENT' ? 'e.g. CE001 or you@college.edu' : 'e.g. PO001 or officer@college.edu'}
                value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              />
            </Field>
            <Field label="Password" required error={errors.password} htmlFor="password">
              <div className="pw-wrap">
                <input
                  id="password" className={`input ${errors.password ? 'invalid' : ''}`} type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            <label className="check small">
              <input type="checkbox" checked={form.remember} onChange={(e) => setForm({ ...form, remember: e.target.checked })} />
              Keep me signed in on this device for 7 days
            </label>
            <button type="submit" className="btn btn-primary" style={{ height: 42 }} disabled={busy}>
              {busy ? <><Loader2 size={16} className="spin" /> Signing in…</> : `Sign in as ${role === 'STUDENT' ? 'student' : 'placement officer'}`}
            </button>
            <p className="small muted" style={{ textAlign: 'center' }}>
              Forgot your password? Contact the Training &amp; Placement Cell office to have it reset.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
