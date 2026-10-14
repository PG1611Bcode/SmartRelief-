import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { useAuth } from '../context/AuthContext';
import { redirectByRole } from '../utils/roleRedirect';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[400px] h-[400px] rounded-full bg-zinc-700/20 blur-[100px] pointer-events-none" />
      <GlassCard className="rounded-[32px] p-12 w-full max-w-md text-center relative z-10">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
          <ShieldOff size={40} className="text-zinc-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-3">Access Restricted</h1>
        <p className="text-zinc-500 text-sm mb-8">
          You don&apos;t have permission to view this page.
        </p>
        <button
          onClick={() => redirectByRole(role, navigate)}
          className="w-full py-3.5 rounded-full bg-[#34D399] text-[#09090B] font-bold text-sm hover:bg-[#10B981] transition cursor-pointer"
        >
          Go to My Dashboard
        </button>
      </GlassCard>
    </div>
  );
}
