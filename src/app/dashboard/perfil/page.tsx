'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface ProfileStats {
  nivel: number;
  xpTotal: number;
  streakAtual: number;
  taxaAcerto: number;
}

interface UserInfo {
  email: string;
  id: string;
  nome: string;
  initials: string;
}

interface TokenStatus {
  total: number;
  tokens: string[];
  permissao: NotificationPermission | 'unsupported';
}

const DEFAULT_STATS: ProfileStats = {
  nivel: 1,
  xpTotal: 0,
  streakAtual: 0,
  taxaAcerto: 0,
};

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats>(DEFAULT_STATS);
  const [carregandoStats, setCarregandoStats] = useState(true);
  const [saindo, setSaindo] = useState(false);

  // Notificações
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [registroMsg, setRegistroMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function carregarDadosPerfil() {
      const supabase = createClient();

      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u || cancelado) return;

      const email = u.email ?? '';
      const nome =
        (u.user_metadata?.full_name as string | undefined) ?? email.split('@')[0];

      setUser({
        email,
        id: u.id,
        nome,
        initials: nome.slice(0, 2).toUpperCase(),
      });

      try {
        const res = await fetch('/api/progresso');
        const payload = await res.json();
        if (!res.ok || cancelado) return;

        setStats({
          nivel: typeof payload.nivelAtual === 'number' ? payload.nivelAtual : 1,
          xpTotal: typeof payload.xpTotal === 'number' ? payload.xpTotal : 0,
          streakAtual: typeof payload.streakAtual === 'number' ? payload.streakAtual : 0,
          taxaAcerto: typeof payload.taxaAcerto === 'number' ? payload.taxaAcerto : 0,
        });
      } catch {
        if (!cancelado) setStats(DEFAULT_STATS);
      } finally {
        if (!cancelado) setCarregandoStats(false);
      }
    }

    async function carregarTokens() {
      try {
        const permissao = typeof Notification !== 'undefined'
          ? Notification.permission
          : 'unsupported' as const;
        const res = await fetch('/api/notificacoes/token');
        if (!res.ok || cancelado) return;
        const data = await res.json();
        if (!cancelado) {
          setTokenStatus({ total: data.total, tokens: data.tokens, permissao });
        }
      } catch {
        // silencioso
      }
    }

    carregarDadosPerfil();
    carregarTokens();

    return () => {
      cancelado = true;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    setSaindo(true);
    await createClient().auth.signOut();
    router.push('/login');
  }, [router]);

  const handleRegistrarNotificacoes = useCallback(async () => {
    setRegistrando(true);
    setRegistroMsg(null);
    try {
      const { solicitarPermissao } = await import('@/lib/notifications');
      const token = await solicitarPermissao();
      if (token) {
        // Limpar cache diário pra garantir que o NotificacoesInit não pule
        localStorage.removeItem('maestro_fcm_ts');
        // Recarregar status
        const res = await fetch('/api/notificacoes/token');
        if (res.ok) {
          const data = await res.json();
          setTokenStatus({
            total: data.total,
            tokens: data.tokens,
            permissao: Notification.permission,
          });
        }
        setRegistroMsg(`Registrado com sucesso! (${token.slice(0, 20)}...)`);
      } else {
        setRegistroMsg('Não foi possível obter o token.');
      }
    } catch (err) {
      setRegistroMsg(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRegistrando(false);
    }
  }, []);

  const statsCards = [
    {
      key: 'nivel',
      label: 'Nível',
      valor: carregandoStats ? '...' : String(stats.nivel),
      icone: '⚡',
    },
    {
      key: 'xp',
      label: 'XP Total',
      valor: carregandoStats ? '...' : stats.xpTotal.toLocaleString('pt-BR'),
      icone: '🏆',
    },
    {
      key: 'streak',
      label: 'Streak',
      valor: carregandoStats
        ? '...'
        : `${stats.streakAtual} ${stats.streakAtual === 1 ? 'dia' : 'dias'}`,
      icone: '🔥',
    },
    {
      key: 'acerto',
      label: 'Taxa de acerto',
      valor: carregandoStats ? '...' : `${stats.taxaAcerto}%`,
      icone: '🎯',
    },
  ];

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
            {statsCards.map((s) => (
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

        {/* Notificações */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-white/35 mb-3">
            Notificações
          </h2>

          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a2e] p-4 space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <span className="text-sm font-medium text-gray-700 dark:text-white/80">
                  Dispositivos registrados
                </span>
              </div>
              <span className={`
                text-sm font-bold tabular-nums px-2 py-0.5 rounded-full
                ${tokenStatus && tokenStatus.total > 0
                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-100 dark:bg-red-500/10 text-red-500 dark:text-red-400'}
              `}>
                {tokenStatus === null ? '...' : tokenStatus.total}
              </span>
            </div>

            {/* Permissão */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-white/45">Permissão</span>
              <span className={`text-xs font-semibold ${
                tokenStatus?.permissao === 'granted'
                  ? 'text-green-600 dark:text-green-400'
                  : tokenStatus?.permissao === 'denied'
                  ? 'text-red-500'
                  : 'text-yellow-500'
              }`}>
                {tokenStatus?.permissao === 'granted' ? '✓ Concedida'
                  : tokenStatus?.permissao === 'denied' ? '✗ Negada'
                  : tokenStatus?.permissao === 'default' ? '⏳ Pendente'
                  : tokenStatus?.permissao === 'unsupported' ? '✗ Não suportado'
                  : '...'}
              </span>
            </div>

            {/* Tokens parciais */}
            {tokenStatus && tokenStatus.tokens.length > 0 && (
              <div className="text-[10px] text-gray-400 dark:text-white/25 font-mono space-y-0.5">
                {tokenStatus.tokens.map((t, i) => (
                  <div key={i}>#{i + 1}: {t}</div>
                ))}
              </div>
            )}

            {/* Mensagem de registro */}
            {registroMsg && (
              <p className={`text-xs ${registroMsg.startsWith('Erro') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {registroMsg}
              </p>
            )}

            {/* Botão registrar */}
            <button
              type="button"
              onClick={handleRegistrarNotificacoes}
              disabled={registrando}
              className="
                w-full flex items-center justify-center gap-2 rounded-lg
                bg-[#1260CC] hover:bg-[#0e4fa8] dark:bg-[#0ABFDE] dark:hover:bg-[#08a8c4]
                px-4 py-2.5 text-sm font-semibold text-white
                disabled:opacity-50 disabled:pointer-events-none
                transition-colors duration-150
              "
            >
              {registrando ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <span>🔄</span>
              )}
              {registrando ? 'Registrando...' : 'Registrar este dispositivo'}
            </button>

            <p className="text-[10px] text-gray-400 dark:text-white/30 text-center">
              Abra esta página em cada dispositivo e clique no botão acima
            </p>
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
