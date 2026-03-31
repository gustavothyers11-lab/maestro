// Cron endpoint para notificações automáticas agendadas
// Chamado pelo Vercel Cron Jobs em horários configurados em vercel.json

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enviarPushParaUsuario, parseTokens } from '@/lib/firebase-admin';

// Horário de Brasília (UTC-3)
function horasBRT() {
  const now = new Date();
  // UTC offset for BRT is -3
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return { hora: brt.getUTCHours(), diaSemana: brt.getUTCDay(), brt };
}

function inicioDoDiaBRT() {
  const { brt } = horasBRT();
  brt.setUTCHours(0, 0, 0, 0);
  // Converter de volta para UTC adicionando 3h
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

function inicioSemanaBRT() {
  const { brt } = horasBRT();
  const dia = brt.getUTCDay(); // 0=dom
  brt.setUTCDate(brt.getUTCDate() - dia);
  brt.setUTCHours(0, 0, 0, 0);
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Tipos de notificação automática
// ---------------------------------------------------------------------------

type ProfileComToken = { id: string; fcm_token: string };

async function getAllProfilesComToken() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('id, fcm_token')
    .not('fcm_token', 'is', null);
  return (data ?? []) as ProfileComToken[];
}

async function enviarParaTodos(
  profiles: ProfileComToken[],
  titulo: string,
  mensagem: string,
  link: string,
) {
  const admin = createAdminClient();
  let enviados = 0;
  let falhas = 0;

  for (const profile of profiles) {
    const tokens = parseTokens(profile.fcm_token);
    if (tokens.length === 0) continue;

    const resultado = await enviarPushParaUsuario(tokens, titulo, mensagem, link);
    enviados += resultado.enviados;
    falhas += resultado.falhas;

    // Limpar tokens inválidos
    if (resultado.tokensInvalidos.length > 0) {
      const limpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
      await admin.from('profiles').update({ fcm_token: JSON.stringify(limpos) }).eq('id', profile.id);
    }
  }

  return { enviados, falhas, usuarios: profiles.length };
}

// ---------------------------------------------------------------------------
// 1. LEMBRETE MATINAL (9h BRT) — Cards para revisar hoje
// ---------------------------------------------------------------------------
async function lembreteMatinal() {
  const admin = createAdminClient();
  const profiles = await getAllProfilesComToken();
  if (profiles.length === 0) return { tipo: 'manha', enviados: 0, motivo: 'Sem tokens' };

  let enviados = 0;
  let falhas = 0;

  for (const profile of profiles) {
    const tokens = parseTokens(profile.fcm_token);
    if (tokens.length === 0) continue;

    // Contar cards vencidos deste usuário
    const { count } = await admin
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .lte('proximo_revisao', new Date().toISOString());

    const pendentes = count ?? 0;
    if (pendentes === 0) continue; // Não incomodar se não tem nada para revisar

    const msgs = [
      `☀️ Bom dia! Você tem ${pendentes} cards esperando revisão.`,
      `🌅 Hora de estudar! ${pendentes} cards prontos para revisão.`,
      `📚 ${pendentes} cards vencem hoje — comece sua sessão!`,
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];

    const resultado = await enviarPushParaUsuario(tokens, '📚 Hora de estudar!', msg, '/dashboard/estudar');
    enviados += resultado.enviados;
    falhas += resultado.falhas;

    if (resultado.tokensInvalidos.length > 0) {
      const limpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
      await admin.from('profiles').update({ fcm_token: JSON.stringify(limpos) }).eq('id', profile.id);
    }
  }

  return { tipo: 'manha', enviados, falhas };
}

// ---------------------------------------------------------------------------
// 2. LEMBRETE DA TARDE (14h BRT) — Quem não estudou hoje
// ---------------------------------------------------------------------------
async function lembreteTarde() {
  const admin = createAdminClient();
  const profiles = await getAllProfilesComToken();
  if (profiles.length === 0) return { tipo: 'tarde', enviados: 0, motivo: 'Sem tokens' };

  const hojeInicio = inicioDoDiaBRT();

  // IDs que já estudaram hoje
  const { data: estudaramHoje } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', hojeInicio);

  const idsAtivos = new Set((estudaramHoje ?? []).map((r) => r.user_id));

  // Filtrar quem NÃO estudou
  const alvos = profiles.filter((p) => !idsAtivos.has(p.id));
  if (alvos.length === 0) return { tipo: 'tarde', enviados: 0, motivo: 'Todos já estudaram hoje' };

  const msgs = [
    '📖 Que tal uma sessão rápida? Seus cards estão esperando!',
    '⚡ 5 minutos fazem diferença! Revise seus cards agora.',
    '🎯 Pausa para estudar? Mantenha o ritmo com uma revisão.',
  ];
  const msg = msgs[Math.floor(Math.random() * msgs.length)];

  const resultado = await enviarParaTodos(alvos, '📖 Lembrete de estudo', msg, '/dashboard/estudar');
  return { tipo: 'tarde', ...resultado };
}

// ---------------------------------------------------------------------------
// 3. STREAK EM RISCO (21h BRT) — Quem tem streak e não estudou
// ---------------------------------------------------------------------------
async function streakEmRisco() {
  const admin = createAdminClient();
  const profiles = await getAllProfilesComToken();
  if (profiles.length === 0) return { tipo: 'streak_risco', enviados: 0, motivo: 'Sem tokens' };

  const hojeInicio = inicioDoDiaBRT();

  // Quem estudou hoje
  const { data: estudaramHoje } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', hojeInicio);

  const idsAtivos = new Set((estudaramHoje ?? []).map((r) => r.user_id));

  // Quem tem streak ativo (estudou ontem) mas NÃO estudou hoje
  const ontemFim = hojeInicio;
  const ontemInicio = new Date(new Date(hojeInicio).getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: estudaramOntem } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', ontemInicio)
    .lt('respondido_em', ontemFim);

  const idsOntem = new Set((estudaramOntem ?? []).map((r) => r.user_id));

  // Alvos: estudou ontem MAS não estudou hoje E tem token
  const alvos = profiles.filter((p) => idsOntem.has(p.id) && !idsAtivos.has(p.id));
  if (alvos.length === 0) return { tipo: 'streak_risco', enviados: 0, motivo: 'Ninguém com streak em risco' };

  const resultado = await enviarParaTodos(
    alvos,
    '🔥 Streak em perigo!',
    '⏰ Seu streak acaba à meia-noite! Revise pelo menos 1 card para manter a sequência.',
    '/dashboard/estudar',
  );
  return { tipo: 'streak_risco', ...resultado };
}

// ---------------------------------------------------------------------------
// 4. RESUMO SEMANAL (domingo 18h BRT)
// ---------------------------------------------------------------------------
async function resumoSemanal() {
  const admin = createAdminClient();
  const profiles = await getAllProfilesComToken();
  if (profiles.length === 0) return { tipo: 'resumo_semanal', enviados: 0, motivo: 'Sem tokens' };

  const inicioSemana = inicioSemanaBRT();
  let enviados = 0;
  let falhas = 0;

  for (const profile of profiles) {
    const tokens = parseTokens(profile.fcm_token);
    if (tokens.length === 0) continue;

    // Stats da semana deste usuário
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

    let msg: string;
    if (total === 0) {
      msg = '📊 Nenhum card revisado esta semana. Que tal começar amanhã?';
    } else {
      msg = `📊 Esta semana: ${total} cards revisados com ${taxa}% de acerto. ${taxa >= 80 ? 'Excelente! 🏆' : 'Continue praticando! 💪'}`;
    }

    const resultado = await enviarPushParaUsuario(tokens, '📊 Resumo Semanal', msg, '/dashboard/progresso');
    enviados += resultado.enviados;
    falhas += resultado.falhas;

    if (resultado.tokensInvalidos.length > 0) {
      const limpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
      await admin.from('profiles').update({ fcm_token: JSON.stringify(limpos) }).eq('id', profile.id);
    }
  }

  return { tipo: 'resumo_semanal', enviados, falhas };
}

// ---------------------------------------------------------------------------
// GET /api/cron/notificacoes?tipo=manha|tarde|streak_risco|resumo_semanal
// Protegido por CRON_SECRET (Vercel envia automaticamente)
// ---------------------------------------------------------------------------

const handlers: Record<string, () => Promise<Record<string, unknown>>> = {
  manha: lembreteMatinal,
  tarde: lembreteTarde,
  streak_risco: streakEmRisco,
  resumo_semanal: resumoSemanal,
};

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET (Vercel envia no header Authorization)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo');

  if (!tipo || !handlers[tipo]) {
    return NextResponse.json({
      error: `Tipo inválido. Use: ${Object.keys(handlers).join(', ')}`,
    }, { status: 400 });
  }

  try {
    const resultado = await handlers[tipo]();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
