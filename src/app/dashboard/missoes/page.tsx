// Página de missões — desafios diários, semanais e conquistas gamificadas

'use client';

import { useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Missao {
  id: string;
  icone: string;
  titulo: string;
  descricao: string;
  atual: number;
  meta: number;
  xp: number;
}

interface Badge {
  id: string;
  icone: string;
  nome: string;
  descricao: string;
  conquistada: boolean;
  cor: string;
}

// ---------------------------------------------------------------------------
// Mock — Missões diárias
// ---------------------------------------------------------------------------

const MISSOES_DIARIAS: Missao[] = [
  {
    id: 'd1',
    icone: '🎯',
    titulo: 'Revisão Matinal',
    descricao: 'Revise 10 cards hoje',
    atual: 10,
    meta: 10,
    xp: 50,
  },
  {
    id: 'd2',
    icone: '⚡',
    titulo: 'Precisão Afiada',
    descricao: 'Acerte 8 cards seguidos sem errar',
    atual: 5,
    meta: 8,
    xp: 80,
  },
  {
    id: 'd3',
    icone: '📚',
    titulo: 'Explorador',
    descricao: 'Estude cards de 3 baralhos diferentes',
    atual: 2,
    meta: 3,
    xp: 60,
  },
];

// ---------------------------------------------------------------------------
// Mock — Missões semanais
// ---------------------------------------------------------------------------

const MISSOES_SEMANAIS: Missao[] = [
  {
    id: 'w1',
    icone: '🏆',
    titulo: 'Maratonista',
    descricao: 'Revise 100 cards esta semana',
    atual: 68,
    meta: 100,
    xp: 300,
  },
  {
    id: 'w2',
    icone: '🔥',
    titulo: 'Chama Eterna',
    descricao: 'Mantenha o streak por 7 dias seguidos',
    atual: 5,
    meta: 7,
    xp: 500,
  },
];

// ---------------------------------------------------------------------------
// Mock — Badges
// ---------------------------------------------------------------------------

const BADGES: Badge[] = [
  { id: 'b1', icone: '🌟', nome: 'Primeiro Passo', descricao: 'Revise seu primeiro card', conquistada: true, cor: '#FBBF24' },
  { id: 'b2', icone: '🔥', nome: 'Streak 7', descricao: '7 dias consecutivos', conquistada: true, cor: '#F97316' },
  { id: 'b3', icone: '🎯', nome: 'Precisão 90%', descricao: 'Acerte 90% em uma sessão', conquistada: true, cor: '#10B981' },
  { id: 'b4', icone: '📚', nome: 'Poliglota', descricao: 'Domine 50 cards', conquistada: true, cor: '#1260CC' },
  { id: 'b5', icone: '⚡', nome: 'Velocista', descricao: 'Revise 20 cards em 5 min', conquistada: false, cor: '#7C3AED' },
  { id: 'b6', icone: '🏆', nome: 'Centurião', descricao: 'Domine 100 cards', conquistada: false, cor: '#0ABFDE' },
  { id: 'b7', icone: '💎', nome: 'Diamante', descricao: 'Streak de 30 dias', conquistada: false, cor: '#EC4899' },
  { id: 'b8', icone: '👑', nome: 'Mestre', descricao: 'Domine todos os baralhos', conquistada: false, cor: '#EAB308' },
];

// ---------------------------------------------------------------------------
// XP / Nível mockado
// ---------------------------------------------------------------------------

const XP_TOTAL = 1420;
const XP_NIVEL_ATUAL = 320;
const XP_PROXIMO_NIVEL = 500;
const NIVEL = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/** Conta regressiva até o próximo domingo 00:00 */
function tempoAteReset(): string {
  const agora = new Date();
  const diasAteDomingo = (7 - agora.getDay()) % 7 || 7;
  const proximo = new Date(agora);
  proximo.setDate(agora.getDate() + diasAteDomingo);
  proximo.setHours(0, 0, 0, 0);
  const diff = proximo.getTime() - agora.getTime();
  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  if (dias > 0) return `${dias}d ${horas}h`;
  return `${horas}h`;
}

// ---------------------------------------------------------------------------
// Partículas de conclusão (6 partículas por missão completa)
// ---------------------------------------------------------------------------

const PARTICULAS = Array.from({ length: 6 }, (_, i) => ({
  angle: (i * 60) + Math.random() * 20,
  distance: 28 + Math.random() * 16,
  size: 3 + (i % 2) * 2,
  delay: i * 40,
  color: ['#FBBF24', '#10B981', '#0ABFDE', '#F97316', '#1260CC', '#7C3AED'][i],
}));

function ParticulasConclusao() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {PARTICULAS.map((p, i) => {
        const x = Math.cos((p.angle * Math.PI) / 180) * p.distance;
        const y = Math.sin((p.angle * Math.PI) / 180) * p.distance;
        return (
          <span
            key={i}
            className="missao-particula absolute rounded-full motion-reduce:hidden"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              '--part-x': `${x}px`,
              '--part-y': `${y}px`,
              '--part-delay': `${p.delay}ms`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de missão
// ---------------------------------------------------------------------------

function MissaoItem({
  missao,
  index,
  tipo,
}: {
  missao: Missao;
  index: number;
  tipo: 'diaria' | 'semanal';
}) {
  const completa = missao.atual >= missao.meta;
  const pct = Math.min(Math.round((missao.atual / missao.meta) * 100), 100);
  const isSemanal = tipo === 'semanal';

  return (
    <div
      className={[
        'missao-card-stagger group relative overflow-hidden rounded-2xl border transition-all duration-200',
        completa
          ? 'border-emerald-200/60 dark:border-emerald-400/10 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-400/[0.04] dark:to-[#1a1a35]'
          : 'border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35]',
        'hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-0.5',
      ].join(' ')}
      style={{ '--missao-stagger-delay': `${index * 80 + (isSemanal ? 300 : 0)}ms` } as React.CSSProperties}
    >
      {/* Barra de cor no topo */}
      <div className={`h-1 w-full ${completa ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-primary to-cyan'}`} />

      <div className={`relative ${isSemanal ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}`}>
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Ícone */}
          <div
            className={[
              'missao-icone relative flex shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
              isSemanal ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-xl',
              completa
                ? 'bg-emerald-100 dark:bg-emerald-400/[0.12]'
                : 'bg-gray-100 dark:bg-white/[0.06]',
            ].join(' ')}
          >
            {completa && <ParticulasConclusao />}
            <span className={completa ? 'missao-icone-completa' : 'missao-icone-float'}>
              {completa ? '✓' : missao.icone}
            </span>
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className={`font-bold text-gray-900 dark:text-white ${isSemanal ? 'text-base' : 'text-sm'}`}>
                  {missao.titulo}
                </h3>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-white/30">
                  {missao.descricao}
                </p>
              </div>

              {/* Badge XP / Completa */}
              {completa ? (
                <span className="missao-badge-completa shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Completa
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-400/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  ⭐ {missao.xp} XP
                </span>
              )}
            </div>

            {/* Progresso */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-gray-400 dark:text-white/30 tabular-nums">
                  {missao.atual}/{missao.meta}
                </span>
                <span className={`tabular-nums ${completa ? 'text-emerald-500 dark:text-emerald-400' : 'text-primary dark:text-cyan'}`}>
                  {pct}%
                </span>
              </div>

              {/* Barra */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
                <div
                  className={`missao-progress-bar absolute inset-y-0 left-0 rounded-full ${
                    completa
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                      : 'missao-progress-animated bg-gradient-to-r from-primary to-cyan'
                  }`}
                  style={{
                    '--missao-bar-width': `${pct}%`,
                    '--missao-bar-delay': `${index * 80 + 200 + (isSemanal ? 300 : 0)}ms`,
                  } as React.CSSProperties}
                />
                {/* Glow */}
                <div
                  className="missao-progress-bar absolute inset-y-0 left-0 rounded-full blur-sm opacity-30"
                  style={{
                    '--missao-bar-width': `${pct}%`,
                    '--missao-bar-delay': `${index * 80 + 200 + (isSemanal ? 300 : 0)}ms`,
                    background: completa ? '#10B981' : '#1260CC',
                  } as React.CSSProperties}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge de conquista
// ---------------------------------------------------------------------------

function BadgeConquista({ badge, index }: { badge: Badge; index: number }) {
  const [tooltipVisivel, setTooltipVisivel] = useState(false);

  return (
    <div
      className="missao-badge-stagger relative flex flex-col items-center gap-2"
      style={{ '--missao-badge-delay': `${index * 60 + 700}ms` } as React.CSSProperties}
      onMouseEnter={() => setTooltipVisivel(true)}
      onMouseLeave={() => setTooltipVisivel(false)}
    >
      {/* Ícone container */}
      <div
        className={[
          'missao-badge-icon group relative flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-2xl border-2 transition-all duration-200',
          badge.conquistada
            ? 'border-transparent shadow-lg hover:scale-110 hover:shadow-xl cursor-default'
            : 'border-dashed border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] opacity-50 grayscale hover:opacity-70',
        ].join(' ')}
        style={
          badge.conquistada
            ? {
                background: `linear-gradient(135deg, ${hexAlpha(badge.cor, 0.15)}, ${hexAlpha(badge.cor, 0.05)})`,
                boxShadow: `0 4px 16px ${hexAlpha(badge.cor, 0.2)}`,
              }
            : undefined
        }
      >
        {/* Glow ring — conquistada */}
        {badge.conquistada && (
          <div
            className="missao-badge-glow pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: `conic-gradient(from 0deg, ${hexAlpha(badge.cor, 0.3)}, transparent, ${hexAlpha(badge.cor, 0.3)})`,
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '2px',
            }}
          />
        )}

        <span className={`text-2xl sm:text-3xl ${badge.conquistada ? '' : 'opacity-40'}`}>
          {badge.conquistada ? badge.icone : '🔒'}
        </span>

        {/* Brilho shimmer — conquistada */}
        {badge.conquistada && (
          <div className="missao-badge-shimmer pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full" />
          </div>
        )}
      </div>

      {/* Nome */}
      <p className={`text-[11px] font-semibold text-center leading-tight ${
        badge.conquistada ? 'text-gray-700 dark:text-white/70' : 'text-gray-400 dark:text-white/25'
      }`}>
        {badge.nome}
      </p>

      {/* Tooltip */}
      {tooltipVisivel && (
        <div className="missao-tooltip absolute -top-12 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a35] px-3 py-1.5 text-[11px] font-medium text-gray-600 dark:text-white/50 shadow-xl">
          {badge.descricao}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-gray-200 dark:border-t-white/[0.08]" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function MissoesPage() {
  const [mounted, setMounted] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  const resetTimer = useMemo(() => tempoAteReset(), []);
  const xpPct = Math.round((XP_NIVEL_ATUAL / XP_PROXIMO_NIVEL) * 100);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="missoes-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

      {/* ─── HEADER ────────────────────────────────────────────── */}
      <div className="missoes-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="missao-trofeu text-4xl">🏆</span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 bg-clip-text text-transparent">
                Missões
              </span>
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-white/40">
              Complete desafios e ganhe recompensas
            </p>
          </div>
        </div>

        {/* XP + Nível */}
        <div className="missoes-xp-card flex items-center gap-4 self-start rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] px-5 py-3 shadow-sm">
          {/* Nível */}
          <div className="flex items-center gap-2">
            <div className="missao-nivel-ring relative flex h-11 w-11 items-center justify-center rounded-full">
              {/* Ring SVG */}
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-white/[0.06]" />
                <circle
                  cx="22" cy="22" r="18" fill="none" strokeWidth="3"
                  strokeLinecap="round"
                  className="missao-nivel-arc text-amber-400"
                  stroke="currentColor"
                  strokeDasharray={`${(2 * Math.PI * 18 * xpPct) / 100} ${2 * Math.PI * 18}`}
                />
              </svg>
              <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">{NIVEL}</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">Nível</p>
              <p className="text-xs font-bold text-gray-900 dark:text-white tabular-nums">{XP_TOTAL.toLocaleString()} XP</p>
            </div>
          </div>

          {/* Barra de XP compacta */}
          <div className="hidden sm:block w-24">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
              <div
                className="missao-xp-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                style={{ '--missao-xp-width': `${xpPct}%` } as React.CSSProperties}
              />
            </div>
            <p className="mt-1 text-[9px] font-semibold text-gray-300 dark:text-white/20 text-right tabular-nums">
              {XP_NIVEL_ATUAL}/{XP_PROXIMO_NIVEL}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MISSÕES DIÁRIAS
      ═══════════════════════════════════════════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '100ms' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Missões Diárias</h2>
          <span className="ml-auto text-[11px] font-semibold text-gray-400 dark:text-white/25">
            Reinicia à meia-noite
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {MISSOES_DIARIAS.map((m, i) => (
            <MissaoItem key={m.id} missao={m} index={i} tipo="diaria" />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          MISSÕES SEMANAIS
      ═══════════════════════════════════════════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '300ms' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🗡️</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Missões Semanais</h2>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-white/25">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reset em {resetTimer}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MISSOES_SEMANAIS.map((m, i) => (
            <MissaoItem key={m.id} missao={m} index={i} tipo="semanal" />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CONQUISTAS / BADGES
      ═══════════════════════════════════════════════════════════ */}
      <section className="missoes-section space-y-4" style={{ '--missoes-section-delay': '500ms' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🎖️</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conquistas</h2>
          <span className="ml-auto text-[11px] font-semibold text-gray-400 dark:text-white/25">
            {BADGES.filter((b) => b.conquistada).length}/{BADGES.length}
          </span>
        </div>

        <div className="rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 sm:p-6">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 sm:gap-5">
            {BADGES.map((b, i) => (
              <BadgeConquista key={b.id} badge={b} index={i} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
