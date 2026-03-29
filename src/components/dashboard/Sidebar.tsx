// Sidebar — menu lateral com navegação, avatar e logout (desktop: lateral, mobile: bottom bar)

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Itens de navegação
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Mostrar na bottom bar mobile (máx 5) */
  mobile: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    mobile: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
      </svg>
    ),
  },
  {
    label: 'Estudar',
    href: '/dashboard/estudar',
    mobile: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    label: 'Baralhos',
    href: '/dashboard/baralhos',
    mobile: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Aulas',
    href: '/dashboard/aulas',
    mobile: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
      </svg>
    ),
  },
  {
    label: 'Materiais',
    href: '/dashboard/materiais',
    mobile: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.66V18.75a2.25 2.25 0 002.25 2.25H18a2.25 2.25 0 002.25-2.25V6.75a48.554 48.554 0 00-3-8.75m0 0V4.5M3 15a48.694 48.694 0 0115.838-.856" />
      </svg>
    ),
  },
  {
    label: 'Praticar',
    href: '/dashboard/praticar',
    mobile: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    label: 'Progresso',
    href: '/dashboard/progresso',
    mobile: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    label: 'Missões',
    href: '/dashboard/missoes',
    mobile: false,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((i) => i.mobile);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [initials, setInitials] = useState('M');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const e = data.user?.email;
      if (e) {
        setEmail(e);
        setInitials(e.slice(0, 2).toUpperCase());
      }
    });
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  // ════════════════════════════════════════════════════════════════════
  // DESKTOP SIDEBAR
  // ════════════════════════════════════════════════════════════════════

  return (
    <>
      {/* ───────── Desktop sidebar ───────── */}
      <aside className="sidebar-enter hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-[240px] border-r border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-[#12122a]/90 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan shadow-lg shadow-primary/25">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent select-none">
            Maestro
          </span>
        </div>

        {/* Separador */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item, i) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  sidebar-item group relative flex items-center gap-3
                  rounded-xl px-3 py-2.5 text-[13px] font-semibold
                  transition-all duration-150 select-none
                  ${
                    active
                      ? 'sidebar-item-active bg-primary/10 dark:bg-primary/15 text-primary dark:text-cyan'
                      : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                  }
                `}
                style={{ '--sidebar-stagger': `${i * 50}ms` } as React.CSSProperties}
              >
                {/* Borda lateral ativa */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-cyan" />
                )}
                <span className={`flex-shrink-0 transition-transform duration-150 ${active ? '' : 'group-hover:translate-x-1'}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Separador */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />

        {/* Footer — user + logout */}
        <div className="px-3 py-4 space-y-2">
          {/* User info */}
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-cyan/80 text-[11px] font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-700 dark:text-white/70">
                {email ?? 'Carregando…'}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-white/30">Estudante</p>
            </div>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="
              flex w-full items-center gap-3 rounded-xl px-3 py-2.5
              text-[13px] font-semibold
              text-gray-400 dark:text-white/35
              hover:text-red-500 dark:hover:text-red-400
              hover:bg-red-50 dark:hover:bg-red-500/10
              transition-all duration-150
            "
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* ───────── Mobile bottom bar ───────── */}
      <nav className="mobile-bar fixed inset-x-0 bottom-0 z-50 flex lg:hidden items-center justify-around border-t border-gray-200/60 dark:border-white/[0.06] bg-white/90 dark:bg-[#12122a]/95 backdrop-blur-xl px-1 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                mobile-bar-item relative flex flex-col items-center gap-0.5
                px-3 py-2 text-[10px] font-semibold
                transition-colors duration-150
                ${
                  active
                    ? 'text-primary dark:text-cyan'
                    : 'text-gray-400 dark:text-white/35'
                }
              `}
            >
              {active && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-gradient-to-r from-primary to-cyan" />
              )}
              <span className={active ? 'scale-110 transition-transform duration-150' : 'transition-transform duration-150'}>
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
