import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const maxDuration = 30;

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
  if (!supabaseUrl) {
    return NextResponse.json(
      { error: 'Configuração de URL do Supabase ausente no servidor.' },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Envie o arquivo via FormData.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const aulaId = (formData.get('aulaId') as string | null)?.trim() ?? '';

  if (!file || !aulaId) {
    return NextResponse.json(
      { error: 'Informe aulaId e o arquivo para enviar o material.' },
      { status: 400 },
    );
  }

  const fileName = sanitizeFileName(file.name);
  const path = `${aulaId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await serverClient.storage
    .from('aula-materiais')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: `Erro ao enviar arquivo: ${error.message}` },
      { status: 500 },
    );
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/aula-materiais/${path}`;

  return NextResponse.json({ publicUrl, path });
}