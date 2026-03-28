// Componente FlashCard — card premium com flip 3D, borda gradiente brilhante,
// badges de gênero + tema, e animações sofisticadas

'use client';

import { useState, useCallback, useRef, type MouseEvent } from 'react';
import type { Card, Genero } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FlashCardProps {
  card: Card;
  onFlip?: () => void;
  /** Exibir nome do tema (Vocabulário, Verbos…) sobre o card */
  temaNome?: string;
}

// ---------------------------------------------------------------------------
// Config de cor por gênero
// ---------------------------------------------------------------------------

interface GeneroConfig {
  label: string;
  badge: string;
  glowColor: string;
}

const generoConfig: Record<Genero, GeneroConfig> = {
  masculino: {
    label: '♂ Masculino',
    badge:
      'bg-blue-500/15 text-blue-400 ring-1 ring-blue-400/30',
    glowColor: 'rgba(59,130,246,0.25)',
  },
  feminino: {
    label: '♀ Feminino',
    badge:
      'bg-pink-500/15 text-pink-400 ring-1 ring-pink-400/30',
    glowColor: 'rgba(236,72,153,0.25)',
  },
  neutro: {
    label: '⊘ Neutro',
    badge:
      'bg-gray-500/15 text-gray-400 ring-1 ring-gray-400/30',
    glowColor: 'rgba(156,163,175,0.15)',
  },
};

// ---------------------------------------------------------------------------
// Ícones de tema
// ---------------------------------------------------------------------------

const TEMA_ICONES: Record<string, string> = {
  'vocabulário': '📚',
  'verbos': '⚡',
  'gramática': '📖',
  'frases': '💬',
  'expressões': '🗣️',
  'cultura': '🌎',
  'gírias': '🎭',
};

// ---------------------------------------------------------------------------
// Ícone de alto-falante + animação de onda
// ---------------------------------------------------------------------------

function AudioButton({ audioUrl }: { audioUrl: string }) {
  const [tocando, setTocando] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const tocar = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (!audioRef.current) audioRef.current = new Audio(audioUrl);
      const audio = audioRef.current;
      audio.currentTime = 0;
      setTocando(true);
      audio.play().catch(() => setTocando(false));
      audio.onended = () => setTocando(false);
    },
    [audioUrl],
  );

  return (
    <button
      type="button"
      onClick={tocar}
      aria-label="Ouvir pronúncia"
      className={[
        'group/audio flex items-center justify-center rounded-full',
        'h-11 w-11',
        'bg-white/10 text-white/70 backdrop-blur-sm',
        'ring-1 ring-white/10',
        'hover:bg-white/15 hover:text-white hover:ring-white/20',
        'transition-all duration-200',
        tocando ? 'animate-pulse-soft ring-cyan/40 text-cyan' : '',
        'motion-reduce:animate-none',
      ].join(' ')}
    >
      {tocando ? (
        <div className="flex items-end gap-[3px] h-4">
          <span className="audio-wave-bar inline-block w-[3px] h-full rounded-full bg-current origin-bottom" />
          <span className="audio-wave-bar inline-block w-[3px] h-full rounded-full bg-current origin-bottom" />
          <span className="audio-wave-bar inline-block w-[3px] h-full rounded-full bg-current origin-bottom" />
        </div>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Componente FlashCard
// ---------------------------------------------------------------------------

export default function FlashCard({ card, onFlip, temaNome }: FlashCardProps) {
  const [virado, setVirado] = useState(false);
  const gc = generoConfig[card.genero];
  const temaKey = temaNome?.toLowerCase() ?? '';
  const temaIcone = TEMA_ICONES[temaKey] ?? '📝';

  const handleFlip = useCallback(() => {
    setVirado((v) => !v);
    onFlip?.();
  }, [onFlip]);

  return (
    <div
      className="flashcard-scene w-full cursor-pointer select-none"
      style={{ height: 420 }}
      onClick={handleFlip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleFlip();
        }
      }}
      aria-label={`Flashcard: ${virado ? 'verso' : 'frente'}`}
    >
      <div className={`flashcard-inner ${virado ? 'flipped' : ''}`}>

        {/* ============================================================= */}
        {/* FRENTE                                                        */}
        {/* ============================================================= */}
        <div className="flashcard-face flashcard-face-styled">
          {/* Borda gradiente animada */}
          <span
            aria-hidden="true"
            className="flashcard-border-glow pointer-events-none absolute inset-0 rounded-3xl"
          />

          {/* Sombra colorida brilhante */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl opacity-50 blur-xl"
            style={{ background: 'linear-gradient(135deg, #1260CC40, #0ABFDE40)' }}
          />

          {/* Glow de gênero no topo */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-32 w-48 rounded-full blur-3xl opacity-40"
            style={{ background: gc.glowColor }}
          />

          {/* Brilho superior */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />

          {/* Conteúdo frente */}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-8 py-8">
            {/* Badges: gênero + tema */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold leading-none ${gc.badge}`}>
                {gc.label}
              </span>
              {temaNome && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold leading-none text-white/60 ring-1 ring-white/10">
                  <span>{temaIcone}</span>
                  {temaNome}
                </span>
              )}
            </div>

            {/* Palavra em espanhol — grande e bold */}
            <p className="text-center text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg leading-tight">
              {card.frente}
            </p>

            {/* Botão de áudio */}
            {card.audioUrl && <AudioButton audioUrl={card.audioUrl} />}

            {/* Dica de flip com ícone animado */}
            <div className="mt-auto flex items-center gap-2 text-white/30">
              <svg className="h-4 w-4 flashcard-flip-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <span className="text-xs font-medium tracking-wide">Toque para virar</span>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* VERSO                                                         */}
        {/* ============================================================= */}
        <div className="flashcard-face flashcard-back flashcard-face-styled">
          {/* Borda gradiente animada (invertida) */}
          <span
            aria-hidden="true"
            className="flashcard-border-glow flashcard-border-glow-reverse pointer-events-none absolute inset-0 rounded-3xl"
          />

          {/* Sombra colorida brilhante */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl opacity-50 blur-xl"
            style={{ background: 'linear-gradient(135deg, #0ABFDE40, #1260CC40)' }}
          />

          {/* Brilho superior */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />

          {/* Conteúdo verso */}
          <div className="relative flex flex-1 flex-col items-center justify-center gap-5 px-8 py-8">
            {/* Label "Tradução" */}
            <span className="text-[11px] font-bold uppercase tracking-widest text-cyan/60">
              Tradução
            </span>

            {/* Tradução */}
            <p className="text-center text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              {card.verso}
            </p>

            {/* Separador animado */}
            <span
              aria-hidden="true"
              className="h-px w-16 bg-gradient-to-r from-transparent via-cyan/40 to-transparent"
            />

            {/* Exemplo / notas */}
            {card.notas && (
              <div className="w-full max-w-xs rounded-xl bg-white/[0.04] border border-white/[0.06] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/30 mb-1">
                  Exemplo de uso
                </p>
                <p className="text-sm leading-relaxed text-white/60 italic">
                  {card.notas}
                </p>
              </div>
            )}

            {/* Rodapé */}
            <div className="mt-auto flex items-center gap-2 text-white/30">
              <svg className="h-4 w-4 flashcard-flip-hint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
              <span className="text-xs font-medium tracking-wide">Toque para voltar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
