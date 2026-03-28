// Componente Card — container estilizado reutilizável para exibir conteúdo agrupado

'use client';

import { type HTMLAttributes, forwardRef } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Variante = 'default' | 'highlighted' | 'compact';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variante?: Variante;
}

// ---------------------------------------------------------------------------
// Estilos mapeados
// ---------------------------------------------------------------------------

const estilosVariante: Record<Variante, string> = {
  default: 'p-5 shadow-md hover:shadow-lg',
  highlighted:
    'p-5 shadow-lg shadow-primary/10 dark:shadow-cyan/10 ' +
    'ring-1 ring-primary/20 dark:ring-cyan/30 ' +
    'hover:shadow-xl hover:shadow-primary/15 dark:hover:shadow-cyan/15 ' +
    'hover:ring-primary/40 dark:hover:ring-cyan/50',
  compact: 'p-3 shadow-sm hover:shadow-md',
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variante = 'default', className = '', children, ...rest }, ref) => {
    const isHighlighted = variante === 'highlighted';

    return (
      <div
        ref={ref}
        className={[
          // Base
          'relative overflow-hidden rounded-xl',
          'bg-white dark:bg-[#1a1a2e]',
          // Animação de entrada: fade + slide up
          'animate-slide-up',
          // Hover: sombra mais intensa + borda mais brilhante (200ms)
          'transition-all duration-200 ease-out',
          // Reduced motion
          'motion-reduce:animate-none',
          estilosVariante[variante],
          className,
        ].join(' ')}
        {...rest}
      >
        {/* Borda gradiente — mais intensa no highlighted, sutil no default */}
        <span
          aria-hidden="true"
          className={[
            'pointer-events-none absolute inset-0 rounded-xl',
            'bg-gradient-to-br from-primary to-cyan',
            'transition-opacity duration-200',
            isHighlighted
              ? 'opacity-100 group-hover:opacity-100'
              : 'opacity-40 dark:opacity-50',
          ].join(' ')}
          style={{
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: isHighlighted ? '2px' : '1px',
          }}
        />

        {/* Brilho sutil no topo para efeito de profundidade */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
        />

        {/* Conteúdo */}
        <div className="relative">{children}</div>
      </div>
    );
  },
);

Card.displayName = 'Card';
export default Card;
