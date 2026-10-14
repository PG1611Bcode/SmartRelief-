import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Users, ClipboardList, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import GlassCard from '../components/GlassCard';
import { redirectByRole } from '../utils/roleRedirect';

// Fix A: Admin removed — exactly 2 options: Volunteer and Requester.
// Admin accounts are created exclusively via Firestore or the admin role manager.
const ROLES = [
  {
    value: 'volunteer',
    label: 'Volunteer',
    sub: 'Respond to active humanitarian needs near you.',
    Icon: Users,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    value: 'requester',
    label: 'Requester',
    sub: 'Submit needs on behalf of a community or organisation.',
    Icon: ClipboardList,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
  },
];

export default function ChooseRole() {
  const navigate = useNavigate();
  const { currentUser, role } = useAuth();
  const [selecting, setSelecting] = useState(null); // role string being written, or null

  // Fix B + C: updateDoc only, direct navigate, no refreshRole / redirectByRole
  const handleChoose = async (clickedRole) => {
    if (selecting) return; // already in-flight
    setSelecting(clickedRole);
    try {
      // Fix B: updateDoc — doc already exists (created by Signup or onSnapshot path).
      // Fails loudly if missing rather than silently creating a malformed record.
      const docRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(docRef);
      const payload = {
        role: clickedRole,
        email: currentUser.email ?? '',
        displayName: currentUser.displayName ?? '',
        updatedAt: serverTimestamp()
      };
      if (!docSnap.exists() || !docSnap.data().createdAt) {
        payload.createdAt = serverTimestamp();
      }
      // Symptom 3 fix: is_volunteer is a permanent, append-only flag.
      // Set it to true when user chooses Volunteer; never set it to false on role switch.
      // The { merge: true } below ensures switching to Requester preserves this flag.
      if (clickedRole === 'volunteer') {
        payload.is_volunteer = true;
      }
      await setDoc(docRef, payload, { merge: true });

      // Fix C: Do NOT navigate immediately. We wait for AuthContext's onSnapshot
      // to pick up the new role to avoid router race conditions.
    } catch (err) {
      console.error('[ChooseRole] Failed to update role:', err);
      setSelecting(null);
      if (err.code === 'permission-denied') {
        toast.error('Database access denied. Check Firebase Security Rules.');
      } else {
        toast.error('Could not save your role. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (selecting && role === selecting) {
      // Reset before navigating so the page is clean if the user comes back
      setSelecting(null);
      redirectByRole(role, navigate);
    }
  }, [role, selecting, navigate]);

  // Safety: reset selecting if the component unmounts mid-flight
  useEffect(() => () => { setSelecting(null); }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090B] px-6 relative overflow-hidden">
      {/* Orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-[#34D399]/6 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full bg-zinc-700/20 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center">
          <div className="w-9 h-9 rounded-[11px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
            <span className="text-[#09090B] font-black text-sm">SR</span>
          </div>
          <span className="font-extrabold text-white text-lg tracking-[-0.05em]">SmartRelief</span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-extrabold text-white tracking-[-0.05em] mt-8 mb-2 text-center">
          What&apos;s your role?
        </h1>
        <p className="text-zinc-500 text-sm text-center max-w-sm mx-auto">
          Choose how you&apos;ll use SmartRelief. This can be updated by an admin later.
        </p>

        {/* Role cards — 2 cards only */}
        <div className="grid grid-cols-1 gap-4 w-full mt-8">
          {ROLES.map(({ value, label, sub, Icon, iconBg, iconColor }) => {
            const isSelecting = selecting === value;
            const isDisabled = selecting !== null;
            return (
              <GlassCard
                key={value}
                onClick={() => !isDisabled && handleChoose(value)}
                className={`rounded-[20px] p-5 w-full text-left transition
                  ${isDisabled
                    ? isSelecting
                      ? 'opacity-60 pointer-events-none'
                      : 'opacity-40 pointer-events-none'
                    : 'cursor-pointer hover:border-[#34D399]/30'
                  }`}
              >
                <div className="flex items-center gap-4">
                  {/* Icon / spinner */}
                  <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                    {isSelecting
                      ? <div className="w-5 h-5 rounded-full border-2 border-[#34D399] border-t-transparent animate-spin" />
                      : <Icon size={22} className={iconColor} />
                    }
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{label}</p>
                    <p className="text-zinc-500 text-xs mt-0.5 leading-snug">{sub}</p>
                  </div>
                  {/* Chevron */}
                  <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" />
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Sign out escape */}
        <p className="text-zinc-600 text-sm text-center mt-10">
          Wrong account?{' '}
          <button
            onClick={() => signOut(auth).then(() => navigate('/login'))}
            className="text-[#34D399] hover:underline cursor-pointer"
          >
            Sign out
          </button>
        </p>
      </div>

    </div>
  );
}
