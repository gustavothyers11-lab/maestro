// Algoritmo SRS — lógica de repetição espaçada (cálculo de intervalo, ease factor e próxima revisão)

import type { Card, ResultadoRevisao, ResultadoSRS } from '@/types';

/** Facilidade mínima permitida pelo SM-2 (evita intervalos negativos) */
const FACILIDADE_MINIMA = 1.3;

/** Facilidade inicial atribuída a cartões novos */
const FACILIDADE_INICIAL = 2.5;

/**
 * Adiciona `dias` dias a uma data ISO e retorna a nova data ISO (apenas YYYY-MM-DD).
 */
function adicionarDias(dataISO: string, dias: number): string {
  const data = new Date(dataISO);
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
}

/**
 * Aplica o algoritmo SM-2 adaptado para calcular o próximo estado de revisão.
 *
 * Intervalos por resposta (progressão: errei < difícil < bom < fácil):
 *  - ERREI   → 1 dia (reset), facilidade −0.2, repetições = 0
 *  - DIFÍCIL → 2d / 3d / ×1.2 (máx 14d), facilidade −0.15
 *  - BOM     → 4d / 7d / ×ease (máx 60d), facilidade inalterada
 *  - FÁCIL   → 7d / 14d / ×ease×1.3 (máx 90d), facilidade +0.1
 */
export function calcularSRS(card: Card, resposta: ResultadoRevisao): ResultadoSRS {
  let novaFacilidade: number;
  let novoIntervalo: number;
  let novasRepeticoes: number;

  switch (resposta) {
    case 'errei':
      novoIntervalo = 1;
      novasRepeticoes = 0;
      novaFacilidade = Math.max(FACILIDADE_MINIMA, card.facilidade - 0.2);
      break;

    case 'dificil':
      novasRepeticoes = card.repeticoes + 1;
      novaFacilidade = Math.max(FACILIDADE_MINIMA, card.facilidade - 0.15);
      if (novasRepeticoes === 1) {
        novoIntervalo = 2;
      } else if (novasRepeticoes === 2) {
        novoIntervalo = 3;
      } else {
        novoIntervalo = Math.round(card.intervalo * 1.2);
      }
      novoIntervalo = Math.min(novoIntervalo, 14);
      break;

    case 'bom':
      novasRepeticoes = card.repeticoes + 1;
      novaFacilidade = card.facilidade;
      if (novasRepeticoes === 1) {
        novoIntervalo = 4;
      } else if (novasRepeticoes === 2) {
        novoIntervalo = 7;
      } else {
        novoIntervalo = Math.round(card.intervalo * novaFacilidade);
      }
      novoIntervalo = Math.min(novoIntervalo, 60);
      break;

    case 'facil':
      novasRepeticoes = card.repeticoes + 1;
      novaFacilidade = Math.max(FACILIDADE_MINIMA, card.facilidade + 0.1);
      if (novasRepeticoes === 1) {
        novoIntervalo = 7;
      } else if (novasRepeticoes === 2) {
        novoIntervalo = 14;
      } else {
        novoIntervalo = Math.round(card.intervalo * novaFacilidade * 1.3);
      }
      novoIntervalo = Math.min(novoIntervalo, 90);
      break;
  }

  const proximoRevisao = adicionarDias(
    new Date().toISOString().split('T')[0],
    novoIntervalo,
  );

  return {
    proximoRevisao,
    intervalo: novoIntervalo,
    facilidade: novaFacilidade,
    repeticoes: novasRepeticoes,
  };
}

/**
 * Filtra cartões cujo próximo prazo de revisão é hoje ou já passou.
 * Usa apenas a parte da data (YYYY-MM-DD) para a comparação, ignorando o horário.
 */
export function calcularCardsVencidos(cards: Card[]): Card[] {
  const agora = new Date();
  return cards.filter((card) => new Date(card.proximoRevisao) <= agora);
}

/**
 * Retorna a facilidade inicial padrão para novos cartões.
 * Útil ao criar um Card antes da primeira revisão.
 */
export function facilidadeInicial(): number {
  return FACILIDADE_INICIAL;
}
