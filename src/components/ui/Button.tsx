// Componente Button — botão reutilizável com variantes (primary, secondary, danger) e estados

'use client';

import { type ButtonHTMLAttributes, type MouseEvent, forwardRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost';
type Tamanho = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Estilos mapeados
// ---------------------------------------------------------------------------

const estilosVariante: Record<Variante, string> = {
  primary:
    'bg-primary text-white ' +
    'shadow-md shadow-primary/20 ' +
    'hover:bg-medium hover:shadow-lg hover:shadow-primary/30 hover:ring-2 hover:ring-primary/30 ' +
    'dark:bg-primary dark:hover:bg-medium dark:shadow-primary/30',
  secondary:
    'bg-gray-100 text-gray-800 ' +
    'shadow-sm ' +
    'hover:bg-gray-200 hover:shadow-md ' +
    'dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20',
  danger:
    'bg-red-500 text-white ' +
    'shadow-md shadow-red-500/20 ' +
    'hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 hover:ring-2 hover:ring-red-400/30 ' +
    'dark:bg-red-600 dark:hover:bg-red-500',
  ghost:
    'bg-transparent text-gray-700 ' +
    'hover:bg-gray-100 ' +
    'dark:text-gray-300 dark:hover:bg-white/10',
};

const estilosTamanho: Record<Tamanho, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
};

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

function Spinner({ tamanho }: { tamanho: Tamanho }) {
  const dimensao = tamanho === 'sm' ? 'h-3.5 w-3.5' : tamanho === 'md' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <svg
      className={`${dimensao} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variante = 'primary',
      tamanho = 'md',
      loading = false,
      disabled,
      className = '',
      children,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const desabilitado = disabled || loading;

    // Ripple: injeta um <span> efêmero na posição do clique
    const handleClick = useCallback(
      (e: MouseEvent<HTMLButtonElement>) => {
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const circle = document.createElement('span');
        circle.className = 'btn-ripple-circle';
        circle.style.width = circle.style.height = `${size}px`;
        circle.style.left = `${e.clientX - rect.left}px`;
        circle.style.top = `${e.clientY - rect.top}px`;
        btn.appendChild(circle);
        circle.addEventListener('animationend', () => circle.remove());

        onClick?.(e);
      },
      [onClick],
    );

    return (
      <button
        ref={ref}
        disabled={desabilitado}
        onClick={desabilitado ? undefined : handleClick}
        className={[
          // Layout
          'btn-ripple inline-flex items-center justify-center font-medium',
          'rounded-lg',
          // Hover: scale up + glow on border
          'hover:scale-[1.03]',
          // Active: quick scale down
          'active:scale-[0.97] active:transition-transform active:duration-100',
          // Base transition (150ms ease)
          'transition-all duration-150 ease-in-out',
          // Focus ring
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          // Disabled
          'disabled:opacity-50 disabled:pointer-events-none',
          // Motion-safe guard (hover scale only when motion ok)
          'motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
          estilosVariante[variante],
          estilosTamanho[tamanho],
          className,
        ].join(' ')}
        {...rest}
      >
        {loading && <Spinner tamanho={tamanho} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
