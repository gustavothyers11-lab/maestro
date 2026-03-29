import type { Aula, CategoriaAula, MaterialAula, PronunciaAula, StatusAula } from '@/types';

interface AulaMetadata {
  categoria?: CategoriaAula;
  transcricao?: string;
  resumo?: string;
  materiais?: MaterialAula[];
  pronuncia?: PronunciaAula | null;
}

export function parseAulaMetadata(raw: unknown): AulaMetadata {
  if (!raw || typeof raw !== 'string') return {};

  try {
    const parsed = JSON.parse(raw) as AulaMetadata;
    return {
      categoria: parsed.categoria,
      transcricao: typeof parsed.transcricao === 'string' ? parsed.transcricao : undefined,
      resumo: typeof parsed.resumo === 'string' ? parsed.resumo : undefined,
      materiais: Array.isArray(parsed.materiais) ? parsed.materiais : [],
      pronuncia: parsed.pronuncia ?? null,
    };
  } catch {
    return {};
  }
}

export function serializeAulaMetadata(metadata: AulaMetadata): string {
  return JSON.stringify({
    categoria: metadata.categoria ?? 'geral',
    transcricao: metadata.transcricao ?? '',
    resumo: metadata.resumo ?? '',
    materiais: Array.isArray(metadata.materiais) ? metadata.materiais : [],
    pronuncia: metadata.pronuncia ?? null,
  });
}

export function rowToAula(row: Record<string, unknown>): Aula {
  const meta = parseAulaMetadata(row.anotacoes);

  return {
    id: row.id as string,
    titulo: row.titulo as string,
    pdfUrl: (row.pdf_url as string) ?? null,
    anotacoes: (row.anotacoes as string) ?? null,
    status: (row.status as StatusAula) ?? 'pendente',
    criadoEm: (row.criado_em as string) ?? new Date().toISOString(),
    totalCards: (row.total_cards as number) ?? 0,
    cardsDominados: (row.cards_dominados as number) ?? 0,
    categoria: meta.categoria ?? 'geral',
    transcricao: meta.transcricao ?? '',
    resumo: meta.resumo ?? '',
    materiais: meta.materiais ?? [],
    pronuncia: meta.pronuncia ?? null,
  };
}