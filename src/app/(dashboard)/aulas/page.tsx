// Página de aulas — fluxo em 3 etapas: transcrição → resumo → revisão de cards

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import type { Genero } from '@/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CardGerado {
  frente: string;
  verso: string;
  exemplo: string;
  genero: Genero;
  tema: string;
}

type Etapa = 1 | 2 | 3;
type Direcao = 'next' | 'prev';

const TEMAS_DISPONIVEIS = ['Vocabulário', 'Verbos', 'Frases', 'Gírias', 'Expressões'] as const;

// ---------------------------------------------------------------------------
// Stepper visual
// ---------------------------------------------------------------------------

function Stepper({ etapa }: { etapa: Etapa }) {
  const labels = ['Transcrição', 'Resumo', 'Revisão'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {labels.map((label, i) => {
        const num = (i + 1) as Etapa;
        const ativo = num === etapa;
        const completo = num < etapa;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`
                  stepper-line w-10 sm:w-16 h-0.5 transition-colors duration-500
                  ${completo ? 'bg-gradient-to-r from-primary to-cyan' : 'bg-white/10'}
                `}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  stepper-circle flex items-center justify-center
                  h-9 w-9 rounded-full text-xs font-bold
                  border-2 transition-all duration-400
                  ${
                    ativo
                      ? 'border-cyan bg-cyan/20 text-cyan shadow-[0_0_12px_rgba(10,191,222,0.4)] scale-110'
                      : completo
                        ? 'border-primary bg-primary text-white'
                        : 'border-white/20 bg-white/5 text-white/40'
                  }
                `}
              >
                {completo ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-semibold transition-colors duration-300 ${
                  ativo ? 'text-cyan' : completo ? 'text-white/70' : 'text-white/30'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner de loading
// ---------------------------------------------------------------------------

function GerandoSpinner() {
  return (
    <div className="aula-fade-in flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative h-16 w-16">
        <div className="aula-spinner absolute inset-0 rounded-full border-[3px] border-white/10 border-t-cyan" />
        <div className="aula-spinner-inner absolute inset-2 rounded-full border-[3px] border-white/10 border-b-primary" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🤖</span>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-white/80">Grok está analisando a transcrição…</p>
        <p className="text-xs text-white/40">Gerando flashcards de alta qualidade</p>
      </div>
      {/* Barras de "onda" animadas */}
      <div className="flex items-end gap-1 h-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-primary to-cyan"
            style={{
              animation: `audioWave 600ms ease-in-out infinite ${i * 120}ms`,
              height: '100%',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 1 — Inserir transcrição
// ---------------------------------------------------------------------------

function EtapaTranscricao({
  titulo,
  setTitulo,
  transcricao,
  setTranscricao,
  quantidade,
  setQuantidade,
  temasSelecionados,
  toggleTema,
  onGerar,
}: {
  titulo: string;
  setTitulo: (v: string) => void;
  transcricao: string;
  setTranscricao: (v: string) => void;
  quantidade: number;
  setQuantidade: (v: number) => void;
  temasSelecionados: string[];
  toggleTema: (t: string) => void;
  onGerar: () => void;
}) {
  const valido = transcricao.trim().length > 20 && titulo.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Título */}
      <div className="space-y-1.5">
        <label htmlFor="titulo-aula" className="text-xs font-bold uppercase tracking-wide text-white/50">
          Título da aula
        </label>
        <input
          id="titulo-aula"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Aula 5 — Verbos irregulares"
          maxLength={120}
          className="
            w-full rounded-xl border border-white/10 bg-white/5
            px-4 py-3 text-sm text-white placeholder-white/30
            outline-none transition-all duration-200
            focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20
            hover:border-white/20
          "
        />
      </div>

      {/* Transcrição */}
      <div className="space-y-1.5">
        <label htmlFor="transcricao" className="text-xs font-bold uppercase tracking-wide text-white/50">
          Transcrição da aula
        </label>
        <textarea
          id="transcricao"
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
          placeholder="Cole aqui a transcrição completa da aula…"
          rows={10}
          className="
            w-full rounded-xl border border-white/10 bg-white/5
            px-4 py-3 text-sm text-white placeholder-white/30
            outline-none transition-all duration-200 resize-y min-h-[160px]
            focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20
            hover:border-white/20
          "
        />
        <p className="text-right text-[11px] tabular-nums text-white/30">
          {transcricao.length.toLocaleString()} caracteres
        </p>
      </div>

      {/* Slider quantidade */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="quantidade" className="text-xs font-bold uppercase tracking-wide text-white/50">
            Quantidade de cards
          </label>
          <span className="text-sm font-extrabold text-cyan tabular-nums">{quantidade}</span>
        </div>
        <input
          id="quantidade"
          type="range"
          min={5}
          max={20}
          step={1}
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="aula-slider w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10"
        />
        <div className="flex justify-between text-[10px] text-white/30 tabular-nums">
          <span>5</span>
          <span>20</span>
        </div>
      </div>

      {/* Temas */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-white/50">Temas</p>
        <div className="flex flex-wrap gap-2">
          {TEMAS_DISPONIVEIS.map((tema) => {
            const ativo = temasSelecionados.includes(tema);
            return (
              <button
                key={tema}
                type="button"
                onClick={() => toggleTema(tema)}
                className={`
                  btn-ripple relative overflow-hidden
                  rounded-lg px-3 py-1.5 text-xs font-semibold
                  border transition-all duration-200
                  ${
                    ativo
                      ? 'border-cyan/50 bg-cyan/15 text-cyan shadow-[0_0_8px_rgba(10,191,222,0.2)]'
                      : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70'
                  }
                `}
              >
                {ativo && <span className="mr-1">✓</span>}
                {tema}
              </button>
            );
          })}
        </div>
      </div>

      {/* Botão Gerar */}
      <button
        type="button"
        disabled={!valido}
        onClick={onGerar}
        className="
          btn-ripple relative overflow-hidden
          w-full rounded-xl py-3.5 text-sm font-bold text-white
          bg-gradient-to-r from-primary via-medium to-cyan
          shadow-lg shadow-primary/25
          hover:shadow-xl hover:shadow-cyan/30
          active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg
          transition-all duration-200
        "
      >
        <span className="relative flex items-center justify-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          Gerar Cards com IA
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2 — Resumo da aula
// ---------------------------------------------------------------------------

function EtapaResumo({
  resumo,
  totalCards,
  onConfirmar,
  onVoltar,
}: {
  resumo: string;
  totalCards: number;
  onConfirmar: () => void;
  onVoltar: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card variante="highlighted" className="!bg-[#1a1a2e]">
        <div className="flex items-start gap-4">
          {/* Ícone animado */}
          <div className="aula-book-icon flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl">
            📖
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-wide">
              Resumo da aula
            </h3>
            <p className="text-sm leading-relaxed text-white/80">{resumo}</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-2xl font-extrabold text-cyan tabular-nums">{totalCards}</p>
          <p className="text-[11px] text-white/45 mt-1">Cards gerados</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
          <p className="text-2xl font-extrabold text-amber-400">🤖</p>
          <p className="text-[11px] text-white/45 mt-1">Via Grok AI</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="
            btn-ripple relative overflow-hidden flex-1
            rounded-xl py-3 text-sm font-semibold
            border border-white/10 bg-white/5 text-white/60
            hover:bg-white/10 hover:text-white/80
            transition-all duration-200
          "
        >
          ← Voltar e editar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          className="
            btn-ripple relative overflow-hidden flex-[2]
            rounded-xl py-3 text-sm font-bold text-white
            bg-gradient-to-r from-primary to-cyan
            shadow-lg shadow-primary/25
            hover:shadow-xl hover:shadow-cyan/30
            active:scale-[0.98]
            transition-all duration-200
          "
        >
          Confirmar e ver cards →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 3 — Revisão card a card
// ---------------------------------------------------------------------------

function FlashCardPreview({
  card,
  flipped,
  onFlip,
}: {
  card: CardGerado;
  flipped: boolean;
  onFlip: () => void;
}) {
  const corGenero: Record<string, string> = {
    masculino: 'border-blue-400/50',
    feminino: 'border-pink-400/50',
    neutro: 'border-white/10',
  };

  return (
    <div className="flashcard-scene w-full" style={{ height: '260px' }}>
      <div
        className={`flashcard-inner cursor-pointer ${flipped ? 'flipped' : ''}`}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === ' ' && onFlip()}
      >
        {/* Frente */}
        <div
          className={`
            flashcard-face rounded-2xl border-2 ${corGenero[card.genero]}
            bg-gradient-to-br from-[#1a1a2e] to-[#12122a]
            flex flex-col items-center justify-center p-6 text-center
          `}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
            {card.tema}
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">{card.frente}</p>
          <span className="mt-4 text-[10px] text-white/25">toque para virar</span>
        </div>

        {/* Verso */}
        <div
          className={`
            flashcard-face flashcard-back rounded-2xl border-2 ${corGenero[card.genero]}
            bg-gradient-to-br from-[#1e1e38] to-[#16162e]
            flex flex-col items-center justify-center p-6 text-center
          `}
        >
          <p className="text-xl sm:text-2xl font-bold text-cyan">{card.verso}</p>
          <div className="mt-4 rounded-lg bg-white/5 px-4 py-2">
            <p className="text-xs text-white/50 italic">&ldquo;{card.exemplo}&rdquo;</p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40">
            {card.genero === 'masculino' ? '♂ Masculino' : card.genero === 'feminino' ? '♀ Feminino' : '⊘ Neutro'}
          </span>
        </div>
      </div>
    </div>
  );
}

function EtapaRevisao({
  cards,
  onFinalizar,
  onVoltar,
}: {
  cards: CardGerado[];
  onFinalizar: (aprovados: CardGerado[]) => void;
  onVoltar: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [aprovados, setAprovados] = useState<CardGerado[]>([]);
  const [deletados, setDeletados] = useState(0);
  const [animDir, setAnimDir] = useState<'in' | 'out-left' | 'out-right'>('in');
  const [concluido, setConcluido] = useState(false);

  const total = cards.length;
  const cardAtual = cards[indice];
  const progresso = total > 0 ? Math.round(((aprovados.length + deletados) / total) * 100) : 0;

  const avancar = useCallback(
    (aprovado: boolean) => {
      const dir = aprovado ? 'out-left' : 'out-right';
      setAnimDir(dir);

      setTimeout(() => {
        if (aprovado && cardAtual) setAprovados((prev) => [...prev, cardAtual]);
        else setDeletados((prev) => prev + 1);

        if (indice + 1 >= total) {
          setConcluido(true);
        } else {
          setIndice((prev) => prev + 1);
          setFlipped(false);
          setAnimDir('in');
        }
      }, 280);
    },
    [cardAtual, indice, total],
  );

  /* ── Tela de conclusão ──────────────────────────────────────────── */
  if (concluido) {
    const totalAprovados = aprovados.length;
    return (
      <div className="aula-fade-in space-y-6 text-center">
        {/* confetti simples */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="meta-confetti absolute"
              style={{
                '--hue': `${i * 30}`,
                '--dur': `${1.5 + (i % 3) * 0.5}s`,
                '--delay': `${i * 0.08}s`,
                left: `${8 + i * 7}%`,
                top: '-10px',
              } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-extrabold text-white">Revisão Concluída!</h2>

        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
            <p className="text-2xl font-extrabold text-green-400 tabular-nums">{totalAprovados}</p>
            <p className="text-[11px] text-green-300/60">Aprovados</p>
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-2xl font-extrabold text-red-400 tabular-nums">{deletados}</p>
            <p className="text-[11px] text-red-300/60">Deletados</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFinalizar(aprovados)}
          disabled={totalAprovados === 0}
          className="
            btn-ripple relative overflow-hidden
            w-full rounded-xl py-3.5 text-sm font-bold text-white
            bg-gradient-to-r from-green-500 to-emerald-400
            shadow-lg shadow-green-500/25
            hover:shadow-xl hover:shadow-green-400/30
            active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          <span className="relative flex items-center justify-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Salvar {totalAprovados} card{totalAprovados !== 1 ? 's' : ''} aprovado{totalAprovados !== 1 ? 's' : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={onVoltar}
          className="text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          ← Gerar novos cards
        </button>
      </div>
    );
  }

  /* ── Revisão card a card ───────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Contador + barra */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white/60">
            Card <span className="text-cyan tabular-nums">{indice + 1}</span> de{' '}
            <span className="tabular-nums">{total}</span>
          </span>
          <span className="font-semibold text-white/40 tabular-nums">{progresso}%</span>
        </div>
        <ProgressBar valor={progresso} variante="default" />
      </div>

      {/* Card animado */}
      <div
        className={`
          ${animDir === 'in' ? 'aula-card-enter' : ''}
          ${animDir === 'out-left' ? 'aula-card-exit-left' : ''}
          ${animDir === 'out-right' ? 'aula-card-exit-right' : ''}
        `}
      >
        {cardAtual && (
          <FlashCardPreview
            card={cardAtual}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
        )}
      </div>

      {/* Botões aprovar / deletar */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => avancar(false)}
          className="
            btn-ripple relative overflow-hidden flex-1
            rounded-xl py-3.5 text-sm font-bold
            border-2 border-red-500/30 bg-red-500/10 text-red-400
            hover:bg-red-500/20 hover:border-red-500/50
            active:scale-[0.96]
            transition-all duration-200
          "
        >
          ✗ Deletar
        </button>
        <button
          type="button"
          onClick={() => avancar(true)}
          className="
            btn-ripple relative overflow-hidden flex-[2]
            rounded-xl py-3.5 text-sm font-bold
            border-2 border-green-500/30 bg-green-500/10 text-green-400
            hover:bg-green-500/20 hover:border-green-500/50
            active:scale-[0.96]
            transition-all duration-200
          "
        >
          ✓ Aprovar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function AulasPage() {
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [direcao, setDirecao] = useState<Direcao>('next');

  // Etapa 1
  const [titulo, setTitulo] = useState('');
  const [transcricao, setTranscricao] = useState('');
  const [quantidade, setQuantidade] = useState(10);
  const [temasSelecionados, setTemasSelecionados] = useState<string[]>([]);

  // Etapa 2
  const [resumo, setResumo] = useState('');
  const [cardsGerados, setCardsGerados] = useState<CardGerado[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // Etapa 3
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  const toggleTema = useCallback((tema: string) => {
    setTemasSelecionados((prev) =>
      prev.includes(tema) ? prev.filter((t) => t !== tema) : [...prev, tema],
    );
  }, []);

  const irPara = useCallback((e: Etapa, dir: Direcao) => {
    setDirecao(dir);
    setEtapa(e);
  }, []);

  /* ── Gerar cards via API ─────────────────────────────────────────── */
  const gerarCards = useCallback(async () => {
    setGerando(true);
    setErro('');

    try {
      const res = await fetch('/api/cards/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcricao,
          quantidade,
          temas: temasSelecionados.length > 0 ? temasSelecionados : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      setCardsGerados(data.cards);
      setResumo(data.resumo || 'Resumo não disponível.');
      irPara(2, 'next');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido ao gerar cards.');
    } finally {
      setGerando(false);
    }
  }, [transcricao, quantidade, temasSelecionados, irPara]);

  /* ── Salvar cards aprovados ──────────────────────────────────────── */
  const salvarCards = useCallback(async (aprovados: CardGerado[]) => {
    setSalvando(true);
    setErro('');
    try {
      const aulaRes = await fetch('/api/aulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          transcricao,
          resumo,
          status: 'concluida',
        }),
      });

      const aulaData = await aulaRes.json().catch(() => ({}));
      if (!aulaRes.ok || !aulaData.aula?.id) {
        throw new Error(aulaData.error || `Erro ${aulaRes.status} ao criar aula.`);
      }

      const aulaId = aulaData.aula.id as string;

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: aprovados.map((c) => ({
            frente: c.frente,
            verso: c.verso,
            genero: c.genero,
            notas: c.exemplo || null,
            aulaId,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }
      setSalvoOk(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar cards.');
    } finally {
      setSalvando(false);
    }
  }, [titulo, transcricao, resumo]);

  /* ── Resetar todo o fluxo ────────────────────────────────────────── */
  const resetar = useCallback(() => {
    setEtapa(1);
    setDirecao('next');
    setTitulo('');
    setTranscricao('');
    setQuantidade(10);
    setTemasSelecionados([]);
    setResumo('');
    setCardsGerados([]);
    setErro('');
    setSalvoOk(false);
  }, []);

  /* ── Classe de slide animado ─────────────────────────────────────── */
  const slideClass = direcao === 'next' ? 'aula-slide-left' : 'aula-slide-right';

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="w-full min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 aula-fade-in">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Dashboard
          </Link>
          <h1 className="text-lg font-extrabold">
            <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
              Nova Aula
            </span>
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>

        {/* Stepper */}
        <Stepper etapa={etapa} />

        {/* Tela de salvo */}
        {salvoOk && (
          <div className="aula-fade-in text-center space-y-6 py-12">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-extrabold text-white">Cards salvos com sucesso!</h2>
            <p className="text-sm text-white/50">
              Seus flashcards já estão prontos para revisão.
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Link
                href="/estudar"
                className="
                  flex items-center justify-center gap-2
                  rounded-xl py-3 text-sm font-bold text-white
                  bg-gradient-to-r from-primary to-cyan
                  shadow-lg shadow-primary/25
                  hover:shadow-xl transition-all duration-200
                "
              >
                📚 Estudar agora
              </Link>
              <button
                type="button"
                onClick={resetar}
                className="rounded-xl py-3 text-sm font-semibold text-white/50 border border-white/10 hover:bg-white/5 transition-all duration-200"
              >
                + Nova aula
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo da etapa */}
        {!salvoOk && (
          <div className="relative overflow-hidden">
            {/* Erro */}
            {erro && (
              <div className="aula-fade-in mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <p className="font-semibold">Erro ao gerar cards</p>
                <p className="text-xs text-red-300/70 mt-1">{erro}</p>
              </div>
            )}

            {gerando && <GerandoSpinner />}

            {salvando && (
              <div className="aula-fade-in flex flex-col items-center justify-center py-20 gap-4">
                <div className="aula-spinner h-10 w-10 rounded-full border-[3px] border-white/10 border-t-green-400" />
                <p className="text-sm font-semibold text-white/60">Salvando cards…</p>
              </div>
            )}

            {!gerando && !salvando && (
              <div key={etapa} className={slideClass}>
                {etapa === 1 && (
                  <EtapaTranscricao
                    titulo={titulo}
                    setTitulo={setTitulo}
                    transcricao={transcricao}
                    setTranscricao={setTranscricao}
                    quantidade={quantidade}
                    setQuantidade={setQuantidade}
                    temasSelecionados={temasSelecionados}
                    toggleTema={toggleTema}
                    onGerar={gerarCards}
                  />
                )}
                {etapa === 2 && (
                  <EtapaResumo
                    resumo={resumo}
                    totalCards={cardsGerados.length}
                    onConfirmar={() => irPara(3, 'next')}
                    onVoltar={() => irPara(1, 'prev')}
                  />
                )}
                {etapa === 3 && (
                  <EtapaRevisao
                    cards={cardsGerados}
                    onFinalizar={salvarCards}
                    onVoltar={resetar}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
