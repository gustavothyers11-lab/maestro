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

  if (resultado.tokensInvalidos.length > 0) {
    const limpos = tokens.filter((t) => !resultado.tokensInvalidos.includes(t));
    await admin.from('profiles').update({ fcm_token: JSON.stringify(limpos) }).eq('id', profile.id);
  }

  return { enviados: resultado.enviados, falhas: resultado.falhas };
}

// ---------------------------------------------------------------------------
// GET /api/cron/notificacoes          → envia TODAS as notificações
// GET /api/cron/notificacoes?tipo=X   → envia só um tipo específico
//   tipos: lembrete | streak | resumo
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Verificar CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const tipo = request.nextUrl.searchParams.get('tipo'); // null = todos
  const tiposValidos = ['lembrete', 'streak', 'resumo'];
  if (tipo && !tiposValidos.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Use: ${tiposValidos.join(', ')}` },
      { status: 400 },
    );
  }

  const enviarLembrete = !tipo || tipo === 'lembrete';
  const enviarStreak = !tipo || tipo === 'streak';
  const enviarResumo = !tipo || tipo === 'resumo';

  const admin = createAdminClient();

  // Buscar todos os profiles com token
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, fcm_token')
    .not('fcm_token', 'is', null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, motivo: 'Sem tokens', notificacoes: [] });
  }

  const hojeInicio = inicioDoDiaBRT();
  const ontemInicio = new Date(new Date(hojeInicio).getTime() - 24 * 60 * 60 * 1000).toISOString();

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
  };

  for (const profile of profiles as ProfileComToken[]) {
    // ── 1. LEMBRETE DE CARDS PENDENTES ──────────────────────────────
    if (enviarLembrete) {
      const { count: pendentes } = await admin
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .lte('proximo_revisao', new Date().toISOString());

      const nPendentes = pendentes ?? 0;

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

    // ── 3. RESUMO SEMANAL (domingo, ou forçado via ?tipo=resumo) ────
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


