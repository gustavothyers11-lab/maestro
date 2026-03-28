// Constantes — valores fixos da aplicação (intervalos SRS, limites, rotas, mensagens padrão)

import type { ResultadoRevisao, Genero } from '@/types';

// ---------------------------------------------------------------------------
// Algoritmo SRS
// ---------------------------------------------------------------------------

/** Fator de facilidade inicial atribuído a cartões novos */
export const FACILIDADE_INICIAL = 2.5;

/** Fator de facilidade mínimo permitido pelo SM-2 */
export const FACILIDADE_MINIMA = 1.3;

/** Intervalo inicial (em dias) para o primeiro cartão novo */
export const INTERVALO_INICIAL = 1;

// ---------------------------------------------------------------------------
// Metas e limites
// ---------------------------------------------------------------------------

/** Número padrão de cards que o usuário deve revisar por dia */
export const META_DIARIA_PADRAO = 20;

/** Máximo de cards que a IA pode gerar em uma única requisição */
export const MAX_CARDS_GERACAO = 20;

/** Tamanho máximo de upload de vídeo (100 MB em bytes) */
export const TAMANHO_MAXIMO_VIDEO = 100 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Baralho
// ---------------------------------------------------------------------------

/** Categorias disponíveis para classificar um baralho */
export const TEMAS_BARALHO = [
  'Vocabulário',
  'Verbos',
  'Frases',
  'Gírias',
  'Expressões',
] as const;

/** Paleta de cores (hex) disponíveis para personalizar um baralho */
export const CORES_BARALHO = [
  '#6366F1', // índigo
  '#8B5CF6', // violeta
  '#EC4899', // rosa
  '#F59E0B', // âmbar
  '#10B981', // esmeralda
  '#3B82F6', // azul
] as const;

// ---------------------------------------------------------------------------
// Gênero gramatical
// ---------------------------------------------------------------------------

/** Valores possíveis para o gênero gramatical de um cartão */
export const GENEROS: Genero[] = ['masculino', 'feminino', 'neutro'];

// ---------------------------------------------------------------------------
// XP e Níveis
// ---------------------------------------------------------------------------

/**
 * Retorna o XP necessário para avançar do nível atual para o próximo.
 * Escala progressiva: 500, 1000, 2000, 3500, 5500, depois nivel × 1500.
 */
export function xpParaProximoNivel(nivel: number): number {
  const base = [500, 1000, 2000, 3500, 5500];
  if (nivel <= 5) return base[nivel - 1];
  return nivel * 1500;
}

/**
 * Calcula o XP total acumulado necessário para alcançar um determinado nível.
 */
export function xpTotalParaNivel(nivel: number): number {
  let total = 0;
  for (let i = 1; i < nivel; i++) {
    total += xpParaProximoNivel(i);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Botões de resultado SRS
// ---------------------------------------------------------------------------

interface ConfigResultado {
  /** Rótulo exibido no botão */
  label: string;
  /** Cor Tailwind do botão */
  cor: string;
}

/**
 * Configuração visual de cada botão de auto-avaliação da sessão de revisão.
 * Mapeado por ResultadoRevisao para tipagem estrita.
 */
export const RESULTADOS_SRS: Record<ResultadoRevisao, ConfigResultado> = {
  errei:   { label: 'Errei',   cor: 'bg-red-500'    },
  dificil: { label: 'Difícil', cor: 'bg-orange-500' },
  bom:     { label: 'Bom',     cor: 'bg-blue-500'   },
  facil:   { label: 'Fácil',   cor: 'bg-green-500'  },
};
