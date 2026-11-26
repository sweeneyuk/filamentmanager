import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Field from '../../ui/Field';
import Button from '../../ui/Button';
import './auth.css';

export default function Login() {
  const { login, setup, setupRequired, ssoConfigured } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLocal, setShowLocal] = useState(false);

  useEffect(() => {
    // Error passed back from the OIDC redirect, or a request for the local form.
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get('error');
    if (urlError) {
      setError(urlError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (params.get('local') === 'true') setShowLocal(true);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = setupRequired ? await setup(username, password) : await login(username, password);
      if (!ok) setError(setupRequired ? 'Setup failed. Try again.' : 'Invalid username or password.');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const oidcLogin = async () => {
    try {
      const res = await fetch('/api/auth/oidc/login');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || 'SSO Login Failed');
    } catch {
      setError('SSO Login Failed');
    }
  };

  const showForm = !ssoConfigured || setupRequired || showLocal;

  return (
    <div className="au-page">
      <div className="au-card">
        <div className="au-brand">
          <span className="au-logo" aria-hidden="true" />
          <h1>Filament Manager</h1>
          <p className="ui-muted">{setupRequired ? 'Create your initial admin account' : 'Sign in to access your dashboard'}</p>
        </div>
        {error && <div className="au-error" role="alert">{error}</div>}
        {showForm && (
          <form className="au-form" onSubmit={submit}>
            <Field label="Username">
              <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </Field>
            <Field label="Password">
              <input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button variant="primary" type="submit" busy={loading}>
              {loading ? 'Please wait…' : setupRequired ? 'Complete setup' : 'Login'}
            </Button>
          </form>
        )}
        {!setupRequired && (
          <>
            {!ssoConfigured && <div className="au-or"><span>or</span></div>}
            <Button variant={ssoConfigured ? 'primary' : 'outline'} icon={ShieldCheck} onClick={oidcLogin}>Login with Authentik (SSO)</Button>
            {ssoConfigured && !showLocal && (
              <Button variant="ghost" onClick={() => { window.location.href = '?local=true'; }}>Admin local login</Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
