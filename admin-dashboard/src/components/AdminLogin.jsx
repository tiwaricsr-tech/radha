import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { apiRequest, setAdminSession, navigateToStorefront } from '../api';

function GoogleGIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'radial-gradient(circle at 50% 0%, #fff1e6 0%, #ffffff 58%)',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  card: {
    width: '100%',
    maxWidth: 'none',
    background: 'transparent',
    borderRadius: 0,
    border: 'none',
    boxShadow: 'none',
    padding: 0
  },
  brandWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 22
  },
  logoBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #FF5200 0%, #FF7A00 100%)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 26,
    boxShadow: '0 10px 24px rgba(255, 82, 0, 0.28)',
    marginBottom: 12
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: '-0.4px',
    margin: 0
  },
  brandSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 1.45
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: 4,
    borderRadius: 12,
    marginBottom: 20
  },
  tab: (active) => ({
    border: 'none',
    background: active ? '#ffffff' : 'transparent',
    color: active ? '#FF5200' : '#64748b',
    fontWeight: 800,
    fontSize: 13.5,
    padding: '10px 12px',
    borderRadius: 9,
    cursor: 'pointer',
    boxShadow: active ? '0 2px 8px rgba(15, 23, 42, 0.07)' : 'none',
    fontFamily: 'inherit',
    transition: 'all 0.15s'
  }),
  fieldGroup: {
    marginBottom: 13
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 6
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  iconLeft: {
    position: 'absolute',
    left: 13,
    color: '#94a3b8',
    pointerEvents: 'none'
  },
  input: {
    width: '100%',
    padding: '12px 40px 12px 40px',
    borderRadius: 12,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#0f172a',
    background: '#ffffff',
    fontFamily: 'inherit',
    outline: 'none'
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    border: 'none',
    background: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    padding: 0
  },
  submitBtn: {
    width: '100%',
    marginTop: 6,
    padding: '13px 18px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #FF5200 0%, #FF6D00 100%)',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: 14.5,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 12px 24px rgba(255, 82, 0, 0.25)'
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '10px 13px',
    borderRadius: 11,
    fontSize: 12.5,
    fontWeight: 600,
    marginBottom: 14
  },
  footNote: {
    marginTop: 18,
    paddingTop: 15,
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 12,
    color: '#64748b',
    fontWeight: 600
  }
};

export default function AdminLogin({ onLoginSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/auth/config')
      .then((cfg) => setGoogleClientId((cfg.googleClientId || '').trim()))
      .catch(() => {});
  }, []);

  const finishAuth = (res) => {
    setAdminSession(res.token, res.user);
    // Auto-route by role: Admins enter Admin Console; Customers auto-route to Storefront
    if (res.user?.role !== 'admin') {
      navigateToStorefront(res.token, false);
      return;
    }
    onLoginSuccess(res.user);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? { name, email, phone, password }
          : { identifier, password };

      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      finishAuth(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!window.google?.accounts?.oauth2 || !googleClientId) return;
    setError('');
    setLoading(true);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: async (tokenResponse) => {
        if (tokenResponse?.error) {
          setError(tokenResponse.error_description || tokenResponse.error);
          setLoading(false);
          return;
        }
        try {
          const res = await apiRequest('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ accessToken: tokenResponse.access_token })
          });
          finishAuth(res);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
      error_callback: () => setLoading(false)
    });
    tokenClient.requestAccessToken({ prompt: 'select_account' });
  };

  return (
    <div className="login-page">
      <div className="login-split-shell">
        <aside className="login-hero-panel">
          <div className="login-brand-lockup">
            <img className="login-brand-mark" src="/radha-swami-logo.jpg" alt="" />
            <span>Radha Swami</span>
          </div>
          <div className="hero-pill-tag">SECURE ACCOUNT ACCESS</div>
          <h1>Your account,<br /><span>beautifully simple.</span></h1>
          <p>One sign-in connects you to the Radha Swami storefront and admin console.</p>
          <div className="hero-feature-stack">
            <div className="hero-feat-row"><ShieldCheck size={18} /> Secure email or mobile sign-in</div>
            <div className="hero-feat-row"><User size={18} /> One account for customers and admins</div>
            <div className="hero-feat-row"><ArrowRight size={18} /> Fast access to your Radha Swami portal</div>
          </div>
          <p className="login-hero-footer">© {new Date().getFullYear()} Radha Swami</p>
        </aside>

        <section className="login-form-panel">
          <div style={s.card}>
            <div className="login-form-heading">
              <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
              <p>{mode === 'signin' ? 'Sign in to continue to your account.' : 'Enter your details to get started.'}</p>
            </div>

            <div style={s.tabs}>
          <button
            type="button"
            style={s.tab(mode === 'signin')}
            onClick={() => {
              setMode('signin');
              setError('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            style={s.tab(mode === 'signup')}
            onClick={() => {
              setMode('signup');
              setError('');
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Full Name</label>
              <div style={s.inputWrap}>
                <User size={17} style={s.iconLeft} />
                <input
                  style={s.input}
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div style={s.fieldGroup}>
            <label style={s.label}>
              {mode === 'signup' ? 'Email Address' : 'Email or Mobile Number'}
            </label>
            <div style={s.inputWrap}>
              <Mail size={17} style={s.iconLeft} />
              <input
                style={s.input}
                type={mode === 'signup' ? 'email' : 'text'}
                placeholder={mode === 'signup' ? 'you@example.com' : 'Enter email or mobile number'}
                value={mode === 'signup' ? email : identifier}
                onChange={(e) => {
                  if (mode === 'signup') setEmail(e.target.value);
                  else setIdentifier(e.target.value);
                }}
                autoComplete={mode === 'signup' ? 'email' : 'username'}
                required
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div style={s.fieldGroup}>
              <label style={s.label}>Mobile Number</label>
              <div style={s.inputWrap}>
                <Phone size={17} style={s.iconLeft} />
                <input
                  style={s.input}
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div style={s.fieldGroup}>
            <label style={s.label}>Password</label>
            <div style={s.inputWrap}>
              <Lock size={17} style={s.iconLeft} />
              <input
                style={s.input}
                type={showPass ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                style={s.eyeBtn}
                onClick={() => setShowPass((v) => !v)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" style={s.submitBtn} disabled={loading}>
            <span>
              {loading
                ? 'Signing in...'
                : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
            </span>
            <ArrowRight size={17} />
          </button>
        </form>

        {googleClientId && (
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '11px 16px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10
            }}
          >
            <GoogleGIcon size={18} />
            <span>Continue with Google</span>
          </button>
        )}

        <div style={s.footNote}>
          <ShieldCheck size={15} color="#FF5200" />
          <span>Unified Single Sign-On • Customer &amp; Admin</span>
        </div>
          </div>
        </section>
      </div>
    </div>
  );
}
