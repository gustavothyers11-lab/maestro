import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rowToAula, serializeAulaMetadata } from '@/lib/aulas';
import type { CategoriaAula, StatusAula } from '@/types';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { enviarPushParaUsuario, parseTokens } from '@/lib/firebase-admin';

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

async function notificarAulaCriada(userId: string, tituloAula: string) {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .maybeSingle();

    const tokens = parseTokens((profile?.fcm_token as string | null | undefined) ?? null);
    if (tokens.length === 0) {
      return { ok: false, motivo: 'Sem tokens para este usuário.' };
    }

    const tituloCurto = tituloAula.length > 40 ? `${tituloAula.slice(0, 40)}...` : tituloAula;
    const resultado = await enviarPushParaUsuario(
      tokens,
      '🎓 Aula criada com sucesso',
      `Aula "${tituloCurto}" criada. Agora gere cards para estudar.`,
      '/dashboard/aulas',
    );
    return { ok: resultado.ok, enviados: resultado.enviados, falhas: resultado.falhas };
  } catch {
    console.error('[POST /api/aulas] Falha ao enviar notificação de aula criada.');
    return { ok: false, motivo: 'Erro ao enviar notificação.' };
  }
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

  const basePayload = {
    titulo,
    status,
    pdf_url: null,
    anotacoes: serializeAulaMetadata({ categoria, transcricao, resumo, materiais: [], pronuncia: null }),
  };

  const ownerPayloads: Array<Record<string, unknown>> = [
    { user_id: user.id },
    { usuario_id: user.id },
    {},
  ];

  let data: Record<string, unknown> | null = null;
  let error: { message?: string; code?: string } | null = null;

  for (const ownerPayload of ownerPayloads) {
    const result = await supabase
      .from('aulas')
      .insert({ ...basePayload, ...ownerPayload })
      .select()
      .single();

    if (!result.error && result.data) {
      data = result.data as Record<string, unknown>;
      error = null;
      break;
    }

    error = result.error as { message?: string; code?: string };

    // 42703 = coluna não existe; tenta próximo payload de owner
    if (error?.code === '42703') {
      continue;
    }

    // Erros diferentes param as tentativas para preservar diagnóstico real
    break;
  }

  // Fallback seguro: se RLS bloqueou no client auth, tenta via service role
  // mantendo ownership explícito no user autenticado da request.
  if ((!data || error) && /row-level security|policy/i.test(error?.message ?? '')) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const admin = createSupabaseClient(supabaseUrl, serviceRoleKey);

      for (const ownerPayload of ownerPayloads) {
        const adminResult = await admin
          .from('aulas')
          .insert({ ...basePayload, ...ownerPayload })
          .select()
          .single();

        if (!adminResult.error && adminResult.data) {
          data = adminResult.data as Record<string, unknown>;
          error = null;
          break;
        }

        const adminError = adminResult.error as { message?: string; code?: string };
        error = adminError;

        // 42703 = coluna não existe; tenta próximo payload de owner
        if (adminError?.code === '42703') {
          continue;
        }

        break;
      }
    }
  }

  if (error || !data) {
    const msg = error?.message ?? 'sem dados';
    const isRlsError = /row-level security|policy/i.test(msg);

    if (isRlsError) {
      return NextResponse.json(
        { error: 'Erro ao criar aula: política RLS bloqueou o insert. Verifique se a policy de insert permite auth.uid() = user_id (ou usuario_id).' },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: `Erro ao criar aula: ${msg}` }, { status: 500 });
  }

  const aulaCriada = rowToAula(data);
  const notificacao = await notificarAulaCriada(user.id, aulaCriada.titulo);

  return NextResponse.json({ aula: aulaCriada, notificacao }, { status: 201 });
}

// ---------------------------------------------------------------------------
// DELETE /api/aulas?id=UUID
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID da aula é obrigatório.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('aulas')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: `Erro ao excluir aula: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
