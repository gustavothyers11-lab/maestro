// Componente MetaDiaria — exibe progresso da meta diária de cards revisados e tempo de estudo

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { META_DIARIA_PADRAO } from '@/utils/constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetaDiariaProps {
  /** Quantos cards já foram revisados hoje */
  cardsRevisados: number;
  /** Meta diária configurada pelo usuário (padrão: META_DIARIA_PADRAO) */
  metaTotal?: number;
  /** Tempo de estudo em minutos (opcional, renderizado se > 0) */
  tempoMinutos?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function MetaDiaria({
  cardsRevisados,
  metaTotal = META_DIARIA_PADRAO,
  tempoMinutos = 0,
}: MetaDiariaProps) {
  // Percentual clamped 0-100
  const porcentagem = useMemo(
    () => Math.min(100, Math.round((cardsRevisados / metaTotal) * 100)),
    [cardsRevisados, metaTotal],
  );

  const concluida = porcentagem >= 100;

  // Animação da barra (0 → porcentagem real)
  const [larguraAnimada, setLarguraAnimada] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Pequeno delay para garantir que o 0% esteja pintado antes
    const frame = requestAnimationFrame(() => {
      setLarguraAnimada(porcentagem);
    });
    return () => cancelAnimationFrame(frame);
  }, [porcentagem]);

  return (
    <div
      className={`
        meta-diaria group relative overflow-hidden rounded-2xl border
        transition-all duration-300
        ${concluida
          ? 'border-green-500/40 bg-gradient-to-br from-green-950/60 via-emerald-950/60 to-green-950/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
          : 'border-white/10 bg-white/[0.04] dark:bg-white/[0.03] hover:border-white/20 hover:shadow-lg'
        }
        p-4 sm:p-5
      `}
    >
      {/* Confetti ao completar */}
      {concluida && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className="meta-confetti absolute"
              style={{
                left: `${5 + i * 9}%`,
                '--delay': `${i * 0.15}s`,
                '--dur': `${1.2 + (i % 3) * 0.4}s`,
                '--hue': `${(i * 36) % 360}`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      <div className="relative z-10">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-white/80 uppercase tracking-wide">
            Meta diária
          </h3>

          {concluida ? (
            <span className="meta-check inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300 border border-green-500/30">
              <svg className="meta-check-icon h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 10 8 14 16 6" />
              </svg>
              Concluída!
            </span>
          ) : (
            <span className="text-xs font-semibold text-white/50 tabular-nums">
              {porcentagem}%
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        <div
          ref={barRef}
          className="relative h-3 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={porcentagem}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`
              absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out
              ${concluida
                ? 'bg-gradient-to-r from-green-500 via-emerald-400 to-green-500 meta-bar-shine'
                : 'bg-gradient-to-r from-primary via-medium to-cyan'
              }
            `}
            style={{ width: `${larguraAnimada}%` }}
          />
        </div>

        {/* Texto de contagem */}
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-white/70 text-sm">
            <span className={`font-extrabold tabular-nums text-lg ${concluida ? 'text-green-300' : 'text-white'}`}>
              {cardsRevisados}
            </span>
            <span className="mx-1 text-white/40">/</span>
            <span className="font-semibold tabular-nums">{metaTotal}</span>
            <span className="ml-1 text-white/50 text-xs">cards</span>
          </p>

          {tempoMinutos > 0 && (
            <p className="text-xs text-white/40 tabular-nums">
              <svg className="mr-1 inline-block h-3 w-3 -mt-px" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {tempoMinutos} min
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
