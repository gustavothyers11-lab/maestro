// Hook useCards — gerenciamento de estado e operações CRUD de flashcards

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from '@/types';
import { calcularCardsVencidos } from '@/lib/srs';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Filtros {
  baralhoId?: string;
  tema?: string;
  busca?: string;
}

interface Estatisticas {
  total: number;
  vencidos: number;
  dominados: number;
}

interface UseCardsReturn {
  cards: Card[];
  loading: boolean;
  error: string | null;
  cardsVencidos: Card[];
  estatisticas: Estatisticas;
  recarregar: () => Promise<void>;
  salvarCards: (novos: Omit<Card, 'id' | 'criadoEm' | 'proximoRevisao' | 'intervalo' | 'facilidade' | 'repeticoes'>[]) => Promise<Card[]>;
  deletarCard: (id: string) => Promise<void>;
  setFiltros: (f: Filtros) => void;
}

// ---------------------------------------------------------------------------
// Limiar para considerar um card "dominado"
// (intervalo >= 21 dias E 5+ revisões corretas consecutivas)
// ---------------------------------------------------------------------------

const INTERVALO_DOMINADO = 21;
const REPETICOES_DOMINADO = 5;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCards(filtrosIniciais?: Filtros): UseCardsReturn {
  const [todosCards, setTodosCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(filtrosIniciais ?? {});

  // ── Buscar cards ────────────────────────────────────────────────────
  const recarregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filtros.baralhoId) params.set('baralho_id', filtros.baralhoId);
      if (filtros.tema) params.set('tema', filtros.tema);

      const qs = params.toString();
      const url = `/api/cards${qs ? `?${qs}` : ''}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Erro ${res.status}`);
      }

      setTodosCards(data.cards ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar cards.');
    } finally {
      setLoading(false);
    }
  }, [filtros.baralhoId, filtros.tema]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  // ── Filtro local de busca por texto ─────────────────────────────────
  const cards = useMemo(() => {
    if (!filtros.busca || filtros.busca.trim().length === 0) return todosCards;

    const termo = filtros.busca.toLowerCase().trim();
    return todosCards.filter(
      (c) =>
        c.frente.toLowerCase().includes(termo) ||
        c.verso.toLowerCase().includes(termo) ||
        (c.notas?.toLowerCase().includes(termo) ?? false),
    );
  }, [todosCards, filtros.busca]);

  // ── Cards vencidos (SRS) ────────────────────────────────────────────
  const cardsVencidos = useMemo(() => calcularCardsVencidos(cards), [cards]);

  // ── Estatísticas ────────────────────────────────────────────────────
  const estatisticas = useMemo<Estatisticas>(() => {
    const dominados = cards.filter(
      (c) => c.intervalo >= INTERVALO_DOMINADO && c.repeticoes >= REPETICOES_DOMINADO,
    ).length;

    return {
      total: cards.length,
      vencidos: cardsVencidos.length,
      dominados,
    };
  }, [cards, cardsVencidos]);

  // ── Salvar cards (POST) ─────────────────────────────────────────────
  const salvarCards = useCallback(
    async (
      novos: Omit<Card, 'id' | 'criadoEm' | 'proximoRevisao' | 'intervalo' | 'facilidade' | 'repeticoes'>[],
    ): Promise<Card[]> => {
      setError(null);

      try {
        const res = await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: novos }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? `Erro ${res.status}`);
        }

        const criados: Card[] = data.cards ?? [];

        // Atualiza a lista local sem precisar de nova requisição
        setTodosCards((prev) => [...prev, ...criados]);

        return criados;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro ao salvar cards.';
        setError(msg);
        throw new Error(msg);
      }
    },
    [],
  );

  // ── Deletar card (DELETE) ───────────────────────────────────────────
  const deletarCard = useCallback(async (id: string): Promise<void> => {
    setError(null);

    try {
      const res = await fetch('/api/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Erro ${res.status}`);
      }

      // Remove localmente
      setTodosCards((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao deletar card.';
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  return {
    cards,
    loading,
    error,
    cardsVencidos,
    estatisticas,
    recarregar,
    salvarCards,
    deletarCard,
    setFiltros,
  };
}
