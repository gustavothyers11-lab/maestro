// API de geração de cards — Sonnet como único provedor

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

/** Remove espaços/quebras duplicadas para economizar tokens de entrada */
function limparTexto(texto: string): string {
  return texto
    .trim()
    .replace(/[ \t]+/g, ' ')
    .replace(/(\r?\n){3,}/g, '\n\n')
    .slice(0, 6_000);
}

function construirPrompts(transcricao: string, quantidade: number, temas?: string[], palavrasExistentes?: string[]) {
  const temasInstrucao = temas?.length
    ? `\nTemas prioritários: ${temas.join(', ')}.`
    : '';

  const listaExistentes = palavrasExistentes?.length
    ? `\n\nPALAVRAS JÁ EXISTENTES (NÃO repita nenhuma destas):\n${palavrasExistentes.join(', ')}`
    : '';

  const systemPrompt = `Você é um especialista em ensino de idiomas. Identifique o idioma da transcrição e gere flashcards de alta qualidade pedagógica.

REGRAS OBRIGATÓRIAS:
1. Extraia apenas vocabulário RELEVANTE e ÚTIL da transcrição — palavras e expressões que um estudante realmente precisa aprender.
2. NÃO gere palavras genéricas, artigos soltos, preposições isoladas ou frases sem sentido.
3. Priorize: substantivos, verbos, adjetivos, expressões idiomáticas e frases úteis do dia-a-dia.
4. Cada card deve ter uma tradução precisa e o campo "exemplo" DEVE ser uma FRASE REAL retirada da transcrição ou baseada diretamente nela (ex: "Ellos escriben en la pizarra con un rotulador"). NÃO invente frases genéricas.
5. Se a transcrição não tiver vocabulário suficiente de qualidade, gere MENOS cards (mas bons) ao invés de preencher com lixo.
6. NUNCA repita palavras/frases que já existem nos cards do aluno (lista fornecida abaixo).${listaExistentes}

Retorne APENAS o JSON, sem explicação.
Formato:
{"cards":[{"frente":"palavra/expressão no idioma","verso":"tradução em português","exemplo":"frase de exemplo contextualizada","genero":"masculino|feminino|neutro","tema":"tema"}],"resumo":"resumo em 1-2 frases do conteúdo"}`;

  const userPrompt = `Gere até ${quantidade} flashcards de qualidade:${temasInstrucao}\n---\n${limparTexto(transcricao)}\n---`;

  return { systemPrompt, userPrompt };
}

async function gerarComSonnet(params: {
  apiKey: string;
  transcricao: string;
  quantidade: number;
  temas?: string[];
  palavrasExistentes?: string[];
}): Promise<CardGenerationResponse> {
  const { apiKey, transcricao, quantidade, temas, palavrasExistentes } = params;
  const { systemPrompt, userPrompt } = construirPrompts(transcricao, quantidade, temas, palavrasExistentes);

  const model = process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-4-20250514';

  // Ajuste de tokens: ~65 tokens/card + margem para JSON wrapper e resumo
  const maxTokens = Math.min(2500, quantidade * 160 + 300);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
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

  const quantidade = Math.min(12, Math.max(1, Number(body.quantidade) || 5));

  if (temas !== undefined && !Array.isArray(temas)) {
    return NextResponse.json(
      { error: 'O campo "temas" deve ser um array de strings.' },
      { status: 400 },
    );
  }

  // ── Buscar palavras existentes do usuário para evitar duplicatas ───
  let palavrasExistentes: string[] = [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: cardsExistentes } = await supabase
        .from('cards')
        .select('frente')
        .eq('user_id', user.id);

      if (cardsExistentes && cardsExistentes.length > 0) {
        palavrasExistentes = [...new Set(
          cardsExistentes.map((c: { frente: string }) => c.frente.trim().toLowerCase())
        )].slice(0, 500); // limitar para não estourar tokens
      }
    }
  } catch {
    // Se falhar ao buscar existentes, continua sem dedup
  }

  let parsed: CardGenerationResponse;
  try {
    parsed = await gerarComSonnet({ apiKey: anthropicKey, transcricao, quantidade, temas, palavrasExistentes });
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
  const existentesSet = new Set(palavrasExistentes.map((p) => p.toLowerCase()));

  const cards: CardGerado[] = parsed.cards
    .filter(
      (c): c is CardGerado =>
        typeof c.frente === 'string' &&
        typeof c.verso === 'string' &&
        typeof c.exemplo === 'string' &&
        c.frente.trim().length > 0 &&
        c.verso.trim().length > 0,
    )
    // Filtro server-side: remover duplicatas que a IA ignorou
    .filter((c) => !existentesSet.has(c.frente.trim().toLowerCase()))
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
