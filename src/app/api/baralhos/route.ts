// API de baralhos — CRUD (GET listar, POST criar, PATCH atualizar, DELETE remover)

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Baralho } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converte row snake_case → Baralho camelCase */
function rowToBaralho(r: Record<string, unknown>): Baralho {
  return {
    id: r.id as string,
    nome: r.nome as string,
    tema: (r.tema as string) ?? '',
    cor: (r.cor as string) ?? '#1260CC',
    criadoEm: r.criado_em as string,
    totalCards: (r.total_cards as number) ?? 0,
    cardsRevisados: (r.cards_revisados as number) ?? 0,
  };
}

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null } as const;
  return { user } as const;
}

const TEMAS_VALIDOS = [
  'Vocabulário',
  'Verbos',
  'Gramática',
  'Frases',
  'Expressões',
  'Cultura',
  'Outro',
];

const COR_REGEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// GET — listar baralhos do usuário com contagem de cards
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401 },
    );
  }

  // Busca baralhos com contagem de cards via relação
  const { data, error } = await supabase
    .from('baralhos')
    .select('*, cards(count)')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: `Erro ao buscar baralhos: ${error.message}` },
      { status: 500 },
    );
  }

  const baralhos: Baralho[] = (data ?? []).map((row: Record<string, unknown>) => {
    const cardsAgg = row.cards as Array<{ count: number }> | undefined;
    const totalCards = cardsAgg?.[0]?.count ?? 0;

    return {
      ...rowToBaralho(row),
      totalCards,
    };
  });

  return NextResponse.json({ baralhos });
}

// ---------------------------------------------------------------------------
// POST — criar baralho
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { nome, tema, cor } = body as {
    nome?: string;
    tema?: string;
    cor?: string;
  };

  // Validação
  if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
    return NextResponse.json(
      { error: 'Nome do baralho é obrigatório.' },
      { status: 400 },
    );
  }

  if (nome.trim().length > 100) {
    return NextResponse.json(
      { error: 'Nome deve ter no máximo 100 caracteres.' },
      { status: 400 },
    );
  }

  if (tema && !TEMAS_VALIDOS.includes(tema)) {
    return NextResponse.json(
      { error: `Tema inválido. Opções: ${TEMAS_VALIDOS.join(', ')}` },
      { status: 400 },
    );
  }

  if (cor && !COR_REGEX.test(cor)) {
    return NextResponse.json(
      { error: 'Cor deve ser um hex válido (#RRGGBB).' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('baralhos')
    .insert({
      nome: nome.trim(),
      tema: tema ?? 'Vocabulário',
      cor: cor ?? '#1260CC',
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Erro ao criar baralho: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ baralho: rowToBaralho(data as Record<string, unknown>) }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE — remover baralho
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { id } = body as { id?: string };

  if (!id || typeof id !== 'string') {
    return NextResponse.json(
      { error: 'ID do baralho é obrigatório.' },
      { status: 400 },
    );
  }

  // Verifica que o baralho pertence ao usuário
  const { data: existing } = await supabase
    .from('baralhos')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: 'Baralho não encontrado.' },
      { status: 404 },
    );
  }

  const { error } = await supabase
    .from('baralhos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: `Erro ao deletar: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
