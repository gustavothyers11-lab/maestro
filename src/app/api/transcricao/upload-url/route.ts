import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10;

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { error: 'Configuração de storage ausente no servidor.' },
      { status: 500 },
    );
  }

  let ext: string;
  try {
    const body = (await request.json()) as { ext?: string };
    ext = (['mp3', 'm4a', 'wav'].includes((body.ext ?? '').toLowerCase()) ? body.ext! : 'mp3').toLowerCase();
  } catch {
    ext = 'mp3';
  }

  const nomeUnico = `temp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const supabase = createClient(supabaseUrl, serviceRole);

  const { data, error } = await supabase.storage
    .from('audio-temp')
    .createSignedUploadUrl(nomeUnico);

  if (error || !data) {
    return NextResponse.json(
      { error: `Não foi possível gerar URL de upload: ${error?.message ?? 'erro desconhecido'}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path: data.path, token: data.token });
}
