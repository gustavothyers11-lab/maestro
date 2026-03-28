// API de geração de cards — gera flashcards automaticamente a partir de transcrições via Groq (LLaMA 3.3 70B)

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

interface GroqResponse {
  cards: CardGerado[];
  resumo: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API Groq não configurada no servidor.' },
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

  // ── Prompt ──────────────────────────────────────────────────────────
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

  // ── Chamada ao Groq ─────────────────────────────────────────────────
  let groqRes: Response;
  try {
    groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao conectar com a API Groq. Tente novamente mais tarde.' },
      { status: 502 },
    );
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text().catch(() => 'sem detalhes');
    return NextResponse.json(
      { error: `Erro da API Groq (${groqRes.status}): ${detail}` },
      { status: groqRes.status >= 500 ? 502 : groqRes.status },
    );
  }

  // ── Parse da resposta ───────────────────────────────────────────────
  let groqJson: { choices?: { message?: { content?: string } }[] };
  try {
    groqJson = await groqRes.json();
  } catch {
    return NextResponse.json(
      { error: 'Resposta da API Groq não é JSON válido.' },
      { status: 502 },
    );
  }

  const raw = groqJson.choices?.[0]?.message?.content ?? '';

  let parsed: GroqResponse;
  try {
    // O modelo às vezes envolve o JSON em ```json ... ```, removemos isso
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível interpretar a resposta da IA como JSON.' },
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
