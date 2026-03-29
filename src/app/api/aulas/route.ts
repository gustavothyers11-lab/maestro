import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToAula, serializeAulaMetadata } from '@/lib/aulas';
import type { CategoriaAula, StatusAula } from '@/types';

const CATEGORIAS_VALIDAS: CategoriaAula[] = ['geral', 'gramatica', 'vocabulario', 'conversacao', 'pronuncia'];
const STATUS_VALIDOS: StatusAula[] = ['pendente', 'em_progresso', 'concluida'];

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { user: null } as const;
  return { user } as const;
}

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('aulas')
    .select('*, cards(count)')
    .order('criado_em', { ascending: false });

  if (error) {
    return NextResponse.json({ error: `Erro ao buscar aulas: ${error.message}` }, { status: 500 });
  }

  const aulas = (data ?? []).map((row: Record<string, unknown>) => {
    const cardsAgg = row.cards as Array<{ count: number }> | undefined;
    return {
      ...rowToAula(row),
      totalCards: cardsAgg?.[0]?.count ?? 0,
    };
  });

  return NextResponse.json({ aulas });
}

interface CreateAulaBody {
  titulo?: string;
  categoria?: CategoriaAula;
  transcricao?: string;
  resumo?: string;
  status?: StatusAula;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: CreateAulaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const categoria = CATEGORIAS_VALIDAS.includes(body.categoria ?? 'geral') ? (body.categoria ?? 'geral') : 'geral';
  const transcricao = typeof body.transcricao === 'string' ? body.transcricao.trim() : '';
  const resumo = typeof body.resumo === 'string' ? body.resumo.trim() : '';
  const status = STATUS_VALIDOS.includes(body.status ?? 'pendente') ? (body.status ?? 'pendente') : 'pendente';

  if (!titulo) {
    return NextResponse.json({ error: 'Título da aula é obrigatório.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('aulas')
    .insert({
      titulo,
      status,
      pdf_url: null,
      anotacoes: serializeAulaMetadata({ categoria, transcricao, resumo, materiais: [], pronuncia: null }),
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: `Erro ao criar aula: ${error?.message ?? 'sem dados'}` }, { status: 500 });
  }

  return NextResponse.json({ aula: rowToAula(data as Record<string, unknown>) }, { status: 201 });
}
