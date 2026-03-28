// Componente Modal — diálogo modal acessível com overlay, animações e controle de foco

'use client';

import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ModalProps {
  /** Controla se o modal está visível */
  aberto: boolean;
  /** Callback para fechar o modal */
  onFechar: () => void;
  /** Título exibido no topo do modal */
  titulo?: string;
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function Modal({
  aberto,
  onFechar,
  titulo,
  children,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  // Estado interno para gerenciar a animação de saída antes de desmontar
  const [visivel, setVisivel] = useState(aberto);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (aberto) {
      // Abrindo: torna visível imediatamente
      setVisivel(true);
      setSaindo(false);
    } else if (visivel) {
      // Fechando: inicia animação de saída, depois desmonta
      setSaindo(true);
      const timer = setTimeout(() => {
        setVisivel(false);
        setSaindo(false);
      }, 150); // duração da animação de saída
      return () => clearTimeout(timer);
    }
  }, [aberto, visivel]);

  // Fecha com Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    },
    [onFechar],
  );

  useEffect(() => {
    if (!visivel) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [visivel, handleKeyDown]);

  // Foca o painel ao abrir para leitores de tela
  useEffect(() => {
    if (aberto && !saindo) painelRef.current?.focus();
  }, [aberto, saindo]);

  if (!visivel) return null;

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onFechar();
  }

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={handleOverlayClick}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        // Animação overlay: fade in / fade out
        saindo ? 'animate-fade-out' : 'animate-fade-in',
        'motion-reduce:animate-none',
      ].join(' ')}
    >
      {/* Painel */}
      <div
        ref={painelRef}
        tabIndex={-1}
        className={[
          'relative w-full max-w-lg overflow-hidden rounded-xl outline-none',
          'bg-white dark:bg-[#1a1a2e]',
          'shadow-2xl shadow-primary/10 dark:shadow-cyan/10',
          // Animação painel: scale in / scale out
          saindo ? 'animate-scale-out' : 'animate-scale-in',
          'motion-reduce:animate-none',
        ].join(' ')}
      >
        {/* Borda gradiente decorativa */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-cyan"
          style={{
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            padding: '2px',
          }}
        />

        {/* Brilho superior */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
        />

        {/* Cabeçalho */}
        {titulo && (
          <div className="relative flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-white/10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="rounded-md p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="relative p-5">{children}</div>
      </div>
    </div>
  );
}
