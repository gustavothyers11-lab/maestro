import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const maxDuration = 10;

function sanitizeFileName(fileName: string): string {
  const normalized = fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_');
  return normalized.length > 0 ? normalized : `material_${Date.now()}`;
}

export async function POST(request: Request) {
  const serverClient = await createServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return NextResponse.json(
      { error: 'Configuração de storage ausente no servidor.' },
      { status: 500 },
    );
  }

  let body: { aulaId?: string; fileName?: string };
  try {
    body = (await request.json()) as { aulaId?: string; fileName?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const aulaId = typeof body.aulaId === 'string' ? body.aulaId.trim() : '';
  const fileName = typeof body.fileName === 'string' ? sanitizeFileName(body.fileName) : '';

  if (!aulaId || !fileName) {
    return NextResponse.json(
      { error: 'Informe aulaId e fileName para enviar o material.' },
      { status: 400 },
    );
  }

  const path = `${aulaId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;
  const adminClient = createAdminClient(supabaseUrl, serviceRole);

  const { data, error } = await adminClient.storage
    .from('aula-materiais')
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: `Não foi possível gerar URL de upload: ${error?.message ?? 'erro desconhecido'}` },
      { status: 500 },
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/aula-materiais/${path}`;

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path: data.path,
    publicUrl,
  });
}