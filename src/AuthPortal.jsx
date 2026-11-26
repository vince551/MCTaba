import { useEffect, useState } from 'react';
import { apiRequest, normalizeUser, signIn, signInWithGoogle, signOut, signUp } from './api.js';
import './auth.css';

const libraryTypes = [
  ['school', 'School library'],
  ['university', 'University library'],
  ['public', 'Public library'],
  ['community', 'Community library'],
  ['church', 'Church library'],
  ['private', 'Private library'],
  ['other', 'Other'],
];

export default function AuthPortal({ user, onAuthReady, onLibraryReady }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [libraryType, setLibraryType] = useState('school');
  const [location, setLocation] = useState('');
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadLibraries() {
      if (!user) return;
      setLoading(true);
      try {
        const result = await apiRequest('/libraries');
        const available = (result.libraries || []).map((library) => ({
          ...library,
          id: String(library.id),
          type: library.library_type,
          location: library.location || '',
        }));
        if (!cancelled) {
          setLibraries(available);
          if (available.length === 1) onLibraryReady(available[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your library workspaces.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadLibraries();
    return () => { cancelled = true; };
  }, [user, onLibraryReady]);

  const submitAuth = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        setMessage('Password recovery is not enabled yet. Contact the Mctaba administrator for help.');
        return;
      }
      const account = mode === 'signup'
        ? await signUp(name.trim(), email.trim(), password)
        : await signIn(email.trim(), password);
      onAuthReady(normalizeUser(account));
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Google sign-in could not be started.');
      setLoading(false);
    }
  };

  const createLibrary = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await apiRequest('/libraries', {
        method: 'POST',
        body: { name: libraryName.trim(), library_type: libraryType, location: location.trim() || null },
      });
      const library = { ...result.library, id: String(result.library.id), type: result.library.library_type, location: result.library.location || '' };
      onLibraryReady(library);
    } catch (err) {
      setError(err.status === 401
        ? 'Your session expired. Please sign in again.'
        : err.message || 'Could not create your library.');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return <div className="auth-shell"><section className="auth-card">
      <div className="auth-brand"><img className="auth-logo-image" src="/icons/mctaba-logo.jpg" alt="Mctaba logo" /><span>mctaba<span className="auth-period">.</span></span></div>
      {libraries.length > 0 ? <>
        <p className="auth-eyebrow">YOUR WORKSPACES</p><h1>Welcome back{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}.</h1>
        <p className="auth-description">Choose a library to open, or register another library under your account.</p>
        <div className="library-choice-list">{libraries.map((library) => <button key={library.id} className="library-choice" onClick={() => onLibraryReady(library)}><span className="library-choice-icon">▤</span><span><strong>{library.name}</strong><small>{library.location || libraryTypes.find(([value]) => value === library.type)?.[1] || 'Library workspace'}</small></span><span className="library-choice-arrow">→</span></button>)}</div>
        <div className="auth-divider"><span>REGISTER A NEW LIBRARY</span></div>
      </> : <>
        <p className="auth-eyebrow">LIBRARY ONBOARDING</p><h1>Set up your library.</h1>
        <p className="auth-description">Create your library workspace. Your account will become its first owner.</p>
      </>}
      <form className="auth-form" onSubmit={createLibrary}>
        <label>Library name<input required maxLength={160} value={libraryName} onChange={(e) => setLibraryName(e.target.value)} placeholder="e.g. Greenwood Academy Library" /></label>
        <label>Library type<select value={libraryType} onChange={(e) => setLibraryType(e.target.value)}>{libraryTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Town / location <span className="auth-optional">OPTIONAL</span><input maxLength={160} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi, Kenya" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-note" role="status">{message}</div>}
        <button className="auth-submit" disabled={loading} type="submit">{loading ? 'Creating workspace…' : 'Register library'} <span>→</span></button>
      </form>
      <button className="auth-text-button" onClick={async () => { try { await signOut(); } finally { onAuthReady(null); } }}>Sign out</button>
    </section></div>;
  }

  return <div className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><img className="auth-logo-image" src="/icons/mctaba-logo.jpg" alt="Mctaba logo" /><span>mctaba<span className="auth-period">.</span></span></div>
    <p className="auth-eyebrow">{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : mode === 'reset' ? 'ACCOUNT RECOVERY' : 'LIBRARY MANAGEMENT, SIMPLIFIED'}</p>
    <h1>{mode === 'signup' ? 'Your library starts here.' : mode === 'reset' ? 'Reset your password.' : 'Welcome back.'}</h1>
    <p className="auth-description">{mode === 'signup' ? 'Create your Mctaba account and register a library workspace.' : mode === 'reset' ? 'Password recovery is not enabled yet.' : 'Sign in to manage your library workspace.'}</p>
    <form className="auth-form" onSubmit={submitAuth}>
      {mode === 'signup' && <label>Full name<input required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name"/></label>}
      <label>Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"/></label>
      {mode !== 'reset' && <label>Password<input required type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 10 characters' : 'Your password'}/></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <div className="auth-note" role="status">{message}</div>}
      <button className="auth-submit" disabled={loading} type="submit">{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Request password reset' : 'Sign in'} <span>→</span></button>
    </form>
    {mode !== 'reset' && <>
      <div className="auth-divider"><span>OR CONTINUE WITH</span></div>
      <button className="auth-google-button" type="button" disabled={loading} onClick={handleGoogleSignIn}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.02 13.22l7.98 6.19C12.9 13.72 18.02 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.8 46.98 31.73 46.98 24.55z"/><path fill="#FBBC05" d="M10.99 28.59A14.4 14.4 0 0 1 10.22 24c0-1.6.28-3.14.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.58 10.78l8.41-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-5.98 0-11.1-4.22-12.99-9.91l-8.41 6.19C6.09 42.62 14.2 48 24 48z"/></svg>
        Continue with Google
      </button>
    </>}
    <div className="auth-switch-row">
      {mode === 'signin' ? <><button className="auth-text-button" onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>Forgot password?</button><button className="auth-text-button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }}>Create account</button></> : <button className="auth-text-button" onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Back to sign in</button>}
    </div>
    <div className="auth-note">Secure sign-in is powered by Supabase. Your library workspace is managed by Mctaba.</div>
  </section></div>;
}
