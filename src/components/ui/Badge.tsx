// Componente Badge — etiqueta visual para status, categorias e níveis

'use client';

import type { HTMLAttributes } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Variante = 'xp' | 'nivel' | 'streak' | 'correto' | 'erro';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variante?: Variante;
  /** Quando ativo, o badge pulsa suavemente para chamar atenção */
  ativo?: boolean;
}

// ---------------------------------------------------------------------------
// Estilos mapeados
// ---------------------------------------------------------------------------

const estilosVariante: Record<Variante, string> = {
  xp:
    'bg-amber-100 text-amber-700 ring-amber-300/60 ' +
    'dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/40',
  nivel:
    'bg-blue-100 text-blue-700 ring-blue-300/60 ' +
    'dark:bg-blue-400/15 dark:text-blue-300 dark:ring-blue-400/40',
  streak:
    'bg-orange-100 text-orange-700 ring-orange-300/60 ' +
    'dark:bg-orange-400/15 dark:text-orange-300 dark:ring-orange-400/40',
  correto:
    'bg-green-100 text-green-700 ring-green-300/60 ' +
    'dark:bg-green-400/15 dark:text-green-300 dark:ring-green-400/40',
  erro:
    'bg-red-100 text-red-700 ring-red-300/60 ' +
    'dark:bg-red-400/15 dark:text-red-300 dark:ring-red-400/40',
};

const icones: Record<Variante, string> = {
  xp: '\u2B50',          // estrela
  nivel: '\u2B06',        // seta cima
  streak: '\uD83D\uDD25', // fogo
  correto: '\u2714',      // check
  erro: '\u2716',          // x
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function Badge({
  variante = 'xp',
  ativo = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5',
        'text-xs font-semibold leading-5 ring-1 ring-inset',
        // Entrada com scale + fade
        'animate-badge-in',
        'transition-all duration-150',
        estilosVariante[variante],
        // Pulso sutil quando ativo (usa custom animation mais suave que animate-pulse)
        ativo ? 'animate-pulse-soft' : '',
        // Reduced motion
        'motion-reduce:animate-none',
        className,
      ].join(' ')}
      {...rest}
    >
      <span aria-hidden="true">{icones[variante]}</span>
      {children}
    </span>
  );
}
