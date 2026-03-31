// API para registrar/gerenciar tokens FCM server-side
// Evita race conditions do client-side read-modify-write

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: { token?: string; oldToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { token, oldToken } = body;
  if (!token || typeof token !== 'string' || token.length < 10) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
  }

  // Ler tokens existentes
  const { data: profile, error: readErr } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', user.id)
    .single();

  let tokens: string[] = [];
  if (!readErr && profile?.fcm_token) {
    try {
      const parsed = JSON.parse(profile.fcm_token);
      tokens = Array.isArray(parsed) ? parsed.filter((t: unknown) => typeof t === 'string' && t.length > 0) : [profile.fcm_token];
    } catch {
      tokens = [profile.fcm_token];
    }
  }

  const tokensBefore = [...tokens];

  // Remover token antigo se fornecido (usado no re-registro)
  if (oldToken && typeof oldToken === 'string') {
    tokens = tokens.filter((t) => t !== oldToken);
  }

  // Adicionar novo token se não existir (max 10 dispositivos)
  if (!tokens.includes(token)) {
    tokens.push(token);
    if (tokens.length > 10) tokens.shift();
  }

  // Salvar
  const { error: writeErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, fcm_token: JSON.stringify(tokens) }, { onConflict: 'id' });

  if (writeErr) {
    return NextResponse.json({
      error: `Erro ao salvar: ${writeErr.message}`,
      tokensBefore: tokensBefore.length,
    }, { status: 500 });
  }

  // Verificação: reler o banco
  const { data: verify } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', user.id)
    .single();

  let tokensAfter: string[] = [];
  if (verify?.fcm_token) {
    try {
      const parsed = JSON.parse(verify.fcm_token);
      tokensAfter = Array.isArray(parsed) ? parsed : [verify.fcm_token];
    } catch {
      tokensAfter = [verify.fcm_token];
    }
  }

  const novoTokenSalvo = tokensAfter.includes(token);

  return NextResponse.json({
    ok: true,
    userId: user.id,
    tokensBefore: tokensBefore.length,
    tokensAfter: tokensAfter.length,
    novoTokenSalvo,
    oldTokenRemovido: oldToken ? !tokensAfter.includes(oldToken) : null,
    tokensPreview: tokensAfter.map((t) => t.slice(0, 30) + '...'),
  });
}

// GET: ver tokens do usuário
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // Tokens deste usuário
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', user.id)
    .single();

  let tokens: string[] = [];
  if (profile?.fcm_token) {
    try {
      const parsed = JSON.parse(profile.fcm_token);
      tokens = Array.isArray(parsed) ? parsed : [profile.fcm_token];
    } catch {
      tokens = [profile.fcm_token];
    }
  }

  // Todos os usuários com token no sistema (admin bypasses RLS)
  let sistema: { usuariosComToken: number; totalTokens: number; outrosUsuarios: { userId: string; tokens: number }[]; erro?: string } = {
    usuariosComToken: 0,
    totalTokens: 0,
    outrosUsuarios: [],
  };

  try {
    const admin = createAdminClient();
    const { data: allProfiles } = await admin
      .from('profiles')
      .select('id, fcm_token')
      .not('fcm_token', 'is', null);

    if (allProfiles) {
      for (const p of allProfiles) {
        let pTokens: string[] = [];
        try {
          const parsed = JSON.parse(p.fcm_token);
          pTokens = Array.isArray(parsed) ? parsed.filter((t: unknown) => typeof t === 'string' && t.length > 0) : [p.fcm_token];
        } catch {
          pTokens = [p.fcm_token];
        }
        if (pTokens.length > 0) {
          sistema.usuariosComToken++;
          sistema.totalTokens += pTokens.length;
          if (p.id !== user.id) {
            sistema.outrosUsuarios.push({ userId: p.id.slice(0, 8) + '...', tokens: pTokens.length });
          }
        }
      }
    }
  } catch (err) {
    sistema.erro = err instanceof Error ? err.message : 'Erro ao buscar sistema';
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    total: tokens.length,
    tokens: tokens.map((t) => t.slice(0, 30) + '...'),
    sistema,
  });
}
