import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { Bell, Search, User, Globe } from 'lucide-react';

function Breadcrumb() {
  const { t } = useTranslation();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t('header.home')}</span>
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

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggle = () => {
    const newLang = currentLang === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title={currentLang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
    >
      <Globe className="h-4 w-4" />
      <span className="uppercase">{currentLang}</span>
    </button>
  );
}

export function Header() {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex h-16 items-center justify-between border-b border-purple-100 bg-white px-6 shadow-sm">
      <Breadcrumb />

      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <button className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Search className="h-5 w-5" />
        </button>
        <button className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed]">
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
