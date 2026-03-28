// Componente ProgressBar — barra de progresso animada com percentual e cores dinâmicas

'use client';

import { useEffect, useState, type HTMLAttributes } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Variante = 'default' | 'slim' | 'xp';

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Valor entre 0 e 100 */
  valor: number;
  variante?: Variante;
  /** Exibe a porcentagem como texto ao lado da barra */
  mostrarPorcentagem?: boolean;
}

// ---------------------------------------------------------------------------
// Estilos por variante
// ---------------------------------------------------------------------------

const alturas: Record<Variante, string> = {
  default: 'h-3',
  slim: 'h-1.5',
  xp: 'h-4',
};

const gradientes: Record<Variante, string> = {
  default: 'bg-gradient-to-r from-primary to-cyan',
  slim: 'bg-gradient-to-r from-primary to-cyan',
  xp: 'bg-gradient-to-r from-amber-400 to-yellow-300',
};

const trilhas: Record<Variante, string> = {
  default: 'bg-gray-200 dark:bg-white/10',
  slim: 'bg-gray-200 dark:bg-white/10',
  xp: 'bg-amber-100 dark:bg-amber-400/10',
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function ProgressBar({
  valor,
  variante = 'default',
  mostrarPorcentagem = false,
  className = '',
  ...rest
}: ProgressBarProps) {
  const porcentagem = Math.min(100, Math.max(0, valor));

  // Começa em 0 e anima até o valor alvo depois da montagem (600ms ease-out)
  const [larguraAnimada, setLarguraAnimada] = useState(0);

  useEffect(() => {
    // Pequeno delay para garantir que o browser renderiza com width:0 primeiro
    const raf = requestAnimationFrame(() => {
      setLarguraAnimada(porcentagem);
    });
    return () => cancelAnimationFrame(raf);
  }, [porcentagem]);

  return (
    <div className={['flex items-center gap-2', className].join(' ')} {...rest}>
      {/* Trilha */}
      <div
        className={[
          'relative w-full overflow-hidden rounded-full',
          alturas[variante],
          trilhas[variante],
        ].join(' ')}
      >
        {/* Preenchimento animado (600ms ease-out) */}
        <div
          className={[
            'absolute inset-y-0 left-0 rounded-full',
            'transition-[width] duration-[600ms] ease-out',
            'motion-reduce:transition-none',
            gradientes[variante],
          ].join(' ')}
          style={{ width: `${larguraAnimada}%` }}
          role="progressbar"
          aria-valuenow={Math.round(porcentagem)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Brilho sutil no topo da barra */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-white/40"
          />
        </div>
      </div>

      {/* Porcentagem */}
      {mostrarPorcentagem && (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-400">
          {Math.round(porcentagem)}%
        </span>
      )}
    </div>
  );
}
