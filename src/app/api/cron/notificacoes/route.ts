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

type ProfileComToken = { id: string; fcm_token: string; meta_diaria: number | null };
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

  if (resultado.tokensInvalidos.length > 0) {
    const limpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
    await admin.from('profiles').update({ fcm_token: JSON.stringify(limpos) }).eq('id', profile.id);
  }

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

  const admin = createAdminClient();

  // Buscar todos os profiles com token
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, fcm_token, meta_diaria')
    .not('fcm_token', 'is', null);

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
  };

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
          `☀️ Bom dia! Você tem ${nPendentes} cards esperando revisão.`,
          `📚 ${nPendentes} cards prontos — uma sessão rápida faz diferença!`,
          `🎯 Seus ${nPendentes} cards estão esperando. Que tal estudar agora?`,
          `⚡ ${nPendentes} cards para revisar. 5 minutos e você mantém o ritmo!`,
          `🌟 Hora de brilhar! ${nPendentes} cards pendentes no seu baralho.`,
        ]);
        const r = await enviarLimpo(admin, profile, '📚 Hora de estudar!', msg, '/dashboard/estudar');
        resultados.lembrete.enviados += r.enviados;
        resultados.lembrete.falhas += r.falhas;
      } else if (nPendentes > 0 && idsHoje.has(profile.id)) {
        const msg = pick([
          `💪 Boa! Já estudou hoje, mas ainda tem ${nPendentes} cards. Bora zerar?`,
          `🔥 Você está no ritmo! Mais ${nPendentes} cards e o dia está completo.`,
        ]);
        const r = await enviarLimpo(admin, profile, '💪 Continue assim!', msg, '/dashboard/estudar');
        resultados.lembrete.enviados += r.enviados;
        resultados.lembrete.falhas += r.falhas;
      }
    }

    // ── 2. STREAK EM RISCO ──────────────────────────────────────────
    if (enviarStreak && idsOntem.has(profile.id) && !idsHoje.has(profile.id)) {
      const msg = pick([
        '⏰ Seu streak acaba à meia-noite! Revise pelo menos 1 card.',
        '🔥 Não deixe seu streak morrer! Falta pouco para fechar o dia.',
        '⚠️ Streak em perigo! Uma revisão rápida salva sua sequência.',
      ]);
      const r = await enviarLimpo(admin, profile, '🔥 Streak em perigo!', msg, '/dashboard/estudar');
      resultados.streak.enviados += r.enviados;
      resultados.streak.falhas += r.falhas;
    }

    // ── 3. META QUASE CONCLUIDA ─────────────────────────────────────
    if (enviarMetaQuase) {
      const metaDiaria = Math.max(5, profile.meta_diaria ?? 20);
      const faltam = metaDiaria - nRevisoesHoje;
      if (faltam > 0 && faltam <= 3) {
        const msg = pick([
          `🎯 Falta só ${faltam} card${faltam > 1 ? 's' : ''} para bater sua meta de hoje!`,
          `🚀 Você está quase lá: faltam ${faltam} revisão${faltam > 1 ? 'ões' : ''}.`,
          `✅ Mais ${faltam} card${faltam > 1 ? 's' : ''} e sua meta diária está concluída!`,
        ]);
        const r = await enviarLimpo(admin, profile, '🎯 Meta quase batida!', msg, '/dashboard/estudar');
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
          `🔥 ${streakAtual} dias seguidos! Sua consistência está incrível.`,
          `🏆 Você bateu ${streakAtual} dias de sequência. Continue assim!`,
          `🌟 Parabéns! Streak de ${streakAtual} dias alcançado.`,
        ]);
        const r = await enviarLimpo(admin, profile, '🔥 Consistência em alta!', msg, '/dashboard/progresso');
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
          `🧩 Você tem ${nNovasMissoes} missão${nNovasMissoes > 1 ? 'ões novas' : ' nova'} esperando por você.`,
          `🎮 Missão${nNovasMissoes > 1 ? 'ões novas' : ' nova'} liberada${nNovasMissoes > 1 ? 's' : ''}! Bora ganhar XP?`,
        ]);
        const r = await enviarLimpo(admin, profile, '🧩 Missões liberadas!', msg, '/dashboard/missoes');
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
          '👋 Sentimos sua falta. Volte com uma sessão curta hoje!',
          '🔁 Retome o ritmo: 5 minutos agora já fazem diferença.',
          `📚 Você tem ${nPendentes} cards esperando. Bora voltar?`,
        ]);
        const r = await enviarLimpo(admin, profile, '👋 Hora de voltar!', msg, '/dashboard/estudar');
        resultados.reativacao.enviados += r.enviados;
        resultados.reativacao.falhas += r.falhas;
      }
    }

    // ── 7. SESSAO CURTA INTELIGENTE ──────────────────────────────────
    if (enviarSessaoCurta && !idsHoje.has(profile.id) && nPendentes >= 1 && nPendentes <= 5) {
      const msg = pick([
        `⏱️ Só ${nPendentes} card${nPendentes > 1 ? 's' : ''}. Em 2 minutos você resolve!`,
        '⚡ Sessão relâmpago disponível. Entre e finalize rapidinho.',
        '🎯 Poucos cards pendentes hoje. Bora zerar agora?',
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
        ? '📊 Nenhum card revisado esta semana. Que tal começar amanhã?'
        : `📊 Esta semana: ${total} cards revisados com ${taxa}% de acerto. ${taxa >= 80 ? 'Excelente! 🏆' : 'Continue praticando! 💪'}`;

      const r = await enviarLimpo(admin, profile, '📊 Resumo Semanal', msg, '/dashboard/progresso');
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


