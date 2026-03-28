// Formatadores — funções utilitárias para formatar datas, durações, percentuais e textos

/**
 * Formata uma data no padrão brasileiro 'dd/mm/yyyy'.
 *
 * @example formatarData(new Date('2026-03-27')) // '27/03/2026'
 */
export function formatarData(date: Date): string {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte um número de dias em uma string legível.
 *
 * @example
 * formatarIntervalo(1)  // '1 dia'
 * formatarIntervalo(3)  // '3 dias'
 * formatarIntervalo(7)  // '1 semana'
 * formatarIntervalo(14) // '2 semanas'
 * formatarIntervalo(30) // '1 mês'
 * formatarIntervalo(90) // '3 meses'
 */
export function formatarIntervalo(dias: number): string {
  if (dias < 7) {
    return dias === 1 ? '1 dia' : `${dias} dias`;
  }
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? '1 semana' : `${semanas} semanas`;
  }
  const meses = Math.floor(dias / 30);
  return meses === 1 ? '1 mês' : `${meses} meses`;
}

/**
 * Calcula a porcentagem de `valor` em relação a `total`, arredondada para inteiro.
 * Retorna 0 quando `total` é zero para evitar divisão por zero.
 *
 * @example calcularPorcentagem(15, 20) // 75
 */
export function calcularPorcentagem(valor: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((valor / total) * 100);
}

/**
 * Retorna o texto com a primeira letra em maiúscula.
 *
 * @example capitalizarPrimeira('vocabulário') // 'Vocabulário'
 */
export function capitalizarPrimeira(texto: string): string {
  if (texto.length === 0) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
