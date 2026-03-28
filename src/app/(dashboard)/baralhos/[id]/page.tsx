// Página de detalhe do baralho — visualização e edição dos cards de um baralho específico

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCards } from '@/hooks/useCards';
import { formatarIntervalo } from '@/utils/formatters';
import type { Baralho, Card, Genero } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cor de fundo / badge por gênero gramatical */
function generoCor(g: Genero) {
  switch (g) {
    case 'masculino':
      return { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', label: '♂ Masc' };
    case 'feminino':
      return { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30', label: '♀ Fem' };
    default:
      return { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30', label: '⊘ Neutro' };
  }
}

/** Status do card baseado no SRS */
function statusCard(card: Card) {
  if (card.repeticoes === 0) return { label: 'Novo', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (card.intervalo >= 21 && card.repeticoes >= 5) return { label: 'Dominado', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label: 'Aprendendo', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' };
}

/** Verifica se um card está vencido (revisão no passado) */
function isVencido(card: Card) {
  return new Date(card.proximoRevisao) <= new Date();
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function BaralhoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const baralhoId = params.id as string;

  // ── Estado do baralho (metadata) ────────────────────────────────────
  const [baralho, setBaralho] = useState<Baralho | null>(null);
  const [baralhoLoading, setBaralhoLoading] = useState(true);

  // ── Cards via hook ──────────────────────────────────────────────────
  const {
    cards,
    loading: cardsLoading,
    error,
    estatisticas,
    deletarCard,
    setFiltros,
    recarregar,
  } = useCards({ baralhoId });

  // ── Busca local ─────────────────────────────────────────────────────
  const [busca, setBusca] = useState('');

  const handleBusca = useCallback(
    (termo: string) => {
      setBusca(termo);
      setFiltros({ baralhoId, busca: termo });
    },
    [baralhoId, setFiltros],
  );

  // ── Modal de edição ─────────────────────────────────────────────────
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState({ frente: '', verso: '', genero: 'neutro' as Genero, notas: '' });
  const [editSaving, setEditSaving] = useState(false);

  const abrirEdicao = (card: Card) => {
    setEditCard(card);
    setEditForm({
      frente: card.frente,
      verso: card.verso,
      genero: card.genero,
      notas: card.notas ?? '',
    });
  };

  const salvarEdicao = async () => {
    if (!editCard) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editCard.id,
          frente: editForm.frente.trim(),
          verso: editForm.verso.trim(),
          genero: editForm.genero,
          notas: editForm.notas.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar');
      setEditCard(null);
      await recarregar();
    } catch {
      // silently handled — user can retry
    } finally {
      setEditSaving(false);
    }
  };

  // ── Deletar card ────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmarDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletarCard(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // silently handled
    } finally {
      setDeleting(false);
    }
  };

  // ── Buscar metadados do baralho ─────────────────────────────────────
  useEffect(() => {
    async function fetchBaralho() {
      try {
        const res = await fetch('/api/baralhos');
        const data = await res.json();
        if (res.ok && data.baralhos) {
          const found = (data.baralhos as Baralho[]).find((b) => b.id === baralhoId);
          setBaralho(found ?? null);
        }
      } catch {
        // silently handled
      } finally {
        setBaralhoLoading(false);
      }
    }
    fetchBaralho();
  }, [baralhoId]);

  // ── Cards com vencimento ────────────────────────────────────────────
  const cardsVencidosCount = useMemo(() => cards.filter(isVencido).length, [cards]);

  // ── Loading ─────────────────────────────────────────────────────────
  if (baralhoLoading || cardsLoading) {
    return (
      <div className="bdl-page p-6 sm:p-8 max-w-6xl mx-auto">
        {/* Skeleton header */}
        <div className="bdl-header mb-8">
          <div className="h-5 w-28 bg-white/5 rounded animate-pulse mb-4" />
          <div className="h-10 w-64 bg-white/5 rounded-xl animate-pulse mb-2" />
          <div className="h-5 w-40 bg-white/5 rounded animate-pulse" />
        </div>

        {/* Skeleton stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 bg-white/[0.03] rounded-2xl animate-pulse border border-white/[0.06]" />
          ))}
        </div>

        {/* Skeleton cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 bg-white/[0.03] rounded-2xl animate-pulse border border-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  // ── Baralho não encontrado ──────────────────────────────────────────
  if (!baralho) {
    return (
      <div className="bdl-page p-6 sm:p-8 max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Baralho não encontrado</h2>
        <p className="text-gray-500 mb-6">Este baralho pode ter sido removido ou o link é inválido.</p>
        <Link
          href="/baralhos"
          className="px-6 py-2.5 rounded-xl bg-primary/20 text-primary font-semibold hover:bg-primary/30 transition-colors"
        >
          Voltar aos baralhos
        </Link>
      </div>
    );
  }

  const corAccent = baralho.cor || '#1260CC';

  return (
    <div className="bdl-page p-6 sm:p-8 max-w-6xl mx-auto">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="bdl-header mb-8">
        {/* Back link */}
        <Link
          href="/baralhos"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 group"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Baralhos
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Color indicator */}
            <div
              className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: corAccent + '22', boxShadow: `0 4px 20px ${corAccent}15` }}
            >
              <div className="w-6 h-6 rounded-lg" style={{ backgroundColor: corAccent }} />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{baralho.nome}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: corAccent + '18', color: corAccent }}
                >
                  {baralho.tema || 'Geral'}
                </span>
                <span className="text-xs text-gray-600">•</span>
                <span className="text-xs text-gray-500">{estatisticas.total} card{estatisticas.total !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Estudar button */}
          {estatisticas.total > 0 && (
            <button
              onClick={() => router.push('/estudar')}
              className="bdl-study-btn flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white text-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${corAccent}, ${corAccent}cc)`,
                boxShadow: `0 4px 20px ${corAccent}40`,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Estudar este baralho
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total', value: estatisticas.total, icon: '📚', accent: 'from-blue-500/10 to-blue-500/5' },
          { label: 'Dominados', value: estatisticas.dominados, icon: '🏆', accent: 'from-amber-500/10 to-amber-500/5' },
          { label: 'Para revisar', value: cardsVencidosCount, icon: '🔥', accent: 'from-red-500/10 to-red-500/5' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="bdl-stat-card relative overflow-hidden rounded-2xl border border-white/[0.06] p-4 sm:p-5"
            style={{ '--bdl-stat-delay': `${i * 80}ms` } as React.CSSProperties}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.accent}`} />
            <div className="relative">
              <span className="text-lg sm:text-xl">{stat.icon}</span>
              <p className="text-2xl sm:text-3xl font-bold text-white mt-1">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + info bar ─────────────────────────────────────────── */}
      {estatisticas.total > 0 && (
        <div className="bdl-search flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar card..."
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all"
            />
            {busca && (
              <button
                onClick={() => handleBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {busca && (
            <p className="text-xs text-gray-600">
              {cards.length} resultado{cards.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ── Error state ───────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!error && cards.length === 0 && !busca && (
        <div className="bdl-empty flex flex-col items-center justify-center py-20 text-center">
          {/* Stacked empty cards */}
          <div className="relative w-32 h-24 mb-8">
            <div
              className="bdl-empty-card absolute inset-0 rounded-2xl bg-white/[0.04] border border-white/[0.08]"
              style={{ '--bdl-empty-delay': '0ms', transform: 'rotate(-6deg)' } as React.CSSProperties}
            />
            <div
              className="bdl-empty-card absolute inset-0 rounded-2xl bg-white/[0.06] border border-white/[0.10]"
              style={{ '--bdl-empty-delay': '100ms', transform: 'rotate(-2deg)' } as React.CSSProperties}
            />
            <div
              className="bdl-empty-card absolute inset-0 rounded-2xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center"
              style={{ '--bdl-empty-delay': '200ms', transform: 'rotate(2deg)' } as React.CSSProperties}
            >
              <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-2">Nenhum card neste baralho</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs">
            Adicione cards a partir de uma aula ou crie novos cards manualmente.
          </p>
          <Link
            href="/aulas"
            className="bdl-empty-btn inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{
              backgroundColor: corAccent + '20',
              color: corAccent,
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            Ir para aulas
          </Link>
        </div>
      )}

      {/* ── No results (search) ───────────────────────────────────────── */}
      {!error && cards.length === 0 && busca && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-gray-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <h3 className="text-lg font-bold text-white mb-1">Nenhum resultado</h3>
          <p className="text-sm text-gray-500">
            Nenhum card encontrado para &ldquo;{busca}&rdquo;
          </p>
        </div>
      )}

      {/* ── Card grid ─────────────────────────────────────────────────── */}
      {cards.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card, idx) => {
            const gen = generoCor(card.genero);
            const status = statusCard(card);
            const vencido = isVencido(card);

            return (
              <div
                key={card.id}
                className="bdl-card-stagger bdl-card group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.10] transition-all duration-200 overflow-hidden"
                style={{ '--bdl-card-delay': `${idx * 50}ms` } as React.CSSProperties}
              >
                {/* Accent top bar */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${corAccent}, ${corAccent}66)` }} />

                <div className="p-5">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${gen.bg} ${gen.text} ${gen.border}`}>
                      {gen.label}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.color}`}>
                      {status.label}
                    </span>
                    {vencido && card.repeticoes > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/30">
                        Vencido
                      </span>
                    )}
                  </div>

                  {/* Frente */}
                  <h3 className="text-lg font-bold text-white mb-1 leading-snug line-clamp-2">{card.frente}</h3>

                  {/* Verso */}
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">{card.verso}</p>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-600">
                    {card.repeticoes > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                        </svg>
                        {card.repeticoes}x
                      </span>
                    )}
                    {card.intervalo > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatarIntervalo(card.intervalo)}
                      </span>
                    )}
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => abrirEdicao(card)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(card)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors ml-auto"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────── */}
      {editCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !editSaving && setEditCard(null)} />

          <div className="bdl-modal relative w-full max-w-md rounded-2xl bg-[#1a1a2e] border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* Modal accent */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${corAccent}, ${corAccent}66)` }} />

            <div className="p-6">
              <h2 className="text-lg font-bold text-white mb-5">Editar card</h2>

              <div className="space-y-4">
                {/* Frente */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Frente</label>
                  <input
                    type="text"
                    value={editForm.frente}
                    onChange={(e) => setEditForm((f) => ({ ...f, frente: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>

                {/* Verso */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Verso</label>
                  <input
                    type="text"
                    value={editForm.verso}
                    onChange={(e) => setEditForm((f) => ({ ...f, verso: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>

                {/* Gênero */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Gênero</label>
                  <div className="flex gap-2">
                    {(['masculino', 'feminino', 'neutro'] as Genero[]).map((g) => {
                      const gc = generoCor(g);
                      const active = editForm.genero === g;
                      return (
                        <button
                          key={g}
                          onClick={() => setEditForm((f) => ({ ...f, genero: g }))}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            active
                              ? `${gc.bg} ${gc.text} ${gc.border}`
                              : 'bg-white/[0.03] text-gray-500 border-white/[0.06] hover:bg-white/[0.05]'
                          }`}
                        >
                          {gc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notas */}
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Notas</label>
                  <textarea
                    value={editForm.notas}
                    onChange={(e) => setEditForm((f) => ({ ...f, notas: e.target.value }))}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/40 transition-colors resize-none"
                    placeholder="Anotações opcionais..."
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditCard(null)}
                  disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvarEdicao}
                  disabled={editSaving || !editForm.frente.trim() || !editForm.verso.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${corAccent}, ${corAccent}cc)`,
                    boxShadow: `0 2px 12px ${corAccent}30`,
                  }}
                >
                  {editSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />

          <div className="bdl-modal relative w-full max-w-sm rounded-2xl bg-[#1a1a2e] border border-white/[0.08] shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Excluir card?</h3>
              <p className="text-sm text-gray-400 mb-1">
                <span className="font-semibold text-white">&ldquo;{deleteTarget.frente}&rdquo;</span>
              </p>
              <p className="text-xs text-gray-600 mb-6">Esta ação não pode ser desfeita.</p>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500/80 hover:bg-red-500 transition-colors disabled:opacity-50 shadow-lg shadow-red-500/20"
                >
                  {deleting ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
