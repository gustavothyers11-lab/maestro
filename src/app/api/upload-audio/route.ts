import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/upload-audio
 * Gera uma signed upload URL para o bucket audio-temp usando a service role key.
 * Assim o cliente faz upload direto no Storage sem precisar de RLS policies.
 */
export async function POST(request: Request) {
  try {
    const { path } = (await request.json()) as { path?: string };

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'path é obrigatório.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!serviceRole) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    const { data, error } = await supabaseAdmin.storage
      .from('audio-temp')
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json(
        { error: `Erro ao gerar URL de upload: ${error?.message ?? 'sem dados'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro inesperado.' },
      { status: 500 },
    );
  }
}
