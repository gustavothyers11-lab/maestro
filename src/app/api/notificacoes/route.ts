// API de notificações — lembrete e conquista via Firebase Cloud Messaging

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { enviarPush, enviarPushMultiplo } from '@/lib/firebase-admin';

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
    return await handleLembrete(supabase);
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

  return NextResponse.json({ error: 'Tipo desconhecido. Use: lembrete, conquista, missao_completa, streak.' }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleLembrete(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  // Busca usuários que não estudaram hoje e têm token FCM
  const hojeInicio = inicioDoDia();

  // IDs que estudaram hoje
  const { data: estudaramHoje } = await supabase
    .from('progresso')
    .select('user_id')
    .gte('respondido_em', hojeInicio);

  const idsAtivos = new Set((estudaramHoje ?? []).map((r) => r.user_id));

  // Busca todos os profiles com FCM token
  const { data: profiles } = await supabase
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
  const { count: totalVencidos } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .lte('proximo_revisao', new Date().toISOString());

  const cardsMsg = (totalVencidos ?? 0) > 0 ? `${totalVencidos} cards` : 'cards';

  const tokens = alvos.map((p) => p.fcm_token as string);
  const resultado = await enviarPushMultiplo(
    tokens,
    '🔥 Não perca seu streak!',
    `Você tem ${cardsMsg} para revisar hoje. Mantenha sua sequência!`,
    '/dashboard/estudar',
  );

  return NextResponse.json({ ok: true, ...resultado });
}

async function handleConquista(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  titulo: string,
  mensagem: string,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  if (!profile?.fcm_token) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Sem FCM token.' });
  }

  const enviado = await enviarPush({
    token: profile.fcm_token,
    titulo,
    corpo: mensagem,
    url: '/dashboard/missoes',
  });

  return NextResponse.json({ ok: true, enviado });
}

async function handleMissaoCompleta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  tituloMissao: string,
  xp: number,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  if (!profile?.fcm_token) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Sem FCM token.' });
  }

  const enviado = await enviarPush({
    token: profile.fcm_token,
    titulo: '🏆 Missão concluída!',
    corpo: `${tituloMissao} — +${xp} XP ganhos! Continue assim!`,
    url: '/dashboard/missoes',
  });

  return NextResponse.json({ ok: true, enviado });
}

async function handleStreak(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dias: number,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  if (!profile?.fcm_token) {
    return NextResponse.json({ ok: true, enviado: false, motivo: 'Sem FCM token.' });
  }

  const marcos: Record<number, string> = {
    7:  '🔥 7 dias seguidos! Incrível! Você está pegando o ritmo!',
    14: '😤 14 dias! Sua dedicação é impressionante!',
    30: '💎 30 dias seguidos! Você é imparável!',
    60: '👑 60 dias! Maestro de verdade!',
    100: '🌟 100 dias! Uma lenda viva do espanhol!',
  };

  const corpo = marcos[dias] ?? `🔥 ${dias} dias seguidos! Continue assim!`;

  const enviado = await enviarPush({
    token: profile.fcm_token,
    titulo: '🔥 Streak incrível!',
    corpo,
    url: '/dashboard',
  });

  return NextResponse.json({ ok: true, enviado });
}
