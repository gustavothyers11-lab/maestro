// Página de estudo — seleção de modo → sessão de revisão → tela de conclusão

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCards } from '@/hooks/useCards';
import { useStreak } from '@/hooks/useStreak';
import CardReview from '@/components/cards/CardReview';
import type { Baralho, Card } from '@/types';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface BaralhoSimples {
  id: string;
  nome: string;
  cor: string;
  totalCards: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function EstudarPage() {
  const { cards, cardsVencidos, estatisticas, loading: cardsLoading, recarregar } = useCards();
  const { diasConsecutivos, carregando: streakLoading, registrarAtividade } = useStreak();

  const [baralhoSelecionado, setBaralhoSelecionado] = useState('');
  const [mounted, setMounted] = useState(false);

  // Sessão de revisão
  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [cardsSessao, setCardsSessao] = useState<Card[]>([]);

  // Baralhos reais
  const [baralhos, setBaralhos] = useState<BaralhoSimples[]>([]);
  const [baralhoLoading, setBaralhoLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Buscar baralhos reais
  useEffect(() => {
    async function buscarBaralhos() {
      try {
        const res = await fetch('/api/baralhos');
        if (!res.ok) return;
        const data = await res.json();
        setBaralhos(
          (data.baralhos ?? []).map((b: Baralho) => ({
            id: b.id,
            nome: b.nome,
            cor: b.cor,
            totalCards: b.totalCards,
          })),
        );
      } catch {
        // silently fail — dropdown just stays empty
      } finally {
        setBaralhoLoading(false);
      }
    }
    buscarBaralhos();
  }, []);

  const loading = cardsLoading || streakLoading;

  // Taxa de acerto calculada a partir de cards dominados
  const taxaAcerto = useMemo(() => {
    if (estatisticas.total === 0) return 0;
    return Math.round((estatisticas.dominados / estatisticas.total) * 100);
  }, [estatisticas]);

  // ── Iniciar sessão ─────────────────────────────────────────────────
  const iniciarSRS = useCallback(() => {
    if (cardsVencidos.length === 0) return;
    setCardsSessao([...cardsVencidos]);
    setSessaoAtiva(true);
  }, [cardsVencidos]);

  const iniciarRapida = useCallback(() => {
    if (cards.length === 0) return;
    // 10 cards aleatórios
    const embaralhados = [...cards].sort(() => Math.random() - 0.5);
    setCardsSessao(embaralhados.slice(0, 10));
    setSessaoAtiva(true);
  }, [cards]);

  const iniciarBaralho = useCallback(async () => {
    if (!baralhoSelecionado) return;
    try {
      const res = await fetch(`/api/cards?baralho_id=${baralhoSelecionado}`);
      if (!res.ok) return;
      const data = await res.json();
      const cardsBaralho: Card[] = data.cards ?? [];
      if (cardsBaralho.length === 0) return;
      setCardsSessao(cardsBaralho);
      setSessaoAtiva(true);
    } catch {
      // silently fail
    }
  }, [baralhoSelecionado]);

  // ── Finalizar sessão ───────────────────────────────────────────────
  const finalizarSessao = useCallback(async () => {
    // Registrar atividade no streak
    try {
      await registrarAtividade(true);
    } catch {
      // não bloqueia a volta
    }
    // Recarregar cards para refletir novos estados SRS
    await recarregar();
    setSessaoAtiva(false);
    setCardsSessao([]);
  }, [registrarAtividade, recarregar]);

  // ════════════════════════════════════════════════════════════════════
  // SE SESSÃO ATIVA → RENDERIZA CARDREVIEW
  // ════════════════════════════════════════════════════════════════════

  if (sessaoAtiva && cardsSessao.length > 0) {
    return (
      <div className="w-full min-h-screen bg-[#0f0f1a]">
        <CardReview cards={cardsSessao} onFinalizar={finalizarSessao} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="estudar-page mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

      {/* ─── HEADER ────────────────────────────────────────────── */}
      <div className="estudar-header">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-primary via-medium to-cyan bg-clip-text text-transparent">
            Estudar
          </span>
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
          Escolha como quer revisar hoje
        </p>
      </div>

      {/* ─── ESTATÍSTICAS RÁPIDAS ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: 'Cards vencidos',
            valor: loading ? '…' : estatisticas.vencidos,
            icone: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            cor: 'from-amber-400 to-orange-500',
            corTexto: 'text-amber-500 dark:text-amber-400',
          },
          {
            label: 'Sequência',
            valor: loading ? '…' : `${diasConsecutivos} dias`,
            icone: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 6.51 6.51 0 009 11.5a3 3 0 105.5-1.5 6.5 6.5 0 00-.862-5.786z" />
              </svg>
            ),
            cor: 'from-orange-500 to-red-500',
            corTexto: 'text-orange-500 dark:text-orange-400',
          },
          {
            label: 'Taxa de acerto',
            valor: loading ? '…' : `${taxaAcerto}%`,
            icone: (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
            cor: 'from-emerald-400 to-green-500',
            corTexto: 'text-emerald-500 dark:text-emerald-400',
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="estudar-stat-card group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm p-4 transition-all duration-200 hover:border-gray-300 dark:hover:border-white/[0.12]"
            style={{ '--estudar-stagger': `${i * 80}ms` } as React.CSSProperties}
          >
            {/* Glow de fundo */}
            <div className={`absolute -top-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-br ${stat.cor} opacity-[0.08] blur-xl transition-opacity duration-300 group-hover:opacity-[0.15]`} />

            <div className={`mb-2 ${stat.corTexto}`}>{stat.icone}</div>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
              {stat.valor}
            </p>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wider mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ─── MODOS DE ESTUDO ───────────────────────────────────── */}
      <div className="space-y-4">

        {/* CARD 1 — Revisão SRS */}
        <div
          className="estudar-mode-card group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 hover:border-primary/30 dark:hover:border-primary/20 hover:-translate-y-0.5"
          style={{ '--estudar-stagger': '0ms' } as React.CSSProperties}
          onClick={iniciarSRS}
        >
          {/* Glow on hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-primary/[0.03] to-cyan/[0.03]" />

          <div className="relative flex items-start gap-4">
            {/* Ícone */}
            <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-cyan/10 dark:from-primary/20 dark:to-cyan/20 text-2xl estudar-icon-float">
              🃏
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Revisão SRS
                </h3>
                {estatisticas.vencidos > 0 && (
                  <span className="estudar-badge inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    {estatisticas.vencidos} cards
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
                {estatisticas.vencidos > 0
                  ? 'Revisar cards vencidos de hoje'
                  : 'Nenhum card para revisar hoje! 🎉'}
              </p>
            </div>

            {/* Botão */}
            <button
              type="button"
              disabled={estatisticas.vencidos === 0}
              className={`estudar-btn flex-shrink-0 self-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ${
                estatisticas.vencidos > 0
                  ? 'bg-gradient-to-r from-primary to-medium shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.04] active:scale-[0.97]'
                  : 'bg-gray-300 dark:bg-white/10 shadow-none cursor-not-allowed opacity-60'
              }`}
            >
              {estatisticas.vencidos > 0 ? 'Começar' : 'Em dia ✓'}
            </button>
          </div>
        </div>

        {/* CARD 2 — Revisão Rápida */}
        <div
          className="estudar-mode-card group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 hover:border-primary/30 dark:hover:border-primary/20 hover:-translate-y-0.5"
          style={{ '--estudar-stagger': '100ms' } as React.CSSProperties}
          onClick={iniciarRapida}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-primary/[0.03] to-cyan/[0.03]" />

          <div className="relative flex items-start gap-4">
            <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400/10 to-orange-400/10 dark:from-yellow-400/20 dark:to-orange-400/20 text-2xl estudar-icon-float">
              ⚡
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Revisão Rápida
                </h3>
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider">
                  ~5 min
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
                {cards.length > 0
                  ? `Sessão de ${Math.min(10, cards.length)} cards — rápido e eficiente`
                  : 'Nenhum card disponível'}
              </p>
            </div>

            <button
              type="button"
              disabled={cards.length === 0}
              className={`estudar-btn flex-shrink-0 self-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ${
                cards.length > 0
                  ? 'bg-gradient-to-r from-primary to-medium shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.04] active:scale-[0.97]'
                  : 'bg-gray-300 dark:bg-white/10 shadow-none cursor-not-allowed opacity-60'
              }`}
            >
              Começar
            </button>
          </div>
        </div>

        {/* CARD 3 — Baralho Específico */}
        <div
          className="estudar-mode-card group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/80 dark:bg-white/[0.03] backdrop-blur-sm p-6 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 hover:border-primary/30 dark:hover:border-primary/20 hover:-translate-y-0.5"
          style={{ '--estudar-stagger': '200ms' } as React.CSSProperties}
        >
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-primary/[0.03] to-cyan/[0.03]" />

          <div className="relative flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400/10 to-purple-500/10 dark:from-violet-400/20 dark:to-purple-500/20 text-2xl estudar-icon-float">
                🎯
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Baralho Específico
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
                  Escolha um baralho para revisar
                </p>

                {/* Select nativo */}
                <div className="mt-3">
                  <select
                    value={baralhoSelecionado}
                    onChange={(e) => setBaralhoSelecionado(e.target.value)}
                    className="w-full sm:w-64 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold focus:border-[#1260CC] focus:outline-none focus:ring-2 focus:ring-[#1260CC]/30 cursor-pointer transition-colors duration-200 appearance-none bg-[length:16px_16px] bg-[position:right_12px_center] bg-no-repeat bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M19.5%208.25l-7.5%207.5-7.5-7.5%22%2F%3E%3C%2Fsvg%3E')]"
                  >
                    <option value="">
                      {baralhoLoading ? 'Carregando…' : baralhos.length === 0 ? 'Nenhum baralho criado' : 'Selecionar baralho…'}
                    </option>
                    {baralhos.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nome} — {b.totalCards} cards
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Botão */}
            <button
              type="button"
              disabled={!baralhoSelecionado}
              onClick={iniciarBaralho}
              className={`estudar-btn flex-shrink-0 self-start sm:self-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-200 ${
                baralhoSelecionado
                  ? 'bg-gradient-to-r from-primary to-medium shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.04] active:scale-[0.97] cursor-pointer'
                  : 'bg-gray-300 dark:bg-white/10 shadow-none cursor-not-allowed opacity-60'
              }`}
            >
              Começar
            </button>
          </div>
        </div>
      </div>

      {/* ─── FOOTER — dica motivacional ────────────────────────── */}
      {mounted && (
        <div className="estudar-tip flex items-center gap-3 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] px-5 py-4">
          <span className="text-xl">💡</span>
          <p className="text-sm text-gray-500 dark:text-white/40">
            <span className="font-semibold text-gray-700 dark:text-white/60">Dica:</span>{' '}
            Revisar todos os dias, mesmo que poucos cards, é mais eficaz do que sessões longas esporádicas.
          </p>
        </div>
      )}

    </div>
  );
}
