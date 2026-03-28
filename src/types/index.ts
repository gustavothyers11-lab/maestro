// Tipos globais — interfaces e types para Card, Baralho, Aula, Usuário, Missão, Progresso, etc.

/** Gênero gramatical de uma palavra (usado para idiomas com gênero) */
export type Genero = 'masculino' | 'feminino' | 'neutro';

/** Status de andamento de uma aula */
export type StatusAula = 'pendente' | 'em_progresso' | 'concluida';

/** Resultado de uma revisão de cartão (auto-avaliação do usuário) */
export type ResultadoRevisao = 'errei' | 'dificil' | 'bom' | 'facil';

/** Cartão de repetição espaçada com frente, verso e metadados SRS */
export interface Card {
  id: string;
  frente: string;
  verso: string;
  audioUrl: string | null;
  genero: Genero;
  baralhoId: string;
  aulaId: string | null;
  notas: string | null;
  criadoEm: string;
  proximoRevisao: string;
  intervalo: number;
  facilidade: number;
  repeticoes: number;
}

/** Baralho que agrupa cartões por tema */
export interface Baralho {
  id: string;
  nome: string;
  tema: string;
  cor: string;
  criadoEm: string;
  totalCards: number;
  cardsRevisados: number;
}

/** Aula com conteúdo em PDF e progresso de cartões associados */
export interface Aula {
  id: string;
  titulo: string;
  pdfUrl: string | null;
  anotacoes: string | null;
  status: StatusAula;
  criadoEm: string;
  totalCards: number;
  cardsDominados: number;
}

/** Registro de progresso de uma revisão individual */
export interface Progresso {
  id: string;
  userId: string;
  cardId: string;
  resultado: ResultadoRevisao;
  respondidoEm: string;
}

/** Registro diário de streak (sequência de dias estudados) */
export interface Streak {
  id: string;
  userId: string;
  data: string;
  metaAtingida: boolean;
}

/** Resultado do algoritmo SRS após uma revisão */
export interface ResultadoSRS {
  proximoRevisao: string;
  intervalo: number;
  facilidade: number;
  repeticoes: number;
}

/** Configurações de preferência do usuário */
export interface ConfiguracaoUsuario {
  metaDiaria: number;
  notificacoesAtivadas: boolean;
  modoEscuro: boolean;
}
