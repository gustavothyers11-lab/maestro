// API de geração de cards — Sonnet como único provedor

import { NextResponse } from 'next/server';
import type { Genero } from '@/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface RequestBody {
  transcricao: string;
  quantidade?: number;
  temas?: string[];
}

interface CardGerado {
  frente: string;
  verso: string;
  exemplo: string;
  genero: Genero;
  tema: string;
}

interface CardGenerationResponse {
  cards: CardGerado[];
  resumo: string;
}

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function limparJsonCru(texto: string): string {
  return texto
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function construirPrompts(transcricao: string, quantidade: number, temas?: string[]) {
  const temasInstrucao = temas?.length
    ? `\nFoque nos seguintes temas: ${temas.join(', ')}.`
    : '';

  const systemPrompt = `Você é um especialista em ensino de espanhol. \
Analise a transcrição de aula fornecida e gere flashcards de alta qualidade para estudo.
Retorne APENAS um JSON válido no formato:
{
  "cards": [{
    "frente": "palavra/frase em espanhol",
    "verso": "tradução em português",
    "exemplo": "frase de exemplo em espanhol",
    "genero": "masculino" | "feminino" | "neutro",
    "tema": "tema do card"
  }],
  "resumo": "resumo da aula em 2-3 frases"
}`;

  const userPrompt = `Gere exatamente ${quantidade} flashcards a partir desta transcrição de aula:${temasInstrucao}

---TRANSCRIÇÃO---
${transcricao.trim().slice(0, 12_000)}
---FIM---`;

  return { systemPrompt, userPrompt };
}

async function gerarComSonnet(params: {
  apiKey: string;
  transcricao: string;
  quantidade: number;
  temas?: string[];
}): Promise<CardGenerationResponse> {
  const { apiKey, transcricao, quantidade, temas } = params;
  const { systemPrompt, userPrompt } = construirPrompts(transcricao, quantidade, temas);

  const model = process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'sem detalhes');
    throw new Error(`Erro da API Anthropic (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as AnthropicMessageResponse;
  const raw = (json.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
    .trim();

  return JSON.parse(limparJsonCru(raw)) as CardGenerationResponse;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!anthropicKey) {
    return NextResponse.json(
      { error: 'Configure ANTHROPIC_API_KEY no servidor e reinicie o app após editar .env.local.' },
      { status: 500 },
    );
  }

  // ── Parse & validação ───────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido. Envie JSON válido.' },
      { status: 400 },
    );
  }

  const { transcricao, temas } = body;

  if (!transcricao || typeof transcricao !== 'string' || transcricao.trim().length === 0) {
    return NextResponse.json(
      { error: 'O campo "transcricao" é obrigatório e não pode estar vazio.' },
      { status: 400 },
    );
  }

  const quantidade = Math.min(20, Math.max(1, Number(body.quantidade) || 10));

  if (temas !== undefined && !Array.isArray(temas)) {
    return NextResponse.json(
      { error: 'O campo "temas" deve ser um array de strings.' },
      { status: 400 },
    );
  }

  let parsed: CardGenerationResponse;
  try {
    parsed = await gerarComSonnet({ apiKey: anthropicKey, transcricao, quantidade, temas });
  } catch (erroPrimario) {
    return NextResponse.json(
      { error: erroPrimario instanceof Error ? erroPrimario.message : 'Falha na geração com IA.' },
      { status: 502 },
    );
  }

  if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    return NextResponse.json(
      { error: 'A IA não retornou cards válidos. Tente novamente.' },
      { status: 502 },
    );
  }

  // ── Sanitização dos cards ───────────────────────────────────────────
  const generosValidos: Genero[] = ['masculino', 'feminino', 'neutro'];

  const cards: CardGerado[] = parsed.cards
    .filter(
      (c): c is CardGerado =>
        typeof c.frente === 'string' &&
        typeof c.verso === 'string' &&
        typeof c.exemplo === 'string',
    )
    .map((c) => ({
      frente: c.frente.trim(),
      verso: c.verso.trim(),
      exemplo: c.exemplo.trim(),
      genero: generosValidos.includes(c.genero) ? c.genero : 'neutro',
      tema: typeof c.tema === 'string' ? c.tema.trim() : 'Geral',
    }))
    .slice(0, quantidade);

  return NextResponse.json({
    cards,
    resumo: typeof parsed.resumo === 'string' ? parsed.resumo.trim() : '',
    total: cards.length,
  });
}
