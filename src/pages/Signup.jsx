import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  {
    value: 'volunteer',
    label: 'Volunteer',
    sub: 'I want to help — match me to active humanitarian needs.',
  },
  {
    value: 'requester',
    label: 'Requester',
    sub: 'I represent a community or NGO submitting needs for support.',
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // chosenRole: only 'volunteer' | 'requester' — never 'admin'
  const [chosenRole, setChosenRole] = useState('volunteer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // currentUser not needed — navigation is now direct after each auth action
  useAuth(); // keep AuthProvider context alive for downstream components

  async function handleSignup() {
    setError(''); setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: fullName });
      // Write Firestore doc with chosen role (merge:true is safe on new docs too)
      await setDoc(doc(db, 'users', cred.user.uid), {
        role: chosenRole,
        email: cred.user.email ?? '',
        displayName: fullName ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Navigate directly — do not wait for AuthContext onSnapshot
      if (chosenRole === 'volunteer') {
        navigate('/volunteer-dash', { replace: true });
      } else {
        navigate('/status', { replace: true });
      }
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const user = cred.user;
      // Check if a Firestore doc already exists for this Google user
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (!docSnap.exists()) {
        // New Google user — no role assigned yet, send to role picker
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email ?? '',
          displayName: user.displayName ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        navigate('/choose-role', { replace: true });
      } else {
        // Existing user — read role and navigate directly
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
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center relative overflow-hidden py-10">
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

        <h1 className="text-3xl font-extrabold text-white mb-1">Join the mission.</h1>
        <p className="text-zinc-500 text-sm mb-8">Create your SmartRelief account.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="mb-4">
          <label className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Full Name</label>
          <input
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[14px] px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Email Address</label>
          <input
            type="email"
            placeholder="you@organisation.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[14px] px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-1.5">Password</label>
          <input
            type="password"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-[rgba(255,255,255,0.08)] rounded-[14px] px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-[#34D399]/50 transition"
          />
        </div>

        {/* Role Selector — Volunteer | Requester only */}
        <p className="block text-zinc-400 text-[11px] font-semibold uppercase tracking-widest mb-3">I am joining as</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {ROLE_OPTIONS.map((opt) => {
            const selected = chosenRole === opt.value;
            return (
              <label
                key={opt.value}
                className={`p-4 rounded-[16px] border cursor-pointer transition relative ${
                  selected
                    ? 'border-[#34D399]/50 bg-[#34D399]/[0.08]'
                    : 'border-[rgba(255,255,255,0.08)] bg-white/[0.03] hover:border-[rgba(255,255,255,0.15)]'
                }`}
              >
                <input
                  type="radio"
                  name="chosenRole"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setChosenRole(opt.value)}
                  className="sr-only"
                />
                {/* Radio dot indicator */}
                <div className={`absolute top-3 right-3 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  selected ? 'border-[#34D399]' : 'border-zinc-600'
                }`}>
                  {selected && <div className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />}
                </div>
                <p className="text-white text-sm font-semibold pr-5">{opt.label}</p>
                <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{opt.sub}</p>
              </label>
            );
          })}
        </div>

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-[#34D399] text-[#09090B] font-bold py-3.5 rounded-full hover:bg-[#10B981] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Creating account...' : 'Create My Account'}
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
          Already have an account?{' '}
          <Link to="/login" className="text-[#34D399] font-semibold hover:underline cursor-pointer">
            Log in
          </Link>
        </p>

        <p className="text-zinc-600 text-xs mt-4 text-center">
          By registering, you agree to SmartRelief&apos;s{' '}
          <span className="text-[#34D399] cursor-pointer hover:underline">Terms of Use</span> and{' '}
          <span className="text-[#34D399] cursor-pointer hover:underline">Privacy Policy</span>.
        </p>
      </GlassCard>
    </div>
  );
}
