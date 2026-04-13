import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  FolderKanban,
  TestTube2,
  Play,
  FileBarChart,
  Settings,
  LogOut,
  Bug,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

const navGroups = [
  {
    label: 'MENU',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Projects', href: '/projects', icon: FolderKanban },
    ],
  },
  {
    label: 'TESTING',
    items: [
      { name: 'Test Cases', href: '/test-cases', icon: TestTube2 },
      { name: 'Test Runner', href: '/runner', icon: Play },
      { name: 'Reports', href: '/reports', icon: FileBarChart },
    ],
  },
  {
    label: 'INTEGRATION',
    items: [{ name: 'Jira', href: '/jira', icon: Bug }],
  },
  {
    label: 'CONFIG',
    items: [{ name: 'Settings', href: '/settings', icon: Settings }],
  },
];

export function Sidebar() {
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-full w-64 flex-col bg-[#405189]">
      <div className="flex h-16 items-center gap-2 px-6">
        <TestTube2 className="h-6 w-6 text-white" />
        <span className="text-lg font-bold text-white">QA Platform</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-2">
        {navGroups.map((group) => (
          <div key={group.label}>
            <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {group.label}
            </span>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user?.email && (
          <p className="mb-2 truncate px-3 text-xs text-white/50">
            {user.email}
          </p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
