import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 120;

interface JsonAudioPayload {
  storageUrl?: string;
  storagePath?: string;
  audioBase64?: string;
  ext?: string;
  mime?: string;
}

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

interface GroqTranscricaoResult {
  ok: boolean;
  status: number;
  texto: string;
}

function nomeSeguroParaUpload(nomeOriginal: string | undefined): string {
  const base = (nomeOriginal || 'audio').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (/\.(mp3|m4a|wav|webm|ogg|mp4|mpeg|mpga|flac|mov)$/i.test(base)) return base;
  return `${base}.mp3`;
}

function detectarFormatoAudio(bytes: Uint8Array): { ext: 'wav' | 'mp3' | 'm4a' | 'bin'; mime: string } {
  if (bytes.length >= 12) {
    // WAV: RIFF....WAVE
    const riff = String.fromCharCode(...bytes.slice(0, 4));
    const wave = String.fromCharCode(...bytes.slice(8, 12));
    if (riff === 'RIFF' && wave === 'WAVE') return { ext: 'wav', mime: 'audio/wav' };

    // M4A/MP4: ....ftyp
    const ftyp = String.fromCharCode(...bytes.slice(4, 8));
    if (ftyp === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
  }

  // MP3: ID3 header ou frame sync 0xFFEx
  if (bytes.length >= 3) {
    const id3 = String.fromCharCode(...bytes.slice(0, 3));
    if (id3 === 'ID3') return { ext: 'mp3', mime: 'audio/mpeg' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg' };
  }

  return { ext: 'bin', mime: 'application/octet-stream' };
}

async function chamarGroqTranscricao(params: {
  apiKey: string;
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
}): Promise<GroqTranscricaoResult> {
  const { apiKey, bytes, fileName, mimeType } = params;

  const tentativasPayload: Array<{ model: string; language?: string; response_format?: string }> = [
    { model: 'whisper-large-v3-turbo', language: 'es', response_format: 'text' },
    { model: 'whisper-large-v3-turbo', response_format: 'text' },
    { model: 'whisper-large-v3', language: 'es', response_format: 'text' },
    { model: 'whisper-large-v3', response_format: 'text' },
    { model: 'whisper-large-v3-turbo' },
    { model: 'whisper-large-v3' },
  ];

  let ultimo: GroqTranscricaoResult = {
    ok: false,
    status: 502,
    texto: 'Falha ao transcrever com Groq Whisper.',
  };

  for (const t of tentativasPayload) {
    const payload = new FormData();
    const file = new File([new Uint8Array(bytes)] as any[], fileName, { type: mimeType });

    payload.append('file', file, fileName);
    payload.append('model', t.model);
    if (t.language) payload.append('language', t.language);
    if (t.response_format) payload.append('response_format', t.response_format);

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const texto = (await groqRes.text()).trim();
    ultimo = {
      ok: groqRes.ok,
      status: groqRes.status,
      texto,
    };

    if (groqRes.ok) {
      return ultimo;
    }

    // Erros que não são de pattern provavelmente não vão melhorar com outra combinação.
    if (!/expected pattern|did not match the expected pattern/i.test(texto)) {
      return ultimo;
    }
  }

  return ultimo;
}

// Transcrição via URL (para arquivos grandes no Storage)
async function chamarGroqTranscricaoViaUrl(params: {
  apiKey: string;
  url: string;
}): Promise<GroqTranscricaoResult> {
  const { apiKey, url } = params;

  const tentativas: Array<{ model: string; language?: string; response_format?: string }> = [
    { model: 'whisper-large-v3-turbo', language: 'es', response_format: 'text' },
    { model: 'whisper-large-v3-turbo', response_format: 'text' },
    { model: 'whisper-large-v3', language: 'es', response_format: 'text' },
    { model: 'whisper-large-v3', response_format: 'text' },
  ];

  let ultimo: GroqTranscricaoResult = {
    ok: false,
    status: 502,
    texto: 'Falha ao transcrever via URL com Groq Whisper.',
  };

  for (const t of tentativas) {
    const payload = new FormData();
    payload.append('url', url);
    payload.append('model', t.model);
    if (t.language) payload.append('language', t.language);
    if (t.response_format) payload.append('response_format', t.response_format);

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: payload,
    });

    const texto = (await groqRes.text()).trim();
    ultimo = { ok: groqRes.ok, status: groqRes.status, texto };

    if (groqRes.ok) return ultimo;
    if (!/expected pattern|did not match the expected pattern/i.test(texto)) return ultimo;
  }

  return ultimo;
}

async function extrairAudioDaRequisicao(request: Request): Promise<{
  audio: Blob | null;
  fileName?: string;
  mimeType?: string;
  erro?: string;
}> {
  const contentType = request.headers.get('content-type') || '';

  // Fallback iOS: JSON com base64 ou URL de storage
  if (contentType.includes('application/json')) {
    let body: JsonAudioPayload;
    try {
      body = (await request.json()) as JsonAudioPayload;
    } catch {
      return { audio: null, erro: 'JSON inválido no upload de áudio.' };
    }

    // Abordagem via Supabase Storage (iOS) — path após upload direto com signed URL
    const rawStoragePath = body.storagePath || body.storageUrl || null;
    if (typeof rawStoragePath === 'string' && rawStoragePath.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      let raw: Uint8Array;

      if (serviceRole) {
        // Baixa via service role (path no bucket audio-temp)
        const supabaseAdmin = createClient(supabaseUrl, serviceRole);
        // storagePath pode ser 'temp/xxx.mp3' ou URL pública completa
        const path = rawStoragePath.startsWith('http')
          ? rawStoragePath.replace(`${supabaseUrl}/storage/v1/object/public/audio-temp/`, '')
          : rawStoragePath;
        const { data, error } = await supabaseAdmin.storage.from('audio-temp').download(path);
        if (error || !data) {
          return { audio: null, erro: `Erro ao baixar áudio do storage: ${error?.message ?? 'sem dados'}` };
        }
        raw = new Uint8Array(await data.arrayBuffer());
        // Limpar após download (best-effort)
        supabaseAdmin.storage.from('audio-temp').remove([path]).catch(() => undefined);
      } else {
        // Sem service role: tenta baixar via URL pública
        if (!rawStoragePath.startsWith(supabaseUrl)) {
          return { audio: null, erro: 'URL de storage inválida.' };
        }
        let downloadRes: Response;
        try { downloadRes = await fetch(rawStoragePath); } catch {
          return { audio: null, erro: 'Não foi possível baixar o áudio do storage.' };
        }
        if (!downloadRes.ok) return { audio: null, erro: `Erro ao baixar áudio (${downloadRes.status}).` };
        raw = new Uint8Array(await downloadRes.arrayBuffer());
      }

      if (raw.byteLength === 0) return { audio: null, erro: 'Arquivo de áudio vazio no storage.' };

      const detectado = detectarFormatoAudio(raw);
      const extRaw = (typeof body.ext === 'string' ? body.ext : '').toLowerCase();
      const extFinal = ['mp3', 'm4a', 'wav'].includes(extRaw) ? extRaw : detectado.ext !== 'bin' ? detectado.ext : 'mp3';
      const safeMime = detectado.ext !== 'bin' ? detectado.mime : (extFinal === 'wav' ? 'audio/wav' : extFinal === 'm4a' ? 'audio/mp4' : 'audio/mpeg');

      return {
        audio: new Blob([raw as unknown as BlobPart], { type: safeMime }),
        fileName: nomeSeguroParaUpload(`audio_upload.${extFinal}`),
        mimeType: safeMime,
      };
    }

    const b64 = body.audioBase64;
    if (!b64 || typeof b64 !== 'string') {
      return { audio: null, erro: 'audioBase64 não informado.' };
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(b64, 'base64');
    } catch {
      return { audio: null, erro: 'audioBase64 inválido.' };
    }

    if (!bytes || bytes.byteLength === 0) {
      return { audio: null, erro: 'audioBase64 vazio.' };
    }

    const extRaw = (body.ext || 'mp3').toLowerCase();
    const ext = ['mp3', 'm4a', 'wav'].includes(extRaw) ? extRaw : 'mp3';
    const safeName = nomeSeguroParaUpload(`audio_upload.${ext}`);
    const safeMime = typeof body.mime === 'string' && /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(body.mime)
      ? body.mime
      : (ext === 'wav' ? 'audio/wav' : ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg');

    const safeBytes = new Uint8Array(bytes);

    return {
      audio: new Blob([safeBytes] as any[], { type: safeMime }),
      fileName: safeName,
      mimeType: safeMime,
    };
  }

  // Caminho tradicional multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const audioField = formData.get('audio');
    if (!(audioField instanceof File)) {
      return { audio: null, erro: 'Arquivo de áudio não enviado no campo "audio".' };
    }
    return {
      audio: audioField,
      fileName: nomeSeguroParaUpload(audioField.name),
      mimeType: audioField.type || 'audio/mpeg',
    };
  }

  // Caminho iOS-safe: bytes puros no body
  const raw = await request.arrayBuffer();
  if (!raw || raw.byteLength === 0) {
    return { audio: null, erro: 'Corpo de áudio vazio.' };
  }

  const bytes = new Uint8Array(raw);
  const detectado = detectarFormatoAudio(bytes);
  const safeName = nomeSeguroParaUpload(`audio_upload.${detectado.ext}`);
  const safeMime = detectado.mime;

  return {
    audio: new Blob([raw as unknown as BlobPart], { type: safeMime }),
    fileName: safeName,
    mimeType: safeMime,
  };
}

async function refinarComSonnet(transcricao: string): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || !transcricao.trim()) return transcricao;

  const model = process.env.ANTHROPIC_SONNET_MODEL || 'claude-3-5-sonnet-latest';

  const system = 'Você é um revisor de transcrição em espanhol. Mantenha o idioma espanhol e preserve o conteúdo original.';
  const prompt = `Refine o texto abaixo com correções leves de pontuação e legibilidade, sem traduzir e sem inventar informações.\n\nTexto:\n${transcricao.slice(0, 16000)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return transcricao;

  const data = (await res.json()) as AnthropicMessageResponse;
  const textoRefinado = (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
    .trim();

  return textoRefinado || transcricao;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY não configurada no servidor.' },
        { status: 500 },
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // ── VIA STORAGE (arquivos grandes / iOS) ────────────────────────────
    // Se vier JSON com storagePath, usa URL assinada → Groq baixa direto
    if (contentType.includes('application/json')) {
      const body = (await request.clone().json()) as JsonAudioPayload;
      const rawPath = body.storagePath || body.storageUrl || null;

      if (typeof rawPath === 'string' && rawPath.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

        if (!serviceRole) {
          return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurada.' }, { status: 500 });
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRole);
        const path = rawPath.startsWith('http')
          ? rawPath.replace(`${supabaseUrl}/storage/v1/object/public/audio-temp/`, '')
          : rawPath;

        // Gerar URL assinada (válida por 1h)
        const { data: signedData, error: signedErr } = await supabaseAdmin.storage
          .from('audio-temp')
          .createSignedUrl(path, 3600);

        if (signedErr || !signedData?.signedUrl) {
          return NextResponse.json(
            { error: `Erro ao gerar URL assinada: ${signedErr?.message ?? 'sem URL'}` },
            { status: 500 },
          );
        }

        // Transcrever via URL (Groq baixa o arquivo direto do Storage)
        const resultado = await chamarGroqTranscricaoViaUrl({ apiKey, url: signedData.signedUrl });

        // Limpar arquivo do storage (best-effort, não bloqueia resposta)
        supabaseAdmin.storage.from('audio-temp').remove([path]).catch(() => undefined);

        if (!resultado.ok) {
          return NextResponse.json(
            { error: resultado.texto || 'Falha na transcrição via URL.' },
            { status: resultado.status || 502 },
          );
        }

        const transcricaoFinal = await refinarComSonnet(resultado.texto);
        return NextResponse.json({ transcricao: transcricaoFinal });
      }
    }

    // ── VIA UPLOAD DIRETO (arquivos pequenos) ───────────────────────────
    const { audio, fileName, mimeType, erro } = await extrairAudioDaRequisicao(request);
    if (!audio) {
      return NextResponse.json(
        { error: erro || 'Arquivo de áudio inválido.' },
        { status: 400 },
      );
    }

    const filename = fileName || nomeSeguroParaUpload('audio_upload.mp3');
    const baseMime = mimeType || 'audio/mpeg';
    const bytes = await audio.arrayBuffer();

    const tentativas = [
      { fileName: filename, mimeType: baseMime },
      { fileName: 'audio_upload.wav', mimeType: 'audio/wav' },
      { fileName: 'audio_upload.mp3', mimeType: 'audio/mpeg' },
      { fileName: 'audio_upload.m4a', mimeType: 'audio/mp4' },
    ];

    let ultimo: GroqTranscricaoResult | null = null;
    for (const tentativa of tentativas) {
      const resTry = await chamarGroqTranscricao({
        apiKey,
        bytes,
        fileName: tentativa.fileName,
        mimeType: tentativa.mimeType,
      });

      ultimo = resTry;
      if (resTry.ok) break;

      // Se não for o erro clássico de pattern, não adianta insistir em formato.
      if (!/expected pattern|did not match the expected pattern/i.test(resTry.texto)) {
        break;
      }
    }

    if (!ultimo || !ultimo.ok) {
      return NextResponse.json(
        { error: ultimo?.texto || 'Falha ao transcrever com Groq Whisper.' },
        { status: ultimo?.status || 502 },
      );
    }

    const transcricaoFinal = await refinarComSonnet(ultimo.texto);
    return NextResponse.json({ transcricao: transcricaoFinal });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error
          ? e.message
          : 'Erro inesperado ao processar a transcrição.',
      },
      { status: 500 },
    );
  }
}
