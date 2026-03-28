// Página de missões — desafios diários/semanais + conquistas gamificadas

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { xpParaProximoNivel, xpTotalParaNivel } from '@/utils/constants';
import { notificarMissaoCompleta, notificarConquista } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Missao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'diaria' | 'semanal';
  meta: number;
  progresso: number;
  xp_recompensa: number;
  concluida: boolean;
  expira_em: string;
}

interface Badge {
  id: string;
  emoji: string;
  nome: string;
  descricao: string;
  como: string;
  desbloqueada: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function criarSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function tempoAte(isoDate: string) {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, total: 0 };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, total: diff };
}

function iconeParaMissao(titulo: string): string {
  if (/card/i.test(titulo)) return '🃏';
  if (/ditado/i.test(titulo)) return '🎧';
  if (/diário/i.test(titulo)) return '📔';
  if (/streak/i.test(titulo)) return '🔥';
  if (/semana/i.test(titulo)) return '📅';
  return '⚡';
}

function useContagem(alvo: number, duracao = 800) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (alvo === 0) { setValor(0); return; }
    let cancelado = false;
    const inicio = performance.now();
    function frame(agora: number) {
      if (cancelado) return;
      const p = Math.min((agora - inicio) / duracao, 1);
      setValor(Math.round((1 - (1 - p) * (1 - p)) * alvo));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { cancelado = true; };
  }, [alvo, duracao]);
  return valor;
}

// ---------------------------------------------------------------------------
// Definição das Conquistas
// ---------------------------------------------------------------------------

const BADGES_DEF: Omit<Badge, 'desbloqueada'>[] = [
  { id: 'primeira-chama', emoji: '🔥', nome: 'Primeira Chama', descricao: 'Primeiro dia de estudo', como: 'Estude pelo menos 1 dia' },
  { id: 'leitor', emoji: '📚', nome: 'Leitor', descricao: '50 cards revisados', como: 'Revise 50 flashcards' },
  { id: 'veloz', emoji: '⚡', nome: 'Veloz', descricao: 'Sessão com 100% de acerto', como: 'Complete uma sessão sem erros' },
  { id: 'dedicado', emoji: '🗓️', nome: 'Dedicado', descricao: '7 dias seguidos', como: 'Mantenha streak de 7 dias' },
  { id: 'mestre', emoji: '🏆', nome: 'Mestre', descricao: 'Nível 5 atingido', como: 'Alcance o nível 5' },
  { id: 'estrela', emoji: '🌟', nome: 'Estrela', descricao: '500 cards revisados', como: 'Revise 500 flashcards' },
  { id: 'diamante', emoji: '💎', nome: 'Diamante', descricao: '30 dias seguidos', como: 'Mantenha streak de 30 dias' },
  { id: 'rei', emoji: '👑', nome: 'Rei', descricao: 'Nível 10 atingido', como: 'Alcance o nível 10' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-200 dark:bg-white/[0.06] ${className}`} />;
}

function Confetti({ ativo }: { ativo: boolean }) {
  if (!ativo) return null;
  const cores = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6', '#0ABFDE'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {Array.from({ length: 12 }).map((_, i) => {
        const x = (Math.random() - 0.5) * 160;
        const y = -(60 + Math.random() * 80);
        const cor = cores[i % cores.length];
        return (
          <span
            key={i}
            className="missao-particula absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{
              '--part-x': `${x}px`,
              '--part-y': `${y}px`,
              '--part-delay': `${i * 40}ms`,
              backgroundColor: cor,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

function ContadorRegressivo({ expiraEm, label }: { expiraEm: string; label: string }) {
  const [tempo, setTempo] = useState(tempoAte(expiraEm));

  useEffect(() => {
    const id = setInterval(() => setTempo(tempoAte(expiraEm)), 1000);
    return () => clearInterval(id);
  }, [expiraEm]);

  if (tempo.total <= 0) return null;
  return (
    <span className="text-xs font-semibold text-gray-400 dark:text-white/30 tabular-nums">
      {label}{' '}
      <span className="text-[#0ABFDE]">
        {tempo.h > 0 && `${tempo.h}h `}{String(tempo.m).padStart(2, '0')}min
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function MissoesPage() {
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [xpTotal, setXpTotal] = useState(0);
  const [totalRevisoes, setTotalRevisoes] = useState(0);
  const [streakAtual, setStreakAtual] = useState(0);
  const [temSessaoPerfeira, setTemSessaoPerfeita] = useState(false);
  const [confettiId] = useState<string | null>(null);

  const xpAnimado = useContagem(xpTotal);

  // Calcular nível a partir do XP
  let nivel = 1;
  while (xpTotalParaNivel(nivel + 1) <= xpTotal) nivel++;
  const xpInicioNivel = xpTotalParaNivel(nivel);
  const xpProximo = xpParaProximoNivel(nivel);
  const xpNoNivel = xpTotal - xpInicioNivel;
  const pctNivel = Math.min((xpNoNivel / xpProximo) * 100, 100);

  // SVG ring
  const raio = 18;
  const circunferencia = 2 * Math.PI * raio;
  const offset = circunferencia - (pctNivel / 100) * circunferencia;

  const diarias = missoes.filter((m) => m.tipo === 'diaria');
  const semanais = missoes.filter((m) => m.tipo === 'semanal');

  // Calcular expira das diárias
  const expiraDiaria = diarias.find((m) => m.expira_em)?.expira_em ?? '';
  const expiraSemanal = semanais.find((m) => m.expira_em)?.expira_em ?? '';

  // Badges
  const badges: Badge[] = BADGES_DEF.map((b) => {
    let desbloqueada = false;
    switch (b.id) {
      case 'primeira-chama': desbloqueada = streakAtual >= 1 || totalRevisoes > 0; break;
      case 'leitor': desbloqueada = totalRevisoes >= 50; break;
      case 'veloz': desbloqueada = temSessaoPerfeira; break;
      case 'dedicado': desbloqueada = streakAtual >= 7; break;
      case 'mestre': desbloqueada = nivel >= 5; break;
      case 'estrela': desbloqueada = totalRevisoes >= 500; break;
      case 'diamante': desbloqueada = streakAtual >= 30; break;
      case 'rei': desbloqueada = nivel >= 10; break;
    }
    return { ...b, desbloqueada };
  });

  const badgesDesbloqueadas = badges.filter((b) => b.desbloqueada).length;

  // ── Fetch data ──────────────────────────────────────────────────────
  const fetchDados = useCallback(async () => {
    try {
      const supabase = criarSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Missões
      const resMissoes = await fetch('/api/missoes');
      const dataMissoes = await resMissoes.json();
      if (resMissoes.ok && dataMissoes.missoes) {
        setMissoes(dataMissoes.missoes);
      }

      // XP total (soma de progresso)
      const { count: totalRev } = await supabase
        .from('progresso')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setTotalRevisoes(totalRev ?? 0);

      // XP: each review = ~10xp approximate
      const xp = (totalRev ?? 0) * 10;
      setXpTotal(xp);

      // Streak
      const { data: streakData } = await supabase
        .from('streak')
        .select('meta_atingida')
        .eq('user_id', user.id)
        .order('data', { ascending: false })
        .limit(60);

      if (streakData) {
        let streak = 0;
        for (const s of streakData) {
          if (s.meta_atingida) streak++;
          else break;
        }
        setStreakAtual(streak);
      }

      // Sessão perfeita: check se existe pelo menos uma sessão com >=5 reviews sem nenhum 'errei'
      const { data: ultimasRevisoes } = await supabase
        .from('progresso')
        .select('resultado')
        .eq('user_id', user.id)
        .order('respondido_em', { ascending: false })
        .limit(50);

      if (ultimasRevisoes && ultimasRevisoes.length >= 5) {
        // check consecutive non-errei streaks >= 5
        let consecutivos = 0;
        let perfeita = false;
        for (const r of ultimasRevisoes) {
          if (r.resultado !== 'errei') {
            consecutivos++;
            if (consecutivos >= 5) { perfeita = true; break; }
          } else {
            consecutivos = 0;
          }
        }
        setTemSessaoPerfeita(perfeita);

        // Notificar conquista "Veloz" se acabou de desbloquear
        if (perfeita) {
          const chave = 'maestro_conquista_veloz';
          if (!localStorage.getItem(chave)) {
            notificarConquista('⚡ Conquista desbloqueada!', 'Veloz — Sessão com 100% de acerto!');
            localStorage.setItem(chave, '1');
          }
        }
      }

      // Notificar missões que se tornaram completas (detectadas no fetch)
      if (dataMissoes.missoes) {
        const CHAVE = 'maestro_missao_notif';
        const jaNot: string[] = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
        for (const m of dataMissoes.missoes) {
          if (m.concluida && !jaNot.includes(m.id)) {
            notificarMissaoCompleta(m.titulo, m.xp_recompensa);
            jaNot.push(m.id);
          }
        }
        localStorage.setItem(CHAVE, JSON.stringify(jaNot));
      }
    } catch {
      // silently fail
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { fetchDados(); }, [fetchDados]);

  // ====================================================================
  // RENDER
  // ====================================================================

  if (carregando) {
    return (
      <div className="missoes-page p-4 sm:p-6 lg:p-8 space-y-8">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="missoes-page relative min-h-screen p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute top-16 left-1/4 h-80 w-80 rounded-full bg-[#1260CC]/6 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-40 right-1/4 h-64 w-64 rounded-full bg-amber-500/5 blur-[100px]" />

      {/* ═══════════════════════ HEADER ════════════════════════════════ */}
      <header className="missoes-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="missao-trofeu text-3xl sm:text-4xl">🏆</span>
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Missões
            </span>
          </h1>
          {expiraDiaria && (
            <div className="mt-2">
              <ContadorRegressivo expiraEm={expiraDiaria} label="Novas missões em" />
            </div>
          )}
        </div>

        {/* XP + Nível card */}
        <div className="missoes-xp-card flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/60 backdrop-blur-sm px-5 py-3 shadow-lg">
          {/* Nível ring */}
          <div className="relative flex items-center justify-center">
            <svg width="48" height="48" className="-rotate-90">
              <circle cx="24" cy="24" r={raio} fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-white/[0.06]" />
              <circle
                cx="24" cy="24" r={raio} fill="none"
                stroke="url(#nivelGrad)"
                strokeWidth="3" strokeLinecap="round"
                strokeDasharray={circunferencia}
                strokeDashoffset={offset}
                className="missao-nivel-arc"
                style={{ '--missao-xp-width': `${pctNivel}%` } as React.CSSProperties}
              />
              <defs>
                <linearGradient id="nivelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute text-sm font-black text-gray-700 dark:text-white/80">
              {nivel}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
              XP Total
            </p>
            <p className="text-lg font-black tabular-nums bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              {xpAnimado.toLocaleString('pt-BR')}
            </p>
            <div className="mt-1 h-1.5 w-32 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
              <div
                className="missao-xp-bar h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                style={{ '--missao-xp-width': `${pctNivel}%` } as React.CSSProperties}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-white/20 mt-0.5 tabular-nums">
              {xpNoNivel.toLocaleString('pt-BR')} / {xpProximo.toLocaleString('pt-BR')} XP
            </p>
          </div>
        </div>
      </header>

      {/* ═══════════════════════ MISSÕES DIÁRIAS ══════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '100ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/80 flex items-center gap-2">
            <span className="text-xl">⚡</span> Missões Diárias
          </h2>
          <span className="text-xs font-semibold text-gray-400 dark:text-white/25 tabular-nums">
            {diarias.filter((m) => m.concluida).length}/{diarias.length} completas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {diarias.map((missao, i) => {
            const pct = missao.meta > 0 ? Math.round((missao.progresso / missao.meta) * 100) : 0;
            const showConfetti = confettiId === missao.id;
            return (
              <div
                key={missao.id}
                className={`missao-card-stagger relative rounded-2xl border p-5 transition-all duration-300 group overflow-hidden ${
                  missao.concluida
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]'
                    : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/60 hover:border-gray-300 dark:hover:border-white/[0.10]'
                }`}
                style={{ '--missao-stagger-delay': `${150 + i * 80}ms` } as React.CSSProperties}
              >
                {/* Top shimmer */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1260CC]/15 to-transparent" />

                <Confetti ativo={showConfetti} />

                {/* Icon + title */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl ${missao.concluida ? 'missao-icone-completa' : 'missao-icone-float'}`}>
                      {missao.concluida ? '✓' : iconeParaMissao(missao.titulo)}
                    </span>
                    <div>
                      <h3 className={`text-sm font-bold leading-tight ${
                        missao.concluida ? 'text-emerald-500' : 'text-gray-800 dark:text-white/80'
                      }`}>
                        {missao.titulo}
                      </h3>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 leading-relaxed">
                        {missao.descricao}
                      </p>
                    </div>
                  </div>
                  {/* XP badge */}
                  <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black tabular-nums ${
                    missao.concluida
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    +{missao.xp_recompensa} XP
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-500 dark:text-white/40 tabular-nums">
                      {missao.progresso} / {missao.meta}
                    </span>
                    <span className="text-xs font-bold text-gray-400 dark:text-white/25 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        missao.concluida
                          ? 'missao-progress-bar bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'missao-progress-animated'
                      }`}
                      style={{
                        '--missao-bar-width': `${pct}%`,
                        '--missao-bar-delay': `${200 + i * 100}ms`,
                      } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Completed badge */}
                {missao.concluida && (
                  <div className="missao-badge-completa mt-3 flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white font-black">✓</span>
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Completa</span>
                  </div>
                )}
              </div>
            );
          })}
          {diarias.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 dark:text-white/20">
              <p className="text-3xl mb-2">🎯</p>
              <p className="text-sm">Nenhuma missão diária encontrada.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════ MISSÕES SEMANAIS ═════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '250ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/80 flex items-center gap-2">
            <span className="text-xl">📅</span> Missões Semanais
          </h2>
          {expiraSemanal && (
            <ContadorRegressivo expiraEm={expiraSemanal} label="Encerra em" />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {semanais.map((missao, i) => {
            const pct = missao.meta > 0 ? Math.round((missao.progresso / missao.meta) * 100) : 0;
            const showConfetti = confettiId === missao.id;
            return (
              <div
                key={missao.id}
                className={`missao-card-stagger relative rounded-2xl border p-6 transition-all duration-300 group overflow-hidden ${
                  missao.concluida
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]'
                    : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/60 hover:border-gray-300 dark:hover:border-white/[0.10]'
                }`}
                style={{ '--missao-stagger-delay': `${300 + i * 100}ms` } as React.CSSProperties}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />

                <Confetti ativo={showConfetti} />

                <div className="flex items-start gap-4">
                  {/* Big icon */}
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shrink-0 ${
                    missao.concluida
                      ? 'bg-emerald-500/10'
                      : 'bg-gradient-to-br from-[#1260CC]/10 to-[#0ABFDE]/10'
                  }`}>
                    <span className={missao.concluida ? 'missao-icone-completa' : 'missao-icone-float'}>
                      {missao.concluida ? '✓' : iconeParaMissao(missao.titulo)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`text-base font-bold leading-tight ${
                          missao.concluida ? 'text-emerald-500' : 'text-gray-800 dark:text-white/80'
                        }`}>
                          {missao.titulo}
                        </h3>
                        <p className="text-xs text-gray-400 dark:text-white/30 mt-1 leading-relaxed">
                          {missao.descricao}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-black tabular-nums ${
                        missao.concluida
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-500'
                      }`}>
                        +{missao.xp_recompensa} XP
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-gray-500 dark:text-white/40 tabular-nums">
                          {missao.progresso} / {missao.meta}
                        </span>
                        <span className="text-sm font-black tabular-nums text-[#1260CC] dark:text-[#378ADD]">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-3 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            missao.concluida
                              ? 'missao-progress-bar bg-gradient-to-r from-emerald-500 to-emerald-400'
                              : 'missao-progress-animated'
                          }`}
                          style={{
                            '--missao-bar-width': `${pct}%`,
                            '--missao-bar-delay': `${400 + i * 100}ms`,
                          } as React.CSSProperties}
                        />
                      </div>
                    </div>

                    {missao.concluida && (
                      <div className="missao-badge-completa mt-3 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white font-black">✓</span>
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Completa</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {semanais.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400 dark:text-white/20">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm">Nenhuma missão semanal encontrada.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════ CONQUISTAS ════════════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '400ms' } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white/80 flex items-center gap-2">
            <span className="text-xl">🎖️</span> Conquistas
          </h2>
          <span className="text-xs font-semibold text-gray-400 dark:text-white/25 tabular-nums">
            {badgesDesbloqueadas}/{badges.length} desbloqueadas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {badges.map((badge, i) => (
            <BadgeCard key={badge.id} badge={badge} delay={450 + i * 60} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Card Component
// ---------------------------------------------------------------------------

function BadgeCard({ badge, delay }: { badge: Badge; delay: number }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="missao-badge-stagger relative"
      style={{ '--missao-badge-delay': `${delay}ms` } as React.CSSProperties}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`relative rounded-2xl border p-4 transition-all duration-300 text-center overflow-hidden ${
          badge.desbloqueada
            ? 'border-amber-400/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-500/10'
            : 'border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] opacity-60'
        }`}
      >
        {/* Glow overlay for unlocked */}
        {badge.desbloqueada && (
          <div className="missao-badge-shimmer absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300/10 to-transparent skew-x-12" />
          </div>
        )}

        {/* Emoji */}
        <div className={`text-3xl mb-2 ${
          badge.desbloqueada ? '' : 'grayscale'
        }`}>
          {badge.desbloqueada ? badge.emoji : '🔒'}
        </div>

        {/* Name */}
        <h4 className={`text-xs font-bold leading-tight ${
          badge.desbloqueada ? 'text-gray-800 dark:text-white/80' : 'text-gray-400 dark:text-white/25'
        }`}>
          {badge.nome}
        </h4>

        <p className={`text-[10px] mt-1 leading-snug ${
          badge.desbloqueada ? 'text-gray-500 dark:text-white/40' : 'text-gray-300 dark:text-white/15'
        }`}>
          {badge.descricao}
        </p>
      </div>

      {/* Tooltip on hover */}
      {hover && !badge.desbloqueada && (
        <div className="missao-tooltip absolute left-1/2 bottom-full mb-2 z-20 w-44 -translate-x-1/2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a2e] shadow-xl px-3 py-2">
          <p className="text-[10px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-0.5">
            Como desbloquear
          </p>
          <p className="text-xs text-gray-600 dark:text-white/50 leading-relaxed">
            {badge.como}
          </p>
          <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px border-4 border-transparent border-t-white dark:border-t-[#1a1a2e]" />
        </div>
      )}
    </div>
  );
}
