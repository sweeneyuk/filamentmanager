import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database } from 'lucide-react';

function Login() {
  const { login, setup, setupRequired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLocal, setShowLocal] = useState(false);

  useEffect(() => {
    // Check if error passed from OIDC redirect or local override
    const urlParams = new URLSearchParams(window.location.search);
    const urlError = urlParams.get('error');
    if (urlError) {
      setError(urlError);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('local') === 'true') {
      setShowLocal(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let success = false;
      if (setupRequired) {
        success = await setup(username, password);
      } else {
        success = await login(username, password);
      }
      
      if (!success) {
        setError(setupRequired ? 'Setup failed. Try again.' : 'Invalid username or password.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOidcLogin = async () => {
    try {
      const res = await fetch('/api/auth/oidc/login');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'SSO Login Failed');
      }
    } catch (err) {
      setError('SSO Login Failed');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh',
      backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', fontFamily: 'var(--font-family)'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', padding: '40px',
        backgroundColor: 'var(--card-bg)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Database size={48} color="var(--primary-color)" />
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Filament Manager</h1>
          <p style={{ color: '#888', margin: 0 }}>
            {setupRequired ? 'Create your initial Admin account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px', backgroundColor: 'rgba(255,50,50,0.1)', color: '#ff5555', borderRadius: '4px', textAlign: 'center', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {(!ssoConfigured || setupRequired || showLocal) && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '0.85rem', color: '#ccc' }}>Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
                autoFocus
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '0.85rem', color: '#ccc' }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff' }}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                padding: '12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--primary-color)', 
                color: '#000', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px' 
              }}
            >
              {loading ? 'Please wait...' : (setupRequired ? 'Complete Setup' : 'Login')}
            </button>
          </form>
        )}

        {!setupRequired && (
          <>
            {!ssoConfigured && (
              <div style={{ display: 'flex', alignItems: 'center', margin: '10px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
                <span style={{ margin: '0 10px', color: '#666', fontSize: '0.85rem' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#333' }}></div>
              </div>
            )}
            
            <button 
              onClick={handleOidcLogin}
              type="button"
              style={{ 
                padding: '12px', borderRadius: '4px', border: '1px solid #333', backgroundColor: ssoConfigured ? 'var(--primary-color)' : '#1a1a1a', 
                color: ssoConfigured ? '#000' : '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                marginTop: ssoConfigured ? '10px' : '0'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M8 11l3 3 5-5"></path>
              </svg>
              Login with Authentik (SSO)
            </button>
            
            {ssoConfigured && (
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button 
                  type="button"
                  onClick={() => window.location.href = '?local=true'}
                  style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Admin Local Login
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Login;
