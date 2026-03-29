import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseAulaMetadata, rowToAula, serializeAulaMetadata } from '@/lib/aulas';
import type { CategoriaAula, MaterialAula, StatusAula } from '@/types';

const CATEGORIAS_VALIDAS: CategoriaAula[] = ['geral', 'gramatica', 'vocabulario', 'conversacao', 'pronuncia'];
const STATUS_VALIDOS: StatusAula[] = ['pendente', 'em_progresso', 'concluida'];
const TIPOS_MATERIAL = ['pdf', 'link', 'audio', 'video', 'doc'] as const;

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { user: null } as const;
  return { user } as const;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from('aulas')
    .select('*, cards(count)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Aula não encontrada.' }, { status: 404 });
  }

  const cardsAgg = data.cards as Array<{ count: number }> | undefined;
  return NextResponse.json({
    aula: {
      ...rowToAula(data as Record<string, unknown>),
      totalCards: cardsAgg?.[0]?.count ?? 0,
    },
  });
}

interface PatchBody {
  titulo?: string;
  categoria?: CategoriaAula;
  resumo?: string;
  transcricao?: string;
  status?: StatusAula;
  materiais?: MaterialAula[];
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: existing, error: existingError } = await supabase
    .from('aulas')
    .select('*')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Aula não encontrada.' }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const currentMeta = parseAulaMetadata(existing.anotacoes);
  const materiais = Array.isArray(body.materiais)
    ? body.materiais.filter((m): m is MaterialAula => {
      return !!m
        && typeof m.id === 'string'
        && typeof m.titulo === 'string'
        && typeof m.url === 'string'
        && TIPOS_MATERIAL.includes(m.tipo);
    })
    : (currentMeta.materiais ?? []);

  const categoria = CATEGORIAS_VALIDAS.includes(body.categoria ?? currentMeta.categoria ?? 'geral')
    ? (body.categoria ?? currentMeta.categoria ?? 'geral')
    : 'geral';

  const status = STATUS_VALIDOS.includes(body.status ?? (existing.status as StatusAula) ?? 'pendente')
    ? (body.status ?? (existing.status as StatusAula) ?? 'pendente')
    : 'pendente';

  const titulo = typeof body.titulo === 'string' && body.titulo.trim().length > 0
    ? body.titulo.trim()
    : (existing.titulo as string);
  const resumo = typeof body.resumo === 'string' ? body.resumo : (currentMeta.resumo ?? '');
  const transcricao = typeof body.transcricao === 'string' ? body.transcricao : (currentMeta.transcricao ?? '');
  const pdfPrincipal = materiais.find((item) => item.tipo === 'pdf')?.url ?? null;

  const { data, error } = await supabase
    .from('aulas')
    .update({
      titulo,
      status,
      pdf_url: pdfPrincipal,
      anotacoes: serializeAulaMetadata({
        ...currentMeta,
        categoria,
        resumo,
        transcricao,
        materiais,
      }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: `Erro ao atualizar aula: ${error?.message ?? 'sem dados'}` }, { status: 500 });
  }

  return NextResponse.json({ aula: rowToAula(data as Record<string, unknown>) });
}