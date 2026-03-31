// API de notificações — lembrete e conquista via Firebase Cloud Messaging

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { enviarPushMultiplo, enviarPushParaUsuario, parseTokens } from '@/lib/firebase-admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null } as const;
  return { user } as const;
}

function inicioDoDia() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// POST /api/notificacoes
// Corpo: { tipo: 'lembrete' | 'conquista', ...params }
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { tipo } = body;

  // ── LEMBRETE ─────────────────────────────────────────────────────────
  if (tipo === 'lembrete') {
    try {
      return await handleLembrete(supabase);
    } catch (err) {
      return NextResponse.json({ error: `Lembrete falhou: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }
  }

  // ── CONQUISTA ─────────────────────────────────────────────────────────
  if (tipo === 'conquista') {
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const titulo = typeof body.titulo === 'string' ? body.titulo : '🏆 Conquista desbloqueada!';
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem : 'Você desbloqueou uma nova conquista.';
    return await handleConquista(supabase, user.id, titulo, mensagem);
  }

  // ── MISSAO_COMPLETA ───────────────────────────────────────────────────
  if (tipo === 'missao_completa') {
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const tituloMissao = typeof body.titulo === 'string' ? body.titulo : 'Missão';
    const xp = typeof body.xp === 'number' ? body.xp : 0;
    return await handleMissaoCompleta(supabase, user.id, tituloMissao, xp);
  }

  // ── STREAK ────────────────────────────────────────────────────────────
  if (tipo === 'streak') {
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const dias = typeof body.dias === 'number' ? body.dias : 7;
    return await handleStreak(supabase, user.id, dias);
  }

  // ── BROADCAST (envia para TODOS os usuários) ──────────────────────────
  if (tipo === 'broadcast') {
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }
    const titulo = typeof body.titulo === 'string' ? body.titulo : '🔔 Notificação';
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem : 'Nova mensagem do Maestro!';
    try {
      return await handleBroadcast(titulo, mensagem);
    } catch (err) {
      return NextResponse.json({ error: `Broadcast falhou: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Tipo desconhecido. Use: lembrete, conquista, missao_completa, streak, broadcast.' }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLembrete(
  _supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const admin = createAdminClient();
  // Busca usuários que não estudaram hoje e têm token FCM
  const hojeInicio = inicioDoDia();

  // IDs que estudaram hoje
  const { data: estudaramHoje } = await admin
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', hojeInicio);

  const idsAtivos = new Set((estudaramHoje ?? []).map((r) => r.user_id));

  // Busca todos os profiles com FCM token (admin bypasses RLS)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, fcm_token')
    .not('fcm_token', 'is', null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, enviado: 0, mensagem: 'Nenhum token FCM cadastrado.' });
  }

  // Filtra quem NÃO estudou hoje
  const alvos = profiles.filter((p) => p.fcm_token && !idsAtivos.has(p.id));

  if (alvos.length === 0) {
    return NextResponse.json({ ok: true, enviado: 0, mensagem: 'Todos os usuários já estudaram hoje.' });
  }

  // Conta cards vencidos por usuário (média para mensagem genérica)
  const { count: totalVencidos } = await admin
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .lte('proximo_revisao', new Date().toISOString());

  const cardsMsg = (totalVencidos ?? 0) > 0 ? `${totalVencidos} cards` : 'cards';

  // Extrair todos os tokens de todos os usuários alvo
  const allTokens = alvos.flatMap((p) => parseTokens(p.fcm_token as string));
  const resultado = await enviarPushMultiplo(
    allTokens,
    '🔥 Não perca seu streak!',
    `Você tem ${cardsMsg} para revisar hoje. Mantenha sua sequência!`,
    '/dashboard/estudar',
  );

  return NextResponse.json({ ok: true, ...resultado });
}

async function handleConquista(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  titulo: string,
  mensagem: string,
) {
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  if (profileErr) {
    return NextResponse.json({
      ok: false,
      enviado: false,
      motivo: `Erro ao buscar profile: ${profileErr.message} (code: ${profileErr.code})`,
      userId,
    });
  }

  const tokens = parseTokens(profile?.fcm_token);
  if (tokens.length === 0) {
    return NextResponse.json({
      ok: true,
      enviado: false,
      motivo: 'Sem FCM token no perfil.',
      userId,
      profileEncontrado: !!profile,
    });
  }

  const resultado = await enviarPushParaUsuario(tokens, titulo, mensagem, '/dashboard/missoes');

  // Limpar tokens inválidos
  let tokensLimpos = tokens;
  if (resultado.tokensInvalidos.length > 0) {
    tokensLimpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
    await admin.from('profiles').update({ fcm_token: JSON.stringify(tokensLimpos) }).eq('id', userId);
  }

  return NextResponse.json({
    ok: resultado.ok,
    enviado: resultado.ok,
    enviados: resultado.enviados,
    falhas: resultado.falhas,
    erroEnvio: resultado.erros.length > 0 ? resultado.erros.join('; ') : null,
    messageIds: resultado.messageIds,
    totalTokens: tokens.length,
    tokensRemovidos: resultado.tokensInvalidos.length,
    tokensRestantes: tokensLimpos.length,
  });
}

async function handleMissaoCompleta(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tituloMissao: string,
  xp: number,
) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  const tokens = parseTokens(profile?.fcm_token);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Sem FCM token.' });
  }

  const resultado = await enviarPushParaUsuario(
    tokens,
    '🏆 Missão concluída!',
    `${tituloMissao} — +${xp} XP ganhos! Continue assim!`,
    '/dashboard/missoes',
  );

  if (resultado.tokensInvalidos.length > 0) {
    const tokensLimpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
    await admin.from('profiles').update({ fcm_token: JSON.stringify(tokensLimpos) }).eq('id', userId);
  }

  return NextResponse.json({ ok: true, enviados: resultado.enviados, falhas: resultado.falhas });
}

async function handleBroadcast(
  titulo: string,
  mensagem: string,
) {
  const admin = createAdminClient();
  // Busca TODOS os profiles com FCM token (admin bypasses RLS)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, fcm_token')
    .not('fcm_token', 'is', null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Nenhum token FCM cadastrado.', usuarios: 0 });
  }

  let totalEnviados = 0;
  let totalFalhas = 0;
  let totalTokens = 0;
  const allMessageIds: string[] = [];
  const erros: string[] = [];

  for (const profile of profiles) {
    const tokens = parseTokens(profile.fcm_token);
    if (tokens.length === 0) continue;
    totalTokens += tokens.length;

    const resultado = await enviarPushParaUsuario(tokens, titulo, mensagem, '/dashboard');
    totalEnviados += resultado.enviados;
    totalFalhas += resultado.falhas;
    allMessageIds.push(...resultado.messageIds);
    if (resultado.erros.length > 0) erros.push(...resultado.erros);

    // Limpar tokens inválidos
    if (resultado.tokensInvalidos.length > 0) {
      const tokensLimpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
      await admin.from('profiles').update({ fcm_token: JSON.stringify(tokensLimpos) }).eq('id', profile.id);
    }
  }

  return NextResponse.json({
    ok: totalEnviados > 0,
    enviados: totalEnviados,
    falhas: totalFalhas,
    totalTokens,
    usuarios: profiles.length,
    messageIds: allMessageIds,
    erros: erros.length > 0 ? erros : null,
  });
}

async function handleStreak(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dias: number,
) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  const tokens = parseTokens(profile?.fcm_token);
  if (tokens.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Sem FCM token.' });
  }

  const marcos: Record<number, string> = {
    7:  '🔥 7 dias seguidos! Incrível! Você está pegando o ritmo!',
    14: '😤 14 dias! Sua dedicação é impressionante!',
    30: '💎 30 dias seguidos! Você é imparável!',
    60: '👑 60 dias! Maestro de verdade!',
    100: '🌟 100 dias! Uma lenda viva dos idiomas!',
  };

  const corpo = marcos[dias] ?? `🔥 ${dias} dias seguidos! Continue assim!`;

  const resultado = await enviarPushParaUsuario(tokens, '🔥 Streak incrível!', corpo, '/dashboard');

  if (resultado.tokensInvalidos.length > 0) {
    const tokensLimpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
    await admin.from('profiles').update({ fcm_token: JSON.stringify(tokensLimpos) }).eq('id', userId);
  }

  return NextResponse.json({ ok: true, enviados: resultado.enviados, falhas: resultado.falhas });
}
