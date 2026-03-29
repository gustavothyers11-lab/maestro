import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseAulaMetadata, rowToAula, serializeAulaMetadata } from '@/lib/aulas';
import type { ItemPronuncia } from '@/types';

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function limparJsonCru(texto: string): string {
  return texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { id } = await context.params;
  const { data, error } = await supabase.from('aulas').select('*').eq('id', id).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Aula não encontrada.' }, { status: 404 });
  }

  const metadata = parseAulaMetadata(data.anotacoes);
  const transcricao = metadata.transcricao?.trim() ?? '';

  if (!transcricao) {
    return NextResponse.json({ error: 'A aula não possui transcrição para gerar pronúncia.' }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 });
  }

  const model = process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-4-20250514';
  const system = 'Você é um professor de espanhol. Extraia vocabulário importante de uma aula e explique a pronúncia de forma curta, precisa e útil para brasileiros.';
  const prompt = `A partir da transcrição abaixo, identifique até 12 palavras ou expressões-chave para praticar pronúncia.

Retorne APENAS um JSON válido no formato:
{
  "itens": [
    {
      "palavra": "texto em espanhol",
      "pronuncia": "guia fonético simples para brasileiros",
      "significado": "significado em português",
      "exemplo": "frase curta em espanhol"
    }
  ]
}

Transcrição:
${transcricao.slice(0, 15000)}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'sem detalhes');
    return NextResponse.json({ error: `Erro da Anthropic (${res.status}): ${detail}` }, { status: 502 });
  }

  const json = (await res.json()) as AnthropicMessageResponse;
  const raw = (json.content ?? [])
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
    .trim();

  let itens: ItemPronuncia[] = [];
  try {
    const parsed = JSON.parse(limparJsonCru(raw)) as { itens?: ItemPronuncia[] };
    itens = Array.isArray(parsed.itens) ? parsed.itens : [];
  } catch {
    return NextResponse.json({ error: 'A Anthropic retornou um formato inválido para pronúncia.' }, { status: 502 });
  }

  const pronuncia = {
    itens: itens.filter((item) => {
      return typeof item.palavra === 'string'
        && typeof item.pronuncia === 'string'
        && typeof item.significado === 'string'
        && typeof item.exemplo === 'string';
    }).slice(0, 12),
    geradoEm: new Date().toISOString(),
  };

  const updatedMetadata = serializeAulaMetadata({
    ...metadata,
    pronuncia,
  });

  await supabase.from('aulas').update({ anotacoes: updatedMetadata }).eq('id', id);

  return NextResponse.json({
    pronuncia,
    aula: rowToAula({ ...data, anotacoes: updatedMetadata } as Record<string, unknown>),
  });
}