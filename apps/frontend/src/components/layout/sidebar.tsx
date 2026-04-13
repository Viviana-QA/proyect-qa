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

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Test Cases', href: '/test-cases', icon: TestTube2 },
  { name: 'Test Runner', href: '/runner', icon: Play },
  { name: 'Reports', href: '/reports', icon: FileBarChart },
  { name: 'Jira', href: '/jira', icon: Bug },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <TestTube2 className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">QA Platform</span>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
