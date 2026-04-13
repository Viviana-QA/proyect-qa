import { useLocation } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { Bell, Search, User } from 'lucide-react';

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Home</span>
      {segments.map((segment, index) => (
        <span key={segment} className="flex items-center gap-2">
          <span className="text-muted-foreground">/</span>
          <span
            className={
              index === segments.length - 1
                ? 'font-medium text-foreground'
                : 'text-muted-foreground'
            }
          >
            {segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Header() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6 shadow-sm">
      <Breadcrumb />

      <div className="flex items-center gap-4">
        <button className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Search className="h-5 w-5" />
        </button>
        <button className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#405189]">
            <User className="h-4 w-4 text-white" />
          </div>
          {user?.email && (
            <span className="text-sm text-muted-foreground">{user.email}</span>
          )}
        </div>
      </div>
    </header>
  );
}
