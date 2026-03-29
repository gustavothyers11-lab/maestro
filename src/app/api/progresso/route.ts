// API de progresso — estatísticas de estudo do usuário (GET)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { xpTotalParaNivel } from '@/utils/constants';

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

/** Retorna YYYY-MM-DD para `diasAtras` dias no passado */
function dataPassada(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().split('T')[0];
}

const DIAS_SEMANA_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ---------------------------------------------------------------------------
// GET — estatísticas completas do usuário
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

  const hoje = new Date().toISOString().split('T')[0];
  const seteDiasAtras = dataPassada(6); // inclui hoje = 7 dias

  // ── Buscar todo o progresso do usuário ────────────────────────────
  const { data: progresso } = await supabase
    .from('progresso')
    .select('resultado, respondido_em, card_id')
    .eq('user_id', user.id)
    .order('respondido_em', { ascending: false });

  const registros = progresso ?? [];

  // ── Total e acertos ───────────────────────────────────────────────
  const totalEstudados = registros.length;
  const acertos = registros.filter(
    (r) => r.resultado === 'bom' || r.resultado === 'facil' || r.resultado === 'dificil',
  ).length;
  const taxaAcerto = totalEstudados > 0 ? Math.round((acertos / totalEstudados) * 100) : 0;
  const xpTotal = acertos * 10;

  let nivelAtual = 1;
  while (xpTotalParaNivel(nivelAtual + 1) <= xpTotal) {
    nivelAtual++;
  }

  // ── Esta semana ───────────────────────────────────────────────────
  const estudadosSemana = registros.filter(
    (r) => (r.respondido_em as string).split('T')[0] >= seteDiasAtras,
  ).length;

  // ── Atividade por dia (últimos 7 dias) ────────────────────────────
  const diasMap = new Map<string, { cards: number; acertos: number }>();

  // Inicializa os 7 dias
  for (let i = 6; i >= 0; i--) {
    const d = dataPassada(i);
    diasMap.set(d, { cards: 0, acertos: 0 });
  }

  for (const r of registros) {
    const dia = (r.respondido_em as string).split('T')[0];
    if (diasMap.has(dia)) {
      const entry = diasMap.get(dia)!;
      entry.cards += 1;
      if (r.resultado !== 'errei') entry.acertos += 1;
    }
  }

  const semana = Array.from(diasMap.entries()).map(([data, val]) => {
    const d = new Date(data + 'T12:00:00');
    const isHoje = data === hoje;
    return {
      data,
      abrev: isHoje ? 'Hoje' : DIAS_SEMANA_PT[d.getDay()],
      cards: val.cards,
      acerto: val.cards > 0 ? Math.round((val.acertos / val.cards) * 100) : 0,
      xp: val.acertos * 10,
    };
  });

  // ── Linha do tempo (últimos 7 dias com atividade) ─────────────────
  const linhaTempo = semana
    .filter((d) => d.cards > 0)
    .reverse();

  // ── Streak ────────────────────────────────────────────────────────
  const { data: streakData } = await supabase
    .from('streak')
    .select('data')
    .eq('user_id', user.id)
    .order('data', { ascending: false });

  const streakDatas = (streakData ?? []).map((r) => r.data as string);

  let streakAtual = 0;
  if (streakDatas.length > 0) {
    const maisRecente = streakDatas[0];
    const diffMs = new Date(hoje).getTime() - new Date(maisRecente).getTime();
    const diffDias = Math.round(diffMs / 86_400_000);
    if (diffDias <= 1) {
      streakAtual = 1;
      for (let i = 1; i < streakDatas.length; i++) {
        const diff = Math.round(
          (new Date(streakDatas[i - 1]).getTime() - new Date(streakDatas[i]).getTime()) / 86_400_000,
        );
        if (diff === 1) streakAtual++;
        else break;
      }
    }
  }

  // Melhor streak histórico
  let melhorStreak = 0;
  if (streakDatas.length > 0) {
    let current = 1;
    for (let i = 1; i < streakDatas.length; i++) {
      const diff = Math.round(
        (new Date(streakDatas[i - 1]).getTime() - new Date(streakDatas[i]).getTime()) / 86_400_000,
      );
      if (diff === 1) {
        current++;
      } else {
        melhorStreak = Math.max(melhorStreak, current);
        current = 1;
      }
    }
    melhorStreak = Math.max(melhorStreak, current);
  }

  // ── Cards por tema (via baralhos) ─────────────────────────────────
  const { data: baralhoData } = await supabase
    .from('baralhos')
    .select('id, nome, tema, cor, cards(id, intervalo, repeticoes)')
    .eq('user_id', user.id);

  const temas = (baralhoData ?? []).map((b) => {
    const cardsArr = (b.cards ?? []) as Array<{ id: string; intervalo: number; repeticoes: number }>;
    const total = cardsArr.length;
    const dominados = cardsArr.filter((c) => c.intervalo >= 21 && c.repeticoes >= 5).length;
    return {
      nome: b.nome as string,
      tema: b.tema as string,
      cor: (b.cor as string) || '#1260CC',
      total,
      dominados,
    };
  }).filter((t) => t.total > 0);

  return NextResponse.json({
    totalEstudados,
    acertosTotal: acertos,
    xpTotal,
    nivelAtual,
    estudadosSemana,
    taxaAcerto,
    streakAtual,
    melhorStreak,
    semana,
    linhaTempo,
    temas,
  });
}
