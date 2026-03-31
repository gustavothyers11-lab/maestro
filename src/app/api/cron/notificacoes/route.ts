// Cron endpoint — roda 1x por dia e envia TODAS as notificações aplicáveis
// Vercel Hobby: 1 cron por dia é suficiente

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enviarPushParaUsuario, parseTokens } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function inicioDoDiaBRT() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

function inicioSemanaBRT() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dia = brt.getUTCDay();
  brt.setUTCDate(brt.getUTCDate() - dia);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

function isDomingo() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.getUTCDay() === 0;
}

function hojeBRTDate() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function diasAtrasISO(baseISO: string, dias: number) {
  return new Date(new Date(baseISO).getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
}

function calcularStreakAtual(
  registros: Array<{ data: string; meta_atingida: boolean }> | null | undefined,
) {
  const validos = (registros ?? [])
    .filter((r) => r.meta_atingida)
    .map((r) => r.data)
    .sort((a, b) => b.localeCompare(a));

  if (validos.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < validos.length; i++) {
    const atual = new Date(validos[i - 1]).getTime();
    const prox = new Date(validos[i]).getTime();
    const diffDias = Math.round((atual - prox) / 86_400_000);
    if (diffDias === 1) streak += 1;
    else break;
  }

  return streak;
}

type ProfileComToken = { id: string; fcm_token: string };
type Resultado = { enviados: number; falhas: number };

async function enviarLimpo(
  admin: ReturnType<typeof createAdminClient>,
  profile: ProfileComToken,
  titulo: string,
  msg: string,
  link: string,
): Promise<Resultado> {
  const tokens = parseTokens(profile.fcm_token);
  if (tokens.length === 0) return { enviados: 0, falhas: 0 };

  const resultado = await enviarPushParaUsuario(tokens, titulo, msg, link);

  // NÃO remover tokens "inválidos" — em mobile/PWA o SW dorme e
  // retorna not-registered temporariamente, mas volta a funcionar
  // quando o usuário abre o app. O re-registro automático (4h)
  // cuida de manter tokens atualizados.

  return { enviados: resultado.enviados, falhas: resultado.falhas };
}

// ---------------------------------------------------------------------------
// GET /api/cron/notificacoes          → envia TODAS as notificações
// GET /api/cron/notificacoes?tipo=X   → envia só um tipo específico
// tipos:
// - lembrete       (cards pendentes)
// - streak         (streak em risco)
// - resumo         (resumo semanal)
// - meta_quase     (falta pouco para meta diaria)
// - consistencia   (parabens por marcos de streak)
// - missao_liberada (missoes novas disponiveis)
// - reativacao     (2+ dias sem estudar)
// - sessao_curta   (sessao de 2 minutos)
// - atalho_amor    (broadcast manual do atalho secreto)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo'); // null = todos
  const tiposValidos = [
    'lembrete',
    'streak',
    'resumo',
    'meta_quase',
    'consistencia',
    'missao_liberada',
    'reativacao',
    'sessao_curta',
    'atalho_amor',
  ];
  if (tipo && !tiposValidos.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Use: ${tiposValidos.join(', ')}` },
      { status: 400 },
    );
  }

  const enviarLembrete = !tipo || tipo === 'lembrete';
  const enviarStreak = !tipo || tipo === 'streak';
  const enviarResumo = !tipo || tipo === 'resumo';
  const enviarMetaQuase = !tipo || tipo === 'meta_quase';
  const enviarConsistencia = !tipo || tipo === 'consistencia';
  const enviarMissaoLiberada = !tipo || tipo === 'missao_liberada';
  const enviarReativacao = !tipo || tipo === 'reativacao';
  const enviarSessaoCurta = !tipo || tipo === 'sessao_curta';
  const enviarAtalhoAmor = tipo === 'atalho_amor';

  const admin = createAdminClient();

  // Buscar todos os profiles com token
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, fcm_token')
    .not('fcm_token', 'is', null);

  if (profilesError) {
    return NextResponse.json({
      ok: false,
      error: `Erro ao buscar tokens: ${profilesError.message}`,
    }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, motivo: 'Sem tokens', notificacoes: [] });
  }

  const hojeInicio = inicioDoDiaBRT();
  const ontemInicio = diasAtrasISO(hojeInicio, 1);
  const doisDiasAtras = diasAtrasISO(hojeInicio, 2);
  const agoraISO = new Date().toISOString();
  const criadasUltimas24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const hojeDataBRT = hojeBRTDate();

  // Quem estudou hoje
  const { data: estudaramHoje } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', hojeInicio);
  const idsHoje = new Set((estudaramHoje ?? []).map((r) => r.user_id));

  // Quem estudou ontem (para streak)
  const { data: estudaramOntem } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', ontemInicio)
    .lt('respondido_em', hojeInicio);
  const idsOntem = new Set((estudaramOntem ?? []).map((r) => r.user_id));

  // Resumo semanal (só domingo, ou forçado via ?tipo=resumo)
  const domingo = isDomingo();
  const inicioSemana = inicioSemanaBRT();

  const resultados: Record<string, { enviados: number; falhas: number }> = {
    lembrete: { enviados: 0, falhas: 0 },
    streak: { enviados: 0, falhas: 0 },
    resumo: { enviados: 0, falhas: 0 },
    meta_quase: { enviados: 0, falhas: 0 },
    consistencia: { enviados: 0, falhas: 0 },
    missao_liberada: { enviados: 0, falhas: 0 },
    reativacao: { enviados: 0, falhas: 0 },
    sessao_curta: { enviados: 0, falhas: 0 },
    atalho_amor: { enviados: 0, falhas: 0 },
  };

  if (enviarAtalhoAmor) {
    for (const profile of profiles as ProfileComToken[]) {
      const r = await enviarLimpo(
        admin,
        profile,
        '💌 Lembrete especial',
        'cuida amor, estudar, sai do tik tok ❤️',
        '/dashboard/estudar',
      );
      resultados.atalho_amor.enviados += r.enviados;
      resultados.atalho_amor.falhas += r.falhas;
    }

    return NextResponse.json({
      ok: true,
      tipo,
      usuarios: profiles.length,
      domingo,
      resultados,
    });
  }

  for (const profile of profiles as ProfileComToken[]) {
    const { count: pendentes } = await admin
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .lte('proximo_revisao', agoraISO);

    const nPendentes = pendentes ?? 0;

    const { count: revisoesHoje } = await admin
      .from('progresso')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('respondido_em', hojeInicio);
    const nRevisoesHoje = revisoesHoje ?? 0;

    // ── 1. LEMBRETE DE CARDS PENDENTES ──────────────────────────────
    if (enviarLembrete) {
      if (nPendentes > 0 && !idsHoje.has(profile.id)) {
        const msg = pick([
          `Lembrete diário: você tem ${nPendentes} cards esperando revisão.`,
          `Lembrete diário: ${nPendentes} cards prontos, uma sessão rápida faz diferença!`,
          `Lembrete diário: seus ${nPendentes} cards estão esperando.`,
          `Lembrete diário: ${nPendentes} cards para revisar em 5 minutos.`,
          `Lembrete diário: ${nPendentes} cards pendentes no seu baralho.`,
        ]);
        const r = await enviarLimpo(admin, profile, '📚 Lembrete diário', msg, '/dashboard/estudar');
        resultados.lembrete.enviados += r.enviados;
        resultados.lembrete.falhas += r.falhas;
      } else if (nPendentes > 0 && idsHoje.has(profile.id)) {
        const msg = pick([
          `Lembrete diário: você já estudou, mas ainda tem ${nPendentes} cards.`,
          `Lembrete diário: mais ${nPendentes} cards e o dia está completo.`,
        ]);
        const r = await enviarLimpo(admin, profile, '📚 Lembrete diário', msg, '/dashboard/estudar');
        resultados.lembrete.enviados += r.enviados;
        resultados.lembrete.falhas += r.falhas;
      }
    }

    // ── 2. STREAK EM RISCO ──────────────────────────────────────────
    if (enviarStreak && idsOntem.has(profile.id) && !idsHoje.has(profile.id)) {
      const msg = pick([
        'Alerta de streak: seu streak acaba à meia-noite, revise pelo menos 1 card.',
        'Alerta de streak: falta pouco para fechar o dia e manter a sequência.',
        'Alerta de streak: uma revisão rápida salva sua sequência.',
      ]);
      const r = await enviarLimpo(admin, profile, '🔥 Alerta de streak', msg, '/dashboard/estudar');
      resultados.streak.enviados += r.enviados;
      resultados.streak.falhas += r.falhas;
    }

    // ── 3. META QUASE CONCLUIDA ─────────────────────────────────────
    if (enviarMetaQuase) {
      const metaDiaria = 20;
      const faltam = metaDiaria - nRevisoesHoje;
      if (faltam > 0 && faltam <= 3) {
        const msg = pick([
          `Meta quase concluída: falta só ${faltam} card${faltam > 1 ? 's' : ''} para bater sua meta.`,
          `Meta quase concluída: faltam ${faltam} revisão${faltam > 1 ? 'ões' : ''}.`,
          `Meta quase concluída: mais ${faltam} card${faltam > 1 ? 's' : ''} e meta batida.`,
        ]);
        const r = await enviarLimpo(admin, profile, '🎯 Meta quase concluída', msg, '/dashboard/estudar');
        resultados.meta_quase.enviados += r.enviados;
        resultados.meta_quase.falhas += r.falhas;
      }
    }

    // ── 4. CONSISTENCIA (MARCOS DE STREAK) ──────────────────────────
    if (enviarConsistencia) {
      const { data: streakData } = await admin
        .from('streak')
        .select('data, meta_atingida')
        .eq('user_id', profile.id)
        .order('data', { ascending: false })
        .limit(45);

      const streakAtual = calcularStreakAtual(streakData as Array<{ data: string; meta_atingida: boolean }>);
      const marcos = [3, 7, 14, 30, 60, 100];
      const registroHoje = (streakData ?? []).find((r) => r.data === hojeDataBRT && r.meta_atingida);
      if (registroHoje && marcos.includes(streakAtual)) {
        const msg = pick([
          `Consistência: ${streakAtual} dias seguidos. Sua disciplina está incrível.`,
          `Consistência: você bateu ${streakAtual} dias de sequência.`,
          `Consistência: parabéns pelo streak de ${streakAtual} dias.`,
        ]);
        const r = await enviarLimpo(admin, profile, '🏆 Marco de consistência', msg, '/dashboard/progresso');
        resultados.consistencia.enviados += r.enviados;
        resultados.consistencia.falhas += r.falhas;
      }
    }

    // ── 5. MISSAO LIBERADA ───────────────────────────────────────────
    if (enviarMissaoLiberada) {
      const { count: novasMissoes } = await admin
        .from('missoes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('concluida', false)
        .eq('progresso', 0)
        .gte('expira_em', agoraISO)
        .gte('criado_em', criadasUltimas24h);

      const nNovasMissoes = novasMissoes ?? 0;
      if (nNovasMissoes > 0) {
        const msg = pick([
          `Missões liberadas: ${nNovasMissoes} missão${nNovasMissoes > 1 ? 'ões novas' : ' nova'} esperando por você.`,
          `Missões liberadas: nova${nNovasMissoes > 1 ? 's' : ''} missão${nNovasMissoes > 1 ? 'ões' : ''} para ganhar XP.`,
        ]);
        const r = await enviarLimpo(admin, profile, '🧩 Missões liberadas', msg, '/dashboard/missoes');
        resultados.missao_liberada.enviados += r.enviados;
        resultados.missao_liberada.falhas += r.falhas;
      }
    }

    // ── 6. RECUPERACAO DE INATIVIDADE (2+ DIAS) ─────────────────────
    if (enviarReativacao) {
      const { data: ultimoProgresso } = await admin
        .from('progresso')
        .select('respondido_em')
        .eq('user_id', profile.id)
        .order('respondido_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ultimoEstudoISO = ultimoProgresso?.respondido_em as string | undefined;
      const inativo2Dias = !ultimoEstudoISO || ultimoEstudoISO < doisDiasAtras;
      if (inativo2Dias && nPendentes > 0) {
        const msg = pick([
          'Reativação: sentimos sua falta. Volte com uma sessão curta hoje.',
          'Reativação: retome o ritmo, 5 minutos já fazem diferença.',
          `Reativação: você tem ${nPendentes} cards esperando.`,
        ]);
        const r = await enviarLimpo(admin, profile, '👋 Reativação de estudos', msg, '/dashboard/estudar');
        resultados.reativacao.enviados += r.enviados;
        resultados.reativacao.falhas += r.falhas;
      }
    }

    // ── 7. SESSAO CURTA INTELIGENTE ──────────────────────────────────
    if (enviarSessaoCurta && !idsHoje.has(profile.id) && nPendentes >= 1 && nPendentes <= 5) {
      const msg = pick([
        `Sessão curta: só ${nPendentes} card${nPendentes > 1 ? 's' : ''}. Em 2 minutos você resolve.`,
        'Sessão curta: revisão relâmpago disponível para agora.',
        'Sessão curta: poucos cards pendentes hoje, bora zerar?',
      ]);
      const r = await enviarLimpo(admin, profile, '⏱️ Sessão curta sugerida', msg, '/dashboard/estudar');
      resultados.sessao_curta.enviados += r.enviados;
      resultados.sessao_curta.falhas += r.falhas;
    }

    // ── 8. RESUMO SEMANAL (domingo, ou forçado via ?tipo=resumo) ────
    if (enviarResumo && (domingo || tipo === 'resumo')) {
      const { count: cardsRevisados } = await admin
        .from('progresso')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('respondido_em', inicioSemana);

      const { count: acertos } = await admin
        .from('progresso')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .gte('respondido_em', inicioSemana)
        .eq('acertou', true);

      const total = cardsRevisados ?? 0;
      const certos = acertos ?? 0;
      const taxa = total > 0 ? Math.round((certos / total) * 100) : 0;

      const msg = total === 0
        ? 'Resumo semanal: nenhum card revisado esta semana. Que tal começar amanhã?'
        : `Resumo semanal: ${total} cards revisados com ${taxa}% de acerto. ${taxa >= 80 ? 'Excelente! 🏆' : 'Continue praticando! 💪'}`;

      const r = await enviarLimpo(admin, profile, '📊 Resumo semanal', msg, '/dashboard/progresso');
      resultados.resumo.enviados += r.enviados;
      resultados.resumo.falhas += r.falhas;
    }
  }

  return NextResponse.json({
    ok: true,
    tipo: tipo ?? 'todos',
    usuarios: profiles.length,
    domingo,
    resultados,
  });
}


