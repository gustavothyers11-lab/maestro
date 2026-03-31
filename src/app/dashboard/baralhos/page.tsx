// Página de baralhos — listagem, criação e gerenciamento de baralhos de flashcards

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Baralho } from '@/types';
import Modal from '@/components/ui/Modal';

// ---------------------------------------------------------------------------
// Temas & Cores disponíveis
// ---------------------------------------------------------------------------

const TEMAS = [
  'Vocabulário',
  'Verbos',
  'Gramática',
  'Frases',
  'Expressões',
  'Cultura',
  'Outro',
] as const;

interface OpcaoCor {
  hex: string;
  nome: string;
}

const CORES: OpcaoCor[] = [
  { hex: '#1260CC', nome: 'Azul' },
  { hex: '#0ABFDE', nome: 'Ciano' },
  { hex: '#7C3AED', nome: 'Roxo' },
  { hex: '#059669', nome: 'Verde' },
  { hex: '#EA580C', nome: 'Laranja' },
  { hex: '#DC2626', nome: 'Vermelho' },
];

// ---------------------------------------------------------------------------
// Ícones por tema (SVG inline)
// ---------------------------------------------------------------------------

const TEMA_ICONES: Record<string, string> = {
  Vocabulário: '📚',
  Verbos: '⚡',
  Gramática: '📐',
  Frases: '💬',
  Expressões: '🎭',
  Cultura: '🌎',
  Outro: '📝',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gera uma cor mais clara para o gradiente de fundo */
function corClara(hex: string, opacidade: number = 0.15): string {
  return `${hex}${Math.round(opacidade * 255).toString(16).padStart(2, '0')}`;
}

/** Calcula % dominados (mock: baseado em cards revisados / total) */
function porcentagemDominados(b: Baralho): number {
  if (b.totalCards === 0) return 0;
  return Math.round((b.cardsRevisados / b.totalCards) * 100);
}

// ---------------------------------------------------------------------------
// Skeleton de carregamento
// ---------------------------------------------------------------------------

function BaralhoSkeleton({ index }: { index: number }) {
  return (
    <div
      className="baralho-card-stagger rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 animate-pulse"
      style={{ '--baralho-stagger-delay': `${index * 80}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-32 rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="h-3.5 w-20 rounded bg-gray-100 dark:bg-white/[0.06]" />
        </div>
        <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="h-3 w-full rounded bg-gray-100 dark:bg-white/[0.06]" />
        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-white/[0.06]" />
      </div>
      <div className="mt-5 flex gap-2">
        <div className="h-9 flex-1 rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
        <div className="h-9 flex-1 rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de baralho individual
// ---------------------------------------------------------------------------

function BaralhoCard({
  baralho,
  index,
  onEstudar,
  onVerCards,
  onExcluir,
  excluindo,
}: {
  baralho: Baralho;
  index: number;
  onEstudar: (id: string) => void;
  onVerCards: (id: string) => void;
  onExcluir: (id: string) => void;
  excluindo: boolean;
}) {
  const pct = porcentagemDominados(baralho);
  const icone = TEMA_ICONES[baralho.tema] ?? '📝';

  return (
    <div
      className="baralho-card-stagger baralho-card group relative rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-1 hover:border-gray-300/80 dark:hover:border-white/[0.1]"
      style={{ '--baralho-stagger-delay': `${index * 80}ms` } as React.CSSProperties}
    >
      {/* Faixa de cor no topo */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${baralho.cor}, ${baralho.cor}88)` }}
      />

      {/* Fundo gradiente sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse at top left, ${corClara(baralho.cor, 0.08)}, transparent 70%)`,
        }}
      />

      <div className="relative p-5">
        {/* Header: nome + ícone + lixeira */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-gray-900 dark:text-white">
              {baralho.nome}
            </h3>
            <span
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: corClara(baralho.cor, 0.12),
                color: baralho.cor,
              }}
            >
              {baralho.tema}
            </span>
          </div>

          {/* Ícone do tema */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3"
              style={{
                backgroundColor: corClara(baralho.cor, 0.12),
              }}
            >
              {icone}
            </div>
            {/* Botão lixeira */}
            <button
              type="button"
              title="Excluir baralho"
              onClick={() => onExcluir(baralho.id)}
              disabled={excluindo}
              className="mt-2 flex items-center justify-center rounded-lg border border-red-200 dark:border-red-500/20 bg-white dark:bg-[#1a1a35] p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {excluindo ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-gray-500 dark:text-white/40">
              {baralho.totalCards} card{baralho.totalCards !== 1 ? 's' : ''}
            </span>
            <span
              className="tabular-nums font-bold"
              style={{ color: baralho.cor }}
            >
              {pct}% dominados
            </span>
          </div>

          {/* Barra de progresso colorida */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <div
              className="baralho-progress-fill absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${baralho.cor}, ${baralho.cor}cc)`,
              }}
            />
            {/* Glow */}
            <div
              className="absolute inset-y-0 left-0 rounded-full blur-sm opacity-40 transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: baralho.cor,
              }}
            />
          </div>
        </div>

        {/* Botões */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => onEstudar(baralho.id)}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition-all duration-150 hover:shadow-lg hover:brightness-110 active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, ${baralho.cor}, ${baralho.cor}dd)`,
              boxShadow: `0 4px 12px ${corClara(baralho.cor, 0.3)}`,
            }}
          >
            Estudar
          </button>
          <button
            type="button"
            onClick={() => onVerCards(baralho.id)}
            className="flex-1 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] py-2.5 text-sm font-semibold text-gray-700 dark:text-white/60 transition-all duration-150 hover:bg-gray-100 dark:hover:bg-white/[0.08] active:scale-[0.97]"
          >
            Ver cards
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado vazio
// ---------------------------------------------------------------------------

function EstadoVazio({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="baralho-empty flex flex-col items-center justify-center py-20 px-4">
      {/* Ilustração CSS — cards empilhados */}
      <div className="relative mb-6 h-28 w-36">
        <div
          className="baralho-empty-card absolute left-3 top-2 h-20 w-28 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] rotate-[-6deg]"
          style={{ '--empty-delay': '0ms' } as React.CSSProperties}
        />
        <div
          className="baralho-empty-card absolute left-5 top-1 h-20 w-28 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] rotate-[3deg]"
          style={{ '--empty-delay': '100ms' } as React.CSSProperties}
        />
        <div
          className="baralho-empty-card absolute left-4 top-0 h-20 w-28 rounded-xl border-2 border-dashed border-primary/30 dark:border-cyan/20 bg-primary/5 dark:bg-cyan/5 flex items-center justify-center"
          style={{ '--empty-delay': '200ms' } as React.CSSProperties}
        >
          <span className="text-2xl">🃏</span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
        Nenhum baralho ainda
      </h3>
      <p className="mt-2 text-sm text-gray-500 dark:text-white/40 text-center max-w-xs">
        Crie seu primeiro baralho para começar a organizar seus flashcards.
      </p>

      <button
        type="button"
        onClick={onCriar}
        className="baralho-empty-btn mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-medium px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] active:scale-[0.97]"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Criar primeiro baralho
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal: Novo Baralho
// ---------------------------------------------------------------------------

function ModalNovoBaralho({
  aberto,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriado: (b: Baralho) => void;
}) {
  const [nome, setNome] = useState('');
  const [tema, setTema] = useState<string>(TEMAS[0]);
  const [cor, setCor] = useState(CORES[0].hex);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (aberto) {
      setNome('');
      setTema(TEMAS[0]);
      setCor(CORES[0].hex);
      setErro('');
    }
  }, [aberto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) {
      setErro('Digite um nome para o baralho.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const res = await fetch('/api/baralhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeTrimmed, tema, cor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar baralho.');
      onCriado(data.baralho ?? data);
      onFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar baralho.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Novo Baralho">
      <form onSubmit={handleSubmit} className="space-y-5">
        {erro && (
          <p className="rounded-lg bg-red-50 dark:bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}

        {/* Nome */}
        <div className="space-y-1.5">
          <label htmlFor="nome-baralho" className="block text-sm font-semibold text-gray-700 dark:text-white/60">
            Nome
          </label>
          <input
            id="nome-baralho"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Vocabulário básico"
            className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition-all duration-150 focus:border-primary dark:focus:border-cyan focus:ring-2 focus:ring-primary/20 dark:focus:ring-cyan/20"
            autoFocus
          />
        </div>

        {/* Tema */}
        <div className="space-y-1.5">
          <label htmlFor="tema-baralho" className="block text-sm font-semibold text-gray-700 dark:text-white/60">
            Tema
          </label>
          <div className="relative">
            <select
              id="tema-baralho"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-4 py-3 pr-10 text-sm text-gray-900 dark:text-white outline-none transition-all duration-150 focus:border-primary dark:focus:border-cyan focus:ring-2 focus:ring-primary/20 dark:focus:ring-cyan/20"
            >
              {TEMAS.map((t) => (
                <option key={t} value={t}>
                  {TEMA_ICONES[t]} {t}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Cor */}
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-gray-700 dark:text-white/60">
            Cor
          </span>
          <div className="flex flex-wrap gap-3">
            {CORES.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setCor(c.hex)}
                aria-label={c.nome}
                className={[
                  'baralho-cor-btn relative h-9 w-9 rounded-full transition-all duration-150',
                  cor === c.hex
                    ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a2e] scale-110'
                    : 'hover:scale-110',
                ].join(' ')}
                style={{
                  backgroundColor: c.hex,
                  ...(cor === c.hex ? { ringColor: c.hex, boxShadow: `0 0 0 2px ${c.hex}` } : {}),
                }}
              >
                {cor === c.hex && (
                  <svg
                    className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-medium py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {salvando ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Criando…
            </span>
          ) : (
            'Criar Baralho'
          )}
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Componente da página
// ---------------------------------------------------------------------------

export default function BaralhosPage() {
  const router = useRouter();
  const [baralhos, setBaralhos] = useState<Baralho[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch baralhos
  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/baralhos');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
      setBaralhos(data.baralhos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar baralhos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleCriado = useCallback((novoBaralho: Baralho) => {
    setBaralhos((prev) => [novoBaralho, ...prev]);
  }, []);

  const handleEstudar = useCallback(
    (id: string) => {
      router.push(`/dashboard/estudar?baralho=${id}`);
    },
    [router],
  );

  const handleVerCards = useCallback(
    (id: string) => {
      router.push(`/dashboard/baralhos/${id}`);
    },
    [router],
  );

  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const handleExcluir = useCallback(async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este baralho? Essa ação não pode ser desfeita.')) return;
    setExcluindoId(id);
    try {
      const res = await fetch('/api/baralhos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao excluir baralho.');
      }
      setBaralhos((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir baralho.');
    } finally {
      setExcluindoId(null);
    }
  }, []);

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="baralhos-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

      {/* ─── HEADER ────────────────────────────────────────────── */}
      <div className="baralhos-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-medium to-cyan bg-clip-text text-transparent">
              Meus Baralhos
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
            {loading
              ? 'Carregando…'
              : baralhos.length > 0
                ? `${baralhos.length} baralho${baralhos.length !== 1 ? 's' : ''} · ${baralhos.reduce((s, b) => s + b.totalCards, 0)} cards no total`
                : 'Organize seus flashcards por tema'}
          </p>
        </div>

        {/* Botão Novo Baralho */}
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="baralhos-btn-novo inline-flex items-center gap-2 self-start rounded-xl bg-gradient-to-r from-primary to-medium px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.03] active:scale-[0.97]"
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Baralho
        </button>
      </div>

      {/* ─── CONTEÚDO PRINCIPAL ─────────────────────────────────── */}
      {loading && !mounted ? (
        /* Skeleton inicial */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <BaralhoSkeleton key={i} index={i} />
          ))}
        </div>
      ) : loading ? (
        /* Skeleton quando recarregando */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <BaralhoSkeleton key={i} index={i} />
          ))}
        </div>
      ) : error ? (
        /* Erro */
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10 text-2xl">
            ⚠️
          </div>
          <p className="text-sm text-red-500 dark:text-red-400 text-center max-w-xs">{error}</p>
          <button
            type="button"
            onClick={carregar}
            className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-5 py-2 text-sm font-semibold text-gray-700 dark:text-white/60 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.08]"
          >
            Tentar novamente
          </button>
        </div>
      ) : baralhos.length === 0 ? (
        /* Estado vazio */
        <EstadoVazio onCriar={() => setModalAberto(true)} />
      ) : (
        /* Grid de baralhos */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {baralhos.map((b, i) => (
            <BaralhoCard
              key={b.id}
              baralho={b}
              index={i}
              onEstudar={handleEstudar}
              onVerCards={handleVerCards}
              onExcluir={handleExcluir}
              excluindo={excluindoId === b.id}
            />
          ))}
        </div>
      )}

      {/* ─── MODAL ─────────────────────────────────────────────── */}
      <ModalNovoBaralho
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onCriado={handleCriado}
      />
    </div>
  );
}
