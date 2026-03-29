import { NextResponse } from 'next/server';

export const maxDuration = 60;

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function nomeSeguroParaUpload(nomeOriginal: string | undefined): string {
  const base = (nomeOriginal || 'audio').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (/\.(mp3|m4a|wav|webm|ogg)$/i.test(base)) return base;
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

async function extrairAudioDaRequisicao(request: Request): Promise<{
  audio: Blob | null;
  fileName?: string;
  mimeType?: string;
  erro?: string;
}> {
  const contentType = request.headers.get('content-type') || '';

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
    audio: new Blob([raw], { type: safeMime }),
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
    const { audio, fileName, mimeType, erro } = await extrairAudioDaRequisicao(request);
    if (!audio) {
      return NextResponse.json(
        { error: erro || 'Arquivo de áudio inválido.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY não configurada no servidor.' },
        { status: 500 },
      );
    }

    const payload = new FormData();
    const filename = fileName || nomeSeguroParaUpload('audio_upload.mp3');
    const audioBlob = mimeType ? new Blob([audio], { type: mimeType }) : audio;
    payload.append('file', audioBlob, filename);
    payload.append('model', 'whisper-large-v3-turbo');
    payload.append('language', 'es');
    payload.append('response_format', 'text');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const texto = (await groqRes.text()).trim();

    if (!groqRes.ok) {
      return NextResponse.json(
        { error: texto || 'Falha ao transcrever com Groq Whisper.' },
        { status: groqRes.status },
      );
    }

    const transcricaoFinal = await refinarComSonnet(texto);
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
