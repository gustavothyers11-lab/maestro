import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo de áudio não enviado no campo "audio".' },
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
    payload.append('file', audio, audio.name || 'audio.mp3');
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

    return NextResponse.json({ transcricao: texto });
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
