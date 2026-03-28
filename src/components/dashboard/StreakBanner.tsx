// Componente StreakBanner — banner exibindo dias consecutivos de estudo e motivação

'use client';

import { useMemo } from 'react';
import { useStreak } from '@/hooks/useStreak';

// ---------------------------------------------------------------------------
// Tiers visuais baseados na quantidade de dias
// ---------------------------------------------------------------------------

interface Tier {
  label: string;
  cor: string;          // text color
  bg: string;           // banner background
  borda: string;        // border / accent
  brilho: string;       // glow color (box-shadow)
}

function obterTier(dias: number): Tier {
  if (dias >= 30) {
    return {
      label: 'Lendário',
      cor: 'text-purple-300',
      bg: 'bg-gradient-to-r from-purple-900/80 via-indigo-900/80 to-purple-900/80',
      borda: 'border-purple-500/60',
      brilho: 'rgba(168,85,247,0.35)',
    };
  }
  if (dias >= 7) {
    return {
      label: 'Em chamas',
      cor: 'text-yellow-300',
      bg: 'bg-gradient-to-r from-amber-900/80 via-orange-900/80 to-amber-900/80',
      borda: 'border-yellow-500/60',
      brilho: 'rgba(234,179,8,0.3)',
    };
  }
  return {
    label: 'Iniciante',
    cor: 'text-orange-300',
    bg: 'bg-gradient-to-r from-orange-900/60 via-red-900/60 to-orange-900/60',
    borda: 'border-orange-500/50',
    brilho: 'rgba(249,115,22,0.2)',
  };
}

// ---------------------------------------------------------------------------
// Mensagens motivacionais
// ---------------------------------------------------------------------------

function obterMensagem(dias: number): string {
  if (dias === 0) return 'Comece hoje e construa seu streak!';
  if (dias === 1) return 'Ótimo começo! Volte amanhã para manter o ritmo.';
  if (dias < 7) return 'Continue assim, o hábito está se formando!';
  if (dias < 30) return 'Você está em chamas! Ninguém te para.';
  return 'Nível lendário — sua dedicação é inspiradora!';
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function StreakBanner() {
  const { diasConsecutivos, metaAtingida, carregando } = useStreak();

  const tier = useMemo(() => obterTier(diasConsecutivos), [diasConsecutivos]);
  const mensagem = useMemo(() => obterMensagem(diasConsecutivos), [diasConsecutivos]);

  if (carregando) {
    return (
      <div className="h-24 animate-pulse rounded-2xl bg-white/5 dark:bg-white/[0.03]" />
    );
  }

  return (
    <div
      className={`
        streak-banner relative overflow-hidden rounded-2xl border
        ${tier.bg} ${tier.borda} p-4 sm:p-5
        transition-shadow duration-300
      `}
      style={{ boxShadow: `0 0 24px ${tier.brilho}` }}
    >
      {/* Partículas decorativas */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="streak-particle absolute rounded-full bg-white/10"
            style={{
              width: `${4 + i * 2}px`,
              height: `${4 + i * 2}px`,
              left: `${10 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              '--delay': `${i * 0.4}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative z-10 flex items-center gap-4">
        {/* Ícone de fogo animado */}
        <div className="streak-fire flex-shrink-0 text-4xl sm:text-5xl select-none">
          {diasConsecutivos >= 30 ? '👑' : '🔥'}
        </div>

        {/* Conteúdo textual */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={`streak-count text-3xl sm:text-4xl font-extrabold tabular-nums ${tier.cor}`}
            >
              {diasConsecutivos}
            </span>
            <span className="text-sm sm:text-base font-semibold text-white/80">
              {diasConsecutivos === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>

            {metaAtingida && (
              <span className="streak-meta-badge ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300 border border-green-500/30">
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Meta de hoje
              </span>
            )}
          </div>

          <p className="mt-1 text-xs sm:text-sm text-white/60 leading-relaxed truncate">
            {mensagem}
          </p>
        </div>
      </div>

      {/* Tier badge no canto */}
      {diasConsecutivos >= 7 && (
        <span
          className={`
            absolute -top-px -right-px rounded-bl-xl rounded-tr-2xl
            px-3 py-1 text-[10px] font-bold uppercase tracking-wider
            ${diasConsecutivos >= 30
              ? 'bg-purple-500/30 text-purple-200'
              : 'bg-yellow-500/30 text-yellow-200'
            }
          `}
        >
          {tier.label}
        </span>
      )}
    </div>
  );
}
