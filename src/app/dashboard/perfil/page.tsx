'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface UserInfo {
  email: string;
  id: string;
  nome: string;
  initials: string;
}

const STATS = [
  { key: 'nivel', label: 'Nível', valor: '5', icone: '⚡' },
  { key: 'xp', label: 'XP Total', valor: '1.250', icone: '🏆' },
  { key: 'streak', label: 'Streak', valor: '7 dias', icone: '🔥' },
  { key: 'acerto', label: 'Taxa de acerto', valor: '89%', icone: '🎯' },
];

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        if (!u) return;
        const email = u.email ?? '';
        const nome =
          (u.user_metadata?.full_name as string | undefined) ?? email.split('@')[0];
        setUser({
          email,
          id: u.id,
          nome,
          initials: nome.slice(0, 2).toUpperCase(),
        });
      });
  }, []);

  const handleLogout = useCallback(async () => {
    setSaindo(true);
    await createClient().auth.signOut();
    router.push('/login');
  }, [router]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header de página (desktop) */}
        <div className="hidden lg:flex items-center justify-between mb-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Perfil
          </h1>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            ← Voltar
          </Link>
        </div>

        {/* Avatar + email */}
        <div className="flex flex-col items-center gap-4 py-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e]">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1260CC] to-[#0ABFDE] text-3xl font-extrabold text-white shadow-lg shadow-[#1260CC]/30">
            {user?.initials ?? 'M'}
            {/* Indicador online */}
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-[#1a1a2e] bg-green-400" />
          </div>

          <div className="text-center">
            <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
              {user?.nome ?? 'Carregando...'}
            </p>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-0.5">
              {user?.email ?? ''}
            </p>
            <span className="mt-2 inline-block rounded-full bg-[#1260CC]/10 dark:bg-[#0ABFDE]/10 px-3 py-0.5 text-xs font-semibold text-[#1260CC] dark:text-[#0ABFDE]">
              Estudante
            </span>
          </div>
        </div>

        {/* Stats */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-white/35 mb-3">
            Seu progresso
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s) => (
              <div
                key={s.key}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] p-4 text-center"
              >
                <span className="text-2xl">{s.icone}</span>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white tabular-nums">
                  {s.valor}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-white/45">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-white/35 mb-3">
            Conta
          </h2>

          <button
            type="button"
            onClick={handleLogout}
            disabled={saindo}
            className="
              w-full flex items-center justify-center gap-2 rounded-xl
              border border-red-500/20 bg-red-50 dark:bg-red-500/10
              px-4 py-3 text-sm font-semibold
              text-red-500 dark:text-red-400
              hover:bg-red-100 dark:hover:bg-red-500/20
              disabled:opacity-50 disabled:pointer-events-none
              transition-colors duration-150
            "
          >
            {saindo ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            )}
            {saindo ? 'Saindo...' : 'Sair da conta'}
          </button>
        </div>

      </div>
    </div>
  );
}
