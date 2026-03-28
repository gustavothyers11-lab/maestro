// API de cards — CRUD de flashcards (GET listar, POST criar, DELETE remover)
//
// ⚠️  Requer coluna `user_id uuid` na tabela `cards`.
//     Se ainda não existir, execute no Supabase SQL Editor:
//       ALTER TABLE cards ADD COLUMN user_id uuid;
//       CREATE INDEX idx_cards_user ON cards(user_id);

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Card, Genero } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte row snake_case do Supabase → Card camelCase */
function rowToCard(r: Record<string, unknown>): Card {
  return {
    id: r.id as string,
    frente: r.frente as string,
    verso: r.verso as string,
    audioUrl: (r.audio_url as string) ?? null,
    genero: (r.genero as Genero) ?? 'neutro',
    baralhoId: r.baralho_id as string,
    aulaId: (r.aula_id as string) ?? null,
    notas: (r.notas as string) ?? null,
    criadoEm: r.criado_em as string,
    proximoRevisao: r.proximo_revisao as string,
    intervalo: r.intervalo as number,
    facilidade: r.facilidade as number,
    repeticoes: r.repeticoes as number,
  };
}

/** Retorna o user autenticado ou uma resposta 401 */
async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null } as const;
  }
  return { user } as const;
}

const GENEROS_VALIDOS: Genero[] = ['masculino', 'feminino', 'neutro'];

// ---------------------------------------------------------------------------
// GET — listar cards do usuário
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para acessar seus cards.' },
      { status: 401 },
    );
  }

  // Filtros opcionais via query string
  const { searchParams } = request.nextUrl;
  const baralhoId = searchParams.get('baralho_id');
  const tema = searchParams.get('tema');

  let query = supabase
    .from('cards')
    .select('*, baralhos(tema)')
    .eq('user_id', user.id)
    .order('proximo_revisao', { ascending: true });

  if (baralhoId) {
    query = query.eq('baralho_id', baralhoId);
  }

  if (tema) {
    query = query.eq('baralhos.tema', tema);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: `Erro ao buscar cards: ${error.message}` },
      { status: 500 },
    );
  }

  const cards: Card[] = (data ?? []).map(rowToCard);
  return NextResponse.json({ cards, total: cards.length });
}

// ---------------------------------------------------------------------------
// POST — criar cards
// ---------------------------------------------------------------------------

interface CardInput {
  frente: string;
  verso: string;
  audioUrl?: string | null;
  genero?: Genero;
  baralhoId: string;
  aulaId?: string | null;
  notas?: string | null;
  exemplo?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para salvar cards.' },
      { status: 401 },
    );
  }

  // Parse body
  let body: { cards?: CardInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido. Envie JSON válido.' },
      { status: 400 },
    );
  }

  const cardsInput = body.cards;

  if (!Array.isArray(cardsInput) || cardsInput.length === 0) {
    return NextResponse.json(
      { error: 'Envie um array "cards" com pelo menos 1 item.' },
      { status: 400 },
    );
  }

  if (cardsInput.length > 50) {
    return NextResponse.json(
      { error: 'Máximo de 50 cards por requisição.' },
      { status: 400 },
    );
  }

  // Validação e mapeamento para snake_case
  const rows: Record<string, unknown>[] = [];
  const erros: string[] = [];

  for (let i = 0; i < cardsInput.length; i++) {
    const c = cardsInput[i];

    if (!c.frente || typeof c.frente !== 'string' || c.frente.trim().length === 0) {
      erros.push(`Card ${i + 1}: "frente" é obrigatório.`);
      continue;
    }
    if (!c.verso || typeof c.verso !== 'string' || c.verso.trim().length === 0) {
      erros.push(`Card ${i + 1}: "verso" é obrigatório.`);
      continue;
    }
    // baralhoId é opcional — cards podem ser criados sem baralho

    rows.push({
      user_id: user.id,
      frente: c.frente.trim(),
      verso: c.verso.trim(),
      audio_url: c.audioUrl ?? null,
      genero: c.genero && GENEROS_VALIDOS.includes(c.genero) ? c.genero : 'neutro',
      baralho_id: c.baralhoId || null,
      aula_id: c.aulaId ?? null,
      notas: c.notas ?? c.exemplo ?? null,
    });
  }

  if (erros.length > 0 && rows.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum card válido para inserir.', detalhes: erros },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.from('cards').insert(rows).select();

  if (error) {
    return NextResponse.json(
      { error: `Erro ao salvar cards: ${error.message}` },
      { status: 500 },
    );
  }

  const cardsCriados: Card[] = (data ?? []).map(rowToCard);

  return NextResponse.json({
    cards: cardsCriados,
    total: cardsCriados.length,
    ...(erros.length > 0 ? { avisos: erros } : {}),
  }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — remover cards
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado. Faça login para deletar cards.' },
      { status: 401 },
    );
  }

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido. Envie JSON válido.' },
      { status: 400 },
    );
  }

  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: 'Envie um array "ids" com pelo menos 1 ID.' },
      { status: 400 },
    );
  }

  if (ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json(
      { error: 'Todos os IDs devem ser strings.' },
      { status: 400 },
    );
  }

  // Deleta apenas cards que pertençam ao usuário autenticado
  const { error, count } = await supabase
    .from('cards')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .in('id', ids);

  if (error) {
    return NextResponse.json(
      { error: `Erro ao deletar cards: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    mensagem: `${count ?? 0} card(s) deletado(s) com sucesso.`,
    deletados: count ?? 0,
  });
}

// ---------------------------------------------------------------------------
// PATCH — editar um card
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401 },
    );
  }

  let body: {
    id?: string;
    frente?: string;
    verso?: string;
    genero?: Genero;
    notas?: string;
    proximoRevisao?: string;
    intervalo?: number;
    facilidade?: number;
    repeticoes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido.' },
      { status: 400 },
    );
  }

  const { id, frente, verso, genero, notas, proximoRevisao, intervalo, facilidade, repeticoes } = body;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'ID do card é obrigatório.' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (frente !== undefined) updates.frente = frente.trim();
  if (verso !== undefined) updates.verso = verso.trim();
  if (genero !== undefined && GENEROS_VALIDOS.includes(genero)) updates.genero = genero;
  if (notas !== undefined) updates.notas = notas.trim() || null;
  if (proximoRevisao !== undefined) updates.proximo_revisao = proximoRevisao;
  if (intervalo !== undefined) updates.intervalo = intervalo;
  if (facilidade !== undefined) updates.facilidade = facilidade;
  if (repeticoes !== undefined) updates.repeticoes = repeticoes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Erro ao atualizar card: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ card: rowToCard(data as Record<string, unknown>) });
}
