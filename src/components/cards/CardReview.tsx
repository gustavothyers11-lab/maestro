// Componente CardReview — sessão de revisão premium com botões estilo Clash Royale,
// barra de progresso gradiente animada e layout full-screen escuro

'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Card, ResultadoRevisao } from '@/types';
import { useSRS } from '@/hooks/useSRS';
import { calcularSRS } from '@/lib/srs';
import { calcularPorcentagem, formatarIntervalo } from '@/utils/formatters';
import { createClient } from '@/lib/supabase/client';
import { getLangCode } from '@/utils/idioma';
import FlashCard from './FlashCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CardReviewProps {
  cards: Card[];
  onFinalizar?: () => void;
}

// ---------------------------------------------------------------------------
// Configuração dos botões de resposta — estilo Clash Royale
// ---------------------------------------------------------------------------

interface BotaoConfig {
  resultado: ResultadoRevisao;
  label: string;
  previewLabel: string;
  icone: React.ReactNode;
  bg: string;
  shadow: string;
  hoverBg: string;
  ring: string;
}

const botoesConfig: BotaoConfig[] = [
  {
    resultado: 'errei',
    label: 'ERREI',
    previewLabel: 'Amanhã',
    icone: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    bg: 'bg-gradient-to-b from-red-500 to-red-700',
    shadow: 'shadow-[0_6px_20px_-4px_rgba(239,68,68,0.5)]',
    hoverBg: 'hover:from-red-400 hover:to-red-600',
    ring: 'ring-red-400/30',
  },
  {
    resultado: 'dificil',
    label: 'DIFÍCIL',
    previewLabel: '3 dias',
    icone: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    bg: 'bg-gradient-to-b from-orange-500 to-orange-700',
    shadow: 'shadow-[0_6px_20px_-4px_rgba(249,115,22,0.5)]',
    hoverBg: 'hover:from-orange-400 hover:to-orange-600',
    ring: 'ring-orange-400/30',
  },
  {
    resultado: 'bom',
    label: 'BOM',
    previewLabel: '1 semana',
    icone: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
    bg: 'bg-gradient-to-b from-[#1260CC] to-[#0e4fa8]',
    shadow: 'shadow-[0_6px_20px_-4px_rgba(18,96,204,0.5)]',
    hoverBg: 'hover:from-[#378ADD] hover:to-[#1260CC]',
    ring: 'ring-[#378ADD]/30',
  },
  {
    resultado: 'facil',
    label: 'FÁCIL',
    previewLabel: '2 semanas',
    icone: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    ),
    bg: 'bg-gradient-to-b from-emerald-500 to-emerald-700',
    shadow: 'shadow-[0_6px_20px_-4px_rgba(16,185,129,0.5)]',
    hoverBg: 'hover:from-emerald-400 hover:to-emerald-600',
    ring: 'ring-emerald-400/30',
  },
];

// ---------------------------------------------------------------------------
// Confetti / estrelas (tela de conclusão)
// ---------------------------------------------------------------------------

const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: `${4 + ((i * 17 + 11) % 92)}%`,
  dur: `${2.2 + (i % 4) * 0.5}s`,
  delay: `${(i * 0.12).toFixed(2)}s`,
  size: i % 3 === 0 ? 10 : i % 3 === 1 ? 14 : 8,
  char: ['★', '✦', '✧', '⬥', '●'][i % 5],
  color: [
    'text-amber-400', 'text-cyan', 'text-primary', 'text-emerald-400',
    'text-pink-400', 'text-orange-400', 'text-yellow-300', 'text-violet-400',
  ][i % 8],
}));

function ConfettiAnimado() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className={`review-confetti-particle absolute motion-reduce:hidden ${c.color}`}
          style={{
            left: c.left,
            top: '-8%',
            fontSize: c.size,
            '--confetti-dur': c.dur,
            '--confetti-delay': c.delay,
          } as React.CSSProperties}
        >
          {c.char}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook de contagem animada (XP)
// ---------------------------------------------------------------------------

function useContagem(alvo: number, duracao = 1200) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (alvo === 0) return;
    let cancelado = false;
    const inicio = performance.now();

    function frame(agora: number) {
      if (cancelado) return;
      const progresso = Math.min((agora - inicio) / duracao, 1);
      const eased = 1 - (1 - progresso) * (1 - progresso);
      setValor(Math.round(eased * alvo));
      if (progresso < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
    return () => { cancelado = true; };
  }, [alvo, duracao]);

  return valor;
}

// ---------------------------------------------------------------------------
// Web Speech API — TTS helper
// ---------------------------------------------------------------------------

function falarTexto(texto: string, lang = 'es-ES') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = lang;
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Modal de confirmação para sair
// ---------------------------------------------------------------------------

function ModalSair({
  aberto,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm review-modal-overlay"
        onClick={onCancelar}
      />
      <div className="review-modal-card relative z-10 mx-4 w-full max-w-xs rounded-2xl border border-white/[0.06] bg-[#1e1e38] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white">Sair da sessão?</h3>
        <p className="mt-2 text-sm text-white/40">
          Seu progresso nesta sessão será perdido.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-semibold text-white/60 transition-colors duration-150 hover:bg-white/[0.08]"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/20 transition-all duration-150 hover:shadow-lg hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.97]"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de progresso premium com gradiente animado
// ---------------------------------------------------------------------------

function BarraProgressoPremium({ porcentagem }: { porcentagem: number }) {
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setLargura(porcentagem));
    return () => cancelAnimationFrame(raf);
  }, [porcentagem]);

  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
      {/* Preenchimento com gradiente animado */}
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${largura}%` }}
      >
        {/* Gradiente animado */}
        <div className="absolute inset-0 rounded-full review-progress-gradient" />
        {/* Brilho no topo */}
        <span className="absolute inset-x-0 top-0 h-px bg-white/40 rounded-full" />
        {/* Shimmer que corre */}
        <span className="absolute inset-0 rounded-full review-progress-shimmer" />
      </div>
      {/* Glow atrás */}
      <div
        className="absolute inset-y-0 left-0 -z-10 rounded-full bg-cyan/20 blur-md transition-all duration-500"
        style={{ width: `${largura}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function CardReview({ cards, onFinalizar }: CardReviewProps) {
  const {
    cardAtual,
    totalCards,
    respondidos,
    sessaoConcluida,
    responder,
  } = useSRS(cards);

  const [langCode, setLangCode] = useState('es-ES');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('idioma').eq('id', user.id).single()
        .then(({ data }) => { if (data?.idioma) setLangCode(getLangCode(data.idioma)); });
    });
  }, []);

  // UI state
  const [virado, setVirado] = useState(false);
  const [animacao, setAnimacao] = useState<'idle' | 'slide-out' | 'slide-in'>('idle');
  const [feedback, setFeedback] = useState<'verde' | 'vermelho' | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const [mostrarBotoes, setMostrarBotoes] = useState(false);
  const [modalSairAberto, setModalSairAberto] = useState(false);
  const [tempoInicio] = useState(() => Date.now());
  const [tempoFinal, setTempoFinal] = useState(0);

  // Estatísticas
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);

  // Card key & timer
  const [cardKey, setCardKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (sessaoConcluida && tempoFinal === 0) setTempoFinal(Date.now());
  }, [sessaoConcluida, tempoFinal]);

  // Calcula preview de intervalos dinâmicos
  const intervalosPreview = useMemo(() => {
    if (!cardAtual) return [];
    return botoesConfig.map((b) => {
      const srs = calcularSRS(cardAtual, b.resultado);
      return formatarIntervalo(srs.intervalo);
    });
  }, [cardAtual]);

  // Mostrar botões quando o card é virado
  useEffect(() => {
    if (virado) {
      const t = setTimeout(() => setMostrarBotoes(true), 100);
      return () => clearTimeout(t);
    }
    setMostrarBotoes(false);
  }, [virado]);

  // Handler: flip + TTS
  const handleFlip = useCallback(() => {
    setVirado((v) => {
      const next = !v;
      if (next && cardAtual) falarTexto(cardAtual.frente, langCode);
      return next;
    });
  }, [cardAtual, langCode]);

  // Handler: responder com animações
  const handleResponder = useCallback(
    async (resultado: ResultadoRevisao) => {
      if (respondendo || !cardAtual) return;
      setRespondendo(true);

      if (resultado === 'errei') setErros((e) => e + 1);
      else setAcertos((a) => a + 1);

      setFeedback(resultado === 'errei' ? 'vermelho' : 'verde');
      setAnimacao('slide-out');
      await new Promise<void>((resolve) => {
        timerRef.current = setTimeout(resolve, 300);
      });

      await responder(resultado);

      setVirado(false);
      setMostrarBotoes(false);
      setFeedback(null);
      setCardKey((k) => k + 1);
      setAnimacao('slide-in');

      timerRef.current = setTimeout(() => {
        setAnimacao('idle');
        setRespondendo(false);
      }, 300);
    },
    [cardAtual, respondendo, responder],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (modalSairAberto || sessaoConcluida) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!virado) handleFlip();
      }
      if (virado && !respondendo) {
        if (e.key === '1') handleResponder('errei');
        if (e.key === '2') handleResponder('dificil');
        if (e.key === '3') handleResponder('bom');
        if (e.key === '4') handleResponder('facil');
      }
      if (e.key === 'Escape') setModalSairAberto(true);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [virado, respondendo, modalSairAberto, sessaoConcluida, handleFlip, handleResponder]);

  // Progresso
  const porcentagem = calcularPorcentagem(respondidos, totalCards);
  const tempoDecorrido = Math.floor(((tempoFinal || Date.now()) - tempoInicio) / 1000);
  const minutos = Math.floor(tempoDecorrido / 60);
  const segundos = tempoDecorrido % 60;

  // XP
  const xpGanho = acertos * 10 + (erros > 0 ? erros * 3 : 0);
  const xpAnimado = useContagem(sessaoConcluida ? xpGanho : 0);
  const precisao = calcularPorcentagem(acertos, totalCards);

  // =========================================================================
  // TELA DE CONCLUSÃO
  // =========================================================================
  if (sessaoConcluida) {
    return (
      <div className="review-conclusao relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 bg-[#0f0f1a]">
        <ConfettiAnimado />

        <div className="review-conclusao-card relative z-10 flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-white/[0.06] bg-[#1a1a2e]/90 backdrop-blur-xl p-8 shadow-2xl">
          {/* Glow de borda */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-primary to-cyan"
            style={{
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '2px',
            }}
          />

          {/* Ícone troféu */}
          <div className="review-trophy flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-300/10 text-5xl shadow-lg shadow-amber-400/10">
            🏆
          </div>

          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Sessão Concluída!
          </h2>

          {/* XP animado */}
          <div className="flex flex-col items-center">
            <span className="review-xp text-6xl font-black tabular-nums bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              +{xpAnimado}
            </span>
            <span className="text-sm font-bold text-amber-400/50 uppercase tracking-widest mt-1">
              XP ganho
            </span>
          </div>

          {/* Resumo 3 colunas */}
          <div className="grid w-full grid-cols-3 gap-3 text-center">
            <div className="review-stat-item rounded-xl bg-emerald-400/[0.08] border border-emerald-400/10 py-3 px-2" style={{ '--review-stat-delay': '200ms' } as React.CSSProperties}>
              <p className="text-2xl font-extrabold text-emerald-400">{acertos}</p>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mt-0.5">✓ Acertos</p>
            </div>
            <div className="review-stat-item rounded-xl bg-red-400/[0.08] border border-red-400/10 py-3 px-2" style={{ '--review-stat-delay': '300ms' } as React.CSSProperties}>
              <p className="text-2xl font-extrabold text-red-400">{erros}</p>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mt-0.5">✗ Erros</p>
            </div>
            <div className="review-stat-item rounded-xl bg-primary/[0.08] border border-primary/10 py-3 px-2" style={{ '--review-stat-delay': '400ms' } as React.CSSProperties}>
              <p className="text-2xl font-extrabold text-cyan tabular-nums">{minutos}:{String(segundos).padStart(2, '0')}</p>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mt-0.5">⏱ Tempo</p>
            </div>
          </div>

          {/* Barra de precisão */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-white/40">Precisão</span>
              <span className="text-white tabular-nums">{precisao}%</span>
            </div>
            <BarraProgressoPremium porcentagem={precisao} />
          </div>

          {/* Botão voltar */}
          <button
            type="button"
            onClick={onFinalizar}
            className="review-btn-voltar w-full rounded-xl bg-gradient-to-r from-primary to-medium py-3.5 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.97]"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // SESSÃO EM ANDAMENTO — layout full-screen escuro
  // =========================================================================
  return (
    <div className="review-session relative flex min-h-screen flex-col items-center bg-[#0f0f1a] overflow-hidden">

      {/* Grid de fundo decorativo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Glow orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary/8 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-cyan/8 blur-3xl" />

      {/* Flash de feedback */}
      {feedback && (
        <div
          aria-hidden="true"
          className={`feedback-flash pointer-events-none fixed inset-0 z-40 ${
            feedback === 'verde' ? 'bg-emerald-500/15' : 'bg-red-500/15'
          } motion-reduce:hidden`}
        />
      )}

      {/* Modal de saída */}
      <ModalSair
        aberto={modalSairAberto}
        onConfirmar={() => { setModalSairAberto(false); onFinalizar?.(); }}
        onCancelar={() => setModalSairAberto(false)}
      />

      {/* ─── BARRA TOPO ────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-lg px-4 pt-6 space-y-3">
        {/* Header: contador + botão sair */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              Card{' '}
              <span className="tabular-nums text-cyan">
                {Math.min(respondidos + 1, totalCards)}
              </span>
              {' '}de{' '}
              <span className="tabular-nums text-white/60">{totalCards}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setModalSairAberto(true)}
            aria-label="Sair da sessão"
            className="review-btn-exit flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/30 transition-all duration-150 hover:bg-red-500/15 hover:border-red-500/20 hover:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Barra de progresso premium */}
        <BarraProgressoPremium porcentagem={porcentagem} />
      </div>

      {/* ─── FLASHCARD CENTRAL ─────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 items-center justify-center w-full max-w-lg px-4 py-6">
        <div
          className={[
            'w-full',
            animacao === 'slide-out' ? 'card-slide-out' : '',
            animacao === 'slide-in' ? 'card-slide-in' : '',
            'motion-reduce:!animate-none',
          ].join(' ')}
        >
          {cardAtual && (
            <FlashCard
              key={cardKey}
              card={cardAtual}
              onFlip={handleFlip}
            />
          )}
        </div>
      </div>

      {/* ─── BOTÕES DE RESPOSTA — estilo Clash Royale ──────────── */}
      <div
        className={[
          'relative z-10 w-full max-w-lg px-4 pb-8 transition-all duration-400',
          virado
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-8 opacity-0',
          'motion-reduce:transition-none',
        ].join(' ')}
      >
        {/* Label */}
        <p className="text-center text-xs font-bold text-white/25 uppercase tracking-[0.2em] mb-4">
          Como foi?
        </p>

        {/* Grid 4 botões */}
        <div className="grid grid-cols-4 gap-3">
          {botoesConfig.map((btn, i) => (
            <BotaoResposta
              key={btn.resultado}
              config={btn}
              intervalo={intervalosPreview[i] ?? btn.previewLabel}
              delay={i * 60}
              visivel={mostrarBotoes}
              disabled={respondendo}
              onClick={() => handleResponder(btn.resultado)}
            />
          ))}
        </div>

        {/* Keyboard hints */}
        <div className="mt-4 hidden sm:flex items-center justify-center gap-5 text-[10px] font-semibold text-white/15">
          {['1', '2', '3', '4'].map((k, i) => (
            <span key={k} className="flex items-center gap-1">
              <kbd className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[9px] font-bold">
                {k}
              </kbd>
              {botoesConfig[i].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Botão de resposta individual — estilo Clash Royale
// ---------------------------------------------------------------------------

interface BotaoRespostaProps {
  config: BotaoConfig;
  intervalo: string;
  delay: number;
  visivel: boolean;
  disabled: boolean;
  onClick: () => void;
}

function BotaoResposta({
  config,
  intervalo,
  delay,
  visivel,
  disabled,
  onClick,
}: BotaoRespostaProps) {
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const circle = document.createElement('span');
      circle.className = 'btn-ripple-circle';
      circle.style.width = circle.style.height = `${size}px`;
      circle.style.left = `${e.clientX - rect.left}px`;
      circle.style.top = `${e.clientY - rect.top}px`;
      btn.appendChild(circle);
      circle.addEventListener('animationend', () => circle.remove());
      onClick();
    },
    [onClick],
  );

  return (
    <button
      ref={btnRef}
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={[
        'review-resp-btn btn-ripple flex flex-col items-center gap-2 rounded-2xl py-4 px-1',
        'text-white font-extrabold',
        'ring-1',
        config.bg,
        config.shadow,
        config.hoverBg,
        config.ring,
        'hover:scale-[1.08] hover:brightness-110',
        'active:scale-[0.92] active:transition-transform active:duration-75',
        'transition-all duration-200 ease-out',
        'disabled:opacity-30 disabled:pointer-events-none',
        'motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
      ].join(' ')}
      style={{
        animationDelay: visivel ? `${delay}ms` : '0ms',
        opacity: visivel ? undefined : 0,
      }}
    >
      {/* Ícone */}
      <span className="drop-shadow-md" aria-hidden="true">
        {config.icone}
      </span>
      {/* Label */}
      <span className="text-[13px] tracking-wide">{config.label}</span>
      {/* Intervalo */}
      <span className="text-[10px] font-medium opacity-60 leading-tight">
        {intervalo}
      </span>
    </button>
  );
}
