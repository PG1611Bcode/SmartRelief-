import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard, Map, BarChart2, ClipboardList, Zap, Users,
  CheckSquare, Settings, HelpCircle, LogOut, ShieldCheck,
  UserCog, Activity, X,
} from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function AdminSidebar({ mobileOpen, onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const handleNav = (itemPath) => {
    navigate(itemPath);
    if (onClose) onClose();
  };

  const navItems = {
    OVERVIEW: [
      { name: 'Admin Overview', icon: LayoutDashboard, path: '/admin-dash' },
      { name: 'Live Map', icon: Map, path: '/admin-dash/map' },
      { name: 'Insights', icon: BarChart2, path: '/admin-dash/insights' },
    ],
    OPERATIONS: [
      { name: 'Report a Need', icon: ClipboardList, path: '/needs-intake' },
      { name: 'My Requests', icon: Activity, path: '/admin-dash/my-requests' },
      { name: 'Priorities', icon: Zap, path: '/admin-dash/priorities' },
      { name: 'Volunteers', icon: Users, path: '/admin-dash/volunteers' },
      { name: 'Tasks', icon: CheckSquare, path: '/admin-dash/priorities' },
    ],
    'USER MANAGEMENT': [
      { name: 'User Roles', icon: UserCog, path: '/admin-dash' },
    ],
    SYSTEM: [
      { name: 'Settings', icon: Settings, path: '/admin-dash/settings' },
      { name: 'Support', icon: HelpCircle, path: '/admin-dash/support' },
    ],
  };

  const sidebarContent = (
    <div className="w-64 flex-shrink-0 bg-zinc-950/95 border-r border-[rgba(255,255,255,0.06)] h-full flex flex-col p-5">
      <div className="flex items-center justify-between mb-2 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
            <span className="text-[#09090B] font-black text-sm">SR</span>
          </div>
          <span className="font-extrabold text-white tracking-[-0.05em]">SmartRelief</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="px-2 mb-6">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-[#34D399] text-[10px] font-semibold">
          <ShieldCheck size={10} /> Admin Panel
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {Object.entries(navItems).map(([section, items]) => (
          <div key={section}>
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest px-3 mb-2 mt-5">{section}</p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = path === item.path || (item.path !== '/admin-dash' && path.startsWith(item.path));
                return (
                  <button key={item.path} onClick={() => handleNav(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition cursor-pointer ${active ? 'bg-[#34D399]/10 text-[#34D399] font-semibold border border-[#34D399]/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'}`}>
                    <item.icon size={18} />{item.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-5 border-t border-white/6">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[14px] bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#34D399]/40 to-[#34D399]/10 flex items-center justify-center text-[#34D399] text-xs font-bold flex-shrink-0">
            {currentUser?.displayName?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{currentUser?.displayName ?? 'Admin'}</p>
            <p className="text-zinc-500 text-[10px] truncate">{currentUser?.email}</p>
          </div>
          <button onClick={() => signOut(auth).then(() => navigate('/', { replace: true }))} title="Sign Out" className="cursor-pointer">
            <LogOut size={14} className="text-zinc-600 hover:text-zinc-300 transition" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <div className="relative z-10 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
