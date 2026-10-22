import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { apiRequest } from './api.js';
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

export default function AuthPortal({ user, onLibraryReady }) {
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
      if (!user || !db) return;
      setLoading(true);
      try {
        const profile = await getDoc(doc(db, 'users', user.uid));
        const ids = profile.exists() && Array.isArray(profile.data().libraryIds)
          ? profile.data().libraryIds
          : [];
        const results = await Promise.all(ids.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, 'libraries', id));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
          } catch {
            return null;
          }
        }));
        const available = results.filter(Boolean);
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
    if (!isFirebaseConfigured || !auth) {
      setError('Firebase is not configured yet. Add the Firebase web app values to .env.local and redeploy.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage('Password reset email sent. Check your inbox.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use'
        ? 'An account already uses this email. Try signing in.'
        : err.code === 'auth/invalid-credential'
          ? 'Email or password is incorrect.'
          : err.code === 'auth/weak-password'
            ? 'Choose a stronger password with at least 8 characters.'
            : err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const createLibrary = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const result = await apiRequest('/api/library', { action: 'createLibrary',
        name: libraryName.trim(),
        type: libraryType,
        location: location.trim(),
      });
      const libraryId = result.libraryId;
      const snap = await getDoc(doc(db, 'libraries', libraryId));
      if (!snap.exists()) throw new Error('The library was created but could not be loaded. Refresh and try again.');
      onLibraryReady({ id: snap.id, ...snap.data() });
    } catch (err) {
      setError(err.status === 401
        ? 'Your session expired. Sign in again.'
        : err.message || 'Could not create your library. Check the Vercel server configuration.');
    } finally {
      setLoading(false);
    }
  };

  if (!isFirebaseConfigured) {
    return <div className="auth-shell"><section className="auth-card auth-setup">
      <div className="auth-brand"><span className="auth-logo">M</span><span>mctaba<span className="auth-period">.</span></span></div>
      <div className="auth-icon">⚙</div>
      <p className="auth-eyebrow">ONE-TIME SETUP</p>
      <h1>Connect your Firebase project</h1>
      <p className="auth-description">Mctaba is ready for Firebase Authentication and Cloud Firestore. Add your Firebase web app configuration to enable library registration and sign-in.</p>
      <ol className="auth-steps">
        <li>Create a project in the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Firebase Console</a>.</li>
        <li>Register a Web app and enable <strong>Email/Password</strong> under Authentication.</li>
        <li>Create a Cloud Firestore database and copy the web app values into <code>.env.local</code>.</li>
        <li>Deploy the Firestore rules and Cloud Functions using the README instructions.</li>
      </ol>
      <div className="auth-note">Do not put service-account keys or private secrets in frontend environment variables.</div>
    </section></div>;
  }

  if (user) {
    return <div className="auth-shell"><section className="auth-card">
      <div className="auth-brand"><span className="auth-logo">M</span><span>mctaba<span className="auth-period">.</span></span></div>
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
        <label>Library name<input required maxLength={120} value={libraryName} onChange={(e) => setLibraryName(e.target.value)} placeholder="e.g. Greenwood Academy Library" /></label>
        <label>Library type<select value={libraryType} onChange={(e) => setLibraryType(e.target.value)}>{libraryTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Town / location <span className="auth-optional">OPTIONAL</span><input maxLength={160} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi, Kenya" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="auth-submit" disabled={loading} type="submit">{loading ? 'Creating workspace…' : 'Register library'} <span>→</span></button>
      </form>
      <button className="auth-text-button" onClick={() => signOut(auth)}>Sign out</button>
    </section></div>;
  }

  return <div className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><span className="auth-logo">M</span><span>mctaba<span className="auth-period">.</span></span></div>
    <p className="auth-eyebrow">{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : mode === 'reset' ? 'ACCOUNT RECOVERY' : 'LIBRARY MANAGEMENT, SIMPLIFIED'}</p>
    <h1>{mode === 'signup' ? 'Your library starts here.' : mode === 'reset' ? 'Reset your password.' : 'Welcome back.'}</h1>
    <p className="auth-description">{mode === 'signup' ? 'Create an administrator account, then register your library.' : mode === 'reset' ? 'We will email you a secure password reset link.' : 'Sign in to open your library workspace.'}</p>
    <form className="auth-form" onSubmit={submitAuth}>
      {mode === 'signup' && <label>Full name<input required autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" /></label>}
      <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      {mode !== 'reset' && <label>Password<input required type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      {message && <div className="auth-success" role="status">{message}</div>}
      <button className="auth-submit" disabled={loading} type="submit">{loading ? 'Please wait…' : mode === 'signup' ? 'Create administrator account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} <span>→</span></button>
    </form>
    <div className="auth-links">
      {mode === 'signin' && <button onClick={() => { setMode('reset'); setError(''); setMessage(''); }}>Forgot password?</button>}
      {mode === 'reset' && <button onClick={() => { setMode('signin'); setError(''); setMessage(''); }}>Back to sign in</button>}
      {mode !== 'reset' && <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>{mode === 'signin' ? 'New to Mctaba? Create an account' : 'Already registered? Sign in'}</button>}
    </div>
    <p className="auth-footnote">Your library data is separated by workspace and protected by role-based access rules.</p>
  </section></div>;
}
