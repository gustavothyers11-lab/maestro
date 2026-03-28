// API de missões — busca/gera missões (GET) e atualiza progresso (POST)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null } as const;
  return { user } as const;
}

/** Início do dia atual (00:00 UTC) */
function inicioDoDia() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Fim do dia atual (23:59:59 UTC) */
function fimDoDia() {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Próxima segunda-feira 00:00 UTC (fim da semana) */
function fimDaSemana() {
  const d = new Date();
  const dia = d.getUTCDay(); // 0=dom, 1=seg, ...
  const diasAteSeg = dia === 0 ? 1 : 8 - dia;
  d.setUTCDate(d.getUTCDate() + diasAteSeg);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Geração automática de missões
// ---------------------------------------------------------------------------

interface MissaoSeed {
  titulo: string;
  descricao: string;
  tipo: 'diaria' | 'semanal';
  meta: number;
  xp_recompensa: number;
  expira_em: string;
}

async function gerarMissoesDiarias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<MissaoSeed[]> {
  // Consulta histórico para calibrar metas
  const { count: totalCards } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });

  const { count: revisoesRecentes } = await supabase
    .from('progresso')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('respondido_em', inicioDoDia());

  // Meta de cards baseada no total disponível (mín 5, máx 30)
  const cardsDisponiveis = totalCards ?? 0;
  const metaCards = Math.max(5, Math.min(30, Math.round(cardsDisponiveis * 0.3)));

  // Bônus se já revisou hoje → meta um pouco maior
  const jaRevisou = (revisoesRecentes ?? 0) > 0;
  const metaRevisao = jaRevisou ? Math.min(metaCards + 5, 30) : metaCards;

  const expira = fimDoDia();

  return [
    {
      titulo: `Revisar ${metaRevisao} cards`,
      descricao: 'Revise seus flashcards para fortalecer a memória.',
      tipo: 'diaria',
      meta: metaRevisao,
      xp_recompensa: metaRevisao * 2,
      expira_em: expira,
    },
    {
      titulo: 'Praticar ditado 2 vezes',
      descricao: 'Treine seu ouvido com exercícios de ditado.',
      tipo: 'diaria',
      meta: 2,
      xp_recompensa: 30,
      expira_em: expira,
    },
    {
      titulo: 'Escrever no diário',
      descricao: 'Escreva pelo menos uma entrada no seu diário em espanhol.',
      tipo: 'diaria',
      meta: 1,
      xp_recompensa: 25,
      expira_em: expira,
    },
  ];
}

async function gerarMissoesSemanais(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<MissaoSeed[]> {
  const { count: totalCards } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true });

  const cardsDisponiveis = totalCards ?? 0;
  const metaSemanal = Math.max(20, Math.min(100, Math.round(cardsDisponiveis * 0.8)));
  const expira = fimDaSemana();

  return [
    {
      titulo: `Revisar ${metaSemanal} cards esta semana`,
      descricao: 'Meta semanal de revisões para manter o ritmo.',
      tipo: 'semanal',
      meta: metaSemanal,
      xp_recompensa: metaSemanal * 3,
      expira_em: expira,
    },
    {
      titulo: 'Manter streak de 5 dias',
      descricao: 'Estude todos os dias para manter sua sequência.',
      tipo: 'semanal',
      meta: 5,
      xp_recompensa: 100,
      expira_em: expira,
    },
  ];
}

// ---------------------------------------------------------------------------
// GET — retorna missões ativas; gera automaticamente se necessário
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const agora = new Date().toISOString();

  // Busca missões ativas (não expiradas)
  const { data: missoes, error } = await supabase
    .from('missoes')
    .select('*')
    .eq('user_id', user.id)
    .gte('expira_em', agora)
    .order('tipo', { ascending: true })
    .order('criado_em', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar missões.' }, { status: 500 });
  }

  const diarias = (missoes ?? []).filter((m) => m.tipo === 'diaria');
  const semanais = (missoes ?? []).filter((m) => m.tipo === 'semanal');

  const novasMissoes: MissaoSeed[] = [];

  // Gera diárias se não tem nenhuma ativa hoje
  if (diarias.length === 0) {
    novasMissoes.push(...await gerarMissoesDiarias(supabase, user.id));
  }

  // Gera semanais se não tem nenhuma ativa esta semana
  if (semanais.length === 0) {
    novasMissoes.push(...await gerarMissoesSemanais(supabase));
  }

  // Insere novas missões se houver
  if (novasMissoes.length > 0) {
    const rows = novasMissoes.map((m) => ({ ...m, user_id: user.id }));
    const { error: insertErr } = await supabase.from('missoes').insert(rows);
    if (insertErr) {
      return NextResponse.json({ error: 'Erro ao gerar missões.' }, { status: 500 });
    }

    // Re-busca tudo
    const { data: todas } = await supabase
      .from('missoes')
      .select('*')
      .eq('user_id', user.id)
      .gte('expira_em', agora)
      .order('tipo', { ascending: true })
      .order('criado_em', { ascending: true });

    return NextResponse.json({ missoes: todas ?? [], geradas: novasMissoes.length });
  }

  return NextResponse.json({ missoes: missoes ?? [], geradas: 0 });
}

// ---------------------------------------------------------------------------
// POST — atualiza progresso de uma missão
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: { missao_id?: string; incremento?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { missao_id, incremento } = body;

  if (!missao_id || typeof missao_id !== 'string') {
    return NextResponse.json({ error: 'missao_id é obrigatório.' }, { status: 400 });
  }
  if (!incremento || typeof incremento !== 'number' || incremento < 1) {
    return NextResponse.json({ error: 'incremento deve ser >= 1.' }, { status: 400 });
  }

  // Busca a missão (verifica pertença ao user + não concluída)
  const { data: missao, error: fetchErr } = await supabase
    .from('missoes')
    .select('*')
    .eq('id', missao_id)
    .eq('user_id', user.id)
    .single();

  if (fetchErr || !missao) {
    return NextResponse.json({ error: 'Missão não encontrada.' }, { status: 404 });
  }

  if (missao.concluida) {
    return NextResponse.json({ error: 'Missão já concluída.', missao }, { status: 400 });
  }

  // Atualiza progresso
  const novoProgresso = Math.min(missao.progresso + incremento, missao.meta);
  const concluida = novoProgresso >= missao.meta;

  const { data: atualizada, error: updateErr } = await supabase
    .from('missoes')
    .update({ progresso: novoProgresso, concluida })
    .eq('id', missao_id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (updateErr) {
    return NextResponse.json({ error: 'Erro ao atualizar missão.' }, { status: 500 });
  }

  return NextResponse.json({
    missao: atualizada,
    concluida,
    xpGanho: concluida ? missao.xp_recompensa : 0,
  });
}
