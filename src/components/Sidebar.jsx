import { useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Map,
  BarChart2,
  ClipboardList,
  Zap,
  Users,
  CheckSquare,
  Settings,
  HelpCircle,
  LogOut,
  UserPlus,
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const navItems = {
    OVERVIEW: [
      { name: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
      { name: 'Live Map', icon: Map, path: '/dashboard/map' },
      { name: 'Insights', icon: BarChart2, path: '/dashboard/insights' },
    ],
    OPERATIONS: [
      { name: 'Report a Need', icon: ClipboardList, path: '/dashboard/needs-intake' },
      { name: 'Register Volunteer', icon: UserPlus, path: '/dashboard/volunteer-intake' },
      { name: 'Priorities', icon: Zap, path: '/dashboard/priorities' },
      { name: 'Volunteers', icon: Users, path: '/dashboard/volunteers' },
      { name: 'Tasks', icon: CheckSquare, path: '/dashboard/tasks' },
    ],
    SYSTEM: [
      { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
      { name: 'Support', icon: HelpCircle, path: '/dashboard/support' },
    ],
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="w-64 flex-shrink-0 bg-zinc-950/80 border-r border-[rgba(255,255,255,0.06)] h-full flex flex-col p-5">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-[10px] bg-[#34D399] flex items-center justify-center flex-shrink-0">
          <span className="text-[#09090B] font-black text-sm">SR</span>
        </div>
        <span className="font-extrabold text-white tracking-[-0.05em]">SmartRelief</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(navItems).map(([section, items]) => (
          <div key={section}>
            <p className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest px-3 mb-2 mt-5">
              {section}
            </p>
            <div className="space-y-1">
              {items.map((item) => {
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-sm font-medium transition cursor-pointer ${
                      active
                        ? 'bg-[#34D399]/10 text-[#34D399] font-semibold border border-[#34D399]/20'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <item.icon size={18} />
                    {item.name}
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
            {currentUser?.displayName?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">
              {currentUser?.displayName ?? 'User'}
            </p>
            <p className="text-zinc-500 text-[10px] truncate">{currentUser?.email}</p>
          </div>
          <button
            onClick={() => signOut(auth).then(() => navigate('/', { replace: true }))}
          >
            <LogOut size={14} className="text-zinc-600 hover:text-zinc-300 transition" />
          </button>
        </div>
      </div>
    </div>
  );
}
