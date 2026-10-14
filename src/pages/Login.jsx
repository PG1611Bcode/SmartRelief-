import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../context/AuthContext';
import { redirectByRole } from '../utils/roleRedirect';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, role, roleLoading } = useAuth();

  // Redirect after auth + role resolve
  useEffect(() => {
    if (currentUser && !roleLoading) {
      redirectByRole(role, navigate);
    }
  }, [currentUser, role, roleLoading, navigate]);

  async function handleLogin() {
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // redirect handled by useEffect watching role + roleLoading
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      // Check if a Firestore doc exists for this Google user
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (!docSnap.exists()) {
        // New Google user — no role yet, send to role picker
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email ?? '',
          displayName: user.displayName ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        navigate('/choose-role', { replace: true });
      } else {
        // Existing user — navigate directly by role
        const existingRole = docSnap.data().role;
        if (existingRole === 'volunteer') {
          navigate('/volunteer-dash', { replace: true });
        } else if (existingRole === 'requester') {
          navigate('/status', { replace: true });
        } else if (existingRole === 'admin') {
          navigate('/admin-dash', { replace: true });
        } else {
          navigate('/choose-role', { replace: true });
        }
      }
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center relative overflow-hidden">
      {/* Orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#34D399]/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full bg-zinc-700/20 blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0f1a14]/30 pointer-events-none" />

      {/* Card */}
      <GlassCard className="rounded-[32px] p-10 w-full max-w-md relative z-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-[10px] bg-[#34D399] flex items-center justify-center">
            <span className="text-[#09090B] font-black text-sm">SR</span>
          </div>
          <span className="font-extrabold text-white text-lg tracking-[-0.05em]">SmartRelief</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white mb-1">Welcome back.</h1>
        <p className="text-zinc-500 text-sm mb-8">Sign in to your SmartRelief account.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Email</label>
          <input
            type="email"
            placeholder="you@organisation.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[14px] px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        <div className="mb-4">
          <label className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[14px] px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        <div className="flex justify-end -mt-2 mb-5">
          <a className="text-[#34D399] text-xs hover:underline cursor-pointer">Forgot password?</a>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-[#34D399] text-[#09090B] font-bold py-3.5 rounded-full hover:bg-[#10B981] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Signing in...' : 'Sign In to SmartRelief'}
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-zinc-600 text-xs">or</span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white/5 border border-[rgba(255,255,255,0.08)] text-white py-3 rounded-full hover:bg-white/10 transition text-sm font-medium"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-zinc-500 text-sm text-center mt-6">
          New to SmartRelief?{' '}
          <Link to="/signup" className="text-[#34D399] font-semibold hover:underline cursor-pointer">
            Create an account
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
