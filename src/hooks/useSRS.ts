// Hook useSRS — interface com o algoritmo de repetição espaçada para sessões de revisão

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Card, ResultadoRevisao } from '@/types';
import { calcularSRS } from '@/lib/srs';
import { createClient } from '@/lib/supabase/client';

interface UseSRSRetorno {
  /** Card sendo exibido no momento (null quando a sessão termina) */
  cardAtual: Card | null;
  /** Número total de cards na sessão */
  totalCards: number;
  /** Cards que ainda não foram respondidos */
  cardsRestantes: number;
  /** Número de cards já respondidos nesta sessão */
  respondidos: number;
  /** Verdadeiro quando todos os cards foram revisados */
  sessaoConcluida: boolean;
  /** Registra a resposta do usuário, persiste no Supabase e avança para o próximo card */
  responder: (resultado: ResultadoRevisao) => Promise<void>;
}

/**
 * Gerencia uma sessão de revisão de cartões com o algoritmo SM-2.
 *
 * @param cardsIniciais - Lista de cards vencidos que serão revisados nesta sessão
 */
export function useSRS(cardsIniciais: Card[]): UseSRSRetorno {
  const [cards, setCards] = useState<Card[]>(cardsIniciais);
  const [indice, setIndice] = useState(0);
  const [respondidos, setRespondidos] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  // Busca o user_id uma vez ao montar
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const totalCards = cards.length;
  const sessaoConcluida = indice >= totalCards;
  const cardAtual = sessaoConcluida ? null : cards[indice];
  const cardsRestantes = totalCards - indice;

  /**
   * Processa a resposta do usuário para o card atual:
   * 1. Calcula o novo estado SRS via SM-2
   * 2. Atualiza o card localmente (estado da sessão)
   * 3. Persiste o resultado em `progresso` e atualiza `cards` no Supabase
   * 4. Avança para o próximo card
   */
  const responder = useCallback(
    async (resultado: ResultadoRevisao): Promise<void> => {
      if (sessaoConcluida || cardAtual === null) return;

      // 1. Calcula o novo estado pelo algoritmo SM-2
      const srs = calcularSRS(cardAtual, resultado);

      // 2. Atualiza o card localmente para refletir o novo estado imediatamente
      const cardAtualizado: Card = {
        ...cardAtual,
        proximoRevisao: srs.proximoRevisao,
        intervalo: srs.intervalo,
        facilidade: srs.facilidade,
        repeticoes: srs.repeticoes,
      };

      setCards((prev) =>
        prev.map((c) => (c.id === cardAtual.id ? cardAtualizado : c)),
      );

      // 3. Persiste no Supabase — operações em paralelo para minimizar latência
      const supabase = createClient();

      await Promise.all([
        // Registra o evento de revisão na tabela de progresso
        supabase.from('progresso').insert({
          user_id: userId,
          card_id: cardAtual.id,
          resultado,
          respondido_em: new Date().toISOString(),
        }),

        // Atualiza os metadados SRS do próprio card
        supabase
          .from('cards')
          .update({
            proximo_revisao: srs.proximoRevisao,
            intervalo: srs.intervalo,
            facilidade: srs.facilidade,
            repeticoes: srs.repeticoes,
          })
          .eq('id', cardAtual.id),
      ]);

      // 4. Avança a sessão
      setRespondidos((prev) => prev + 1);
      setIndice((prev) => prev + 1);
    },
    [cardAtual, sessaoConcluida, userId],
  );

  return {
    cardAtual,
    totalCards,
    cardsRestantes,
    respondidos,
    sessaoConcluida,
    responder,
  };
}
