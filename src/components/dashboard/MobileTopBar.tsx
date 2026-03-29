'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DarkModeToggle from '@/components/ui/DarkModeToggle';

export default function MobileTopBar() {
  const [initials, setInitials] = useState('M');

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const e = data.user?.email;
        if (e) setInitials(e.slice(0, 2).toUpperCase());
      });
  }, []);

  return (
    <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-gray-200/60 dark:border-white/[0.06] bg-white/90 dark:bg-[#12122a]/95 backdrop-blur-xl">
      {/* Brand */}
      <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] bg-clip-text text-transparent select-none">
        Maestro
      </span>

      {/* Ações à direita: toggle escuro/claro + avatar de perfil */}
      <div className="flex items-center gap-2">
        <DarkModeToggle />
        <Link
          href="/dashboard/perfil"
          aria-label="Ir para perfil"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#1260CC]/80 to-[#0ABFDE]/80 text-[11px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
