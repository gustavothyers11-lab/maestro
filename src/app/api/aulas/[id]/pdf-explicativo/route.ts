import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseAulaMetadata } from '@/lib/aulas';

export const maxDuration = 120;

interface AnthropicMessageResponse {
  content?: Array<{ type?: string; text?: string }>;
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
  const titulo = data.titulo || 'Aula';

  if (!transcricao) {
    return NextResponse.json({ error: 'A aula não possui transcrição para gerar o PDF.' }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 });
  }

  const model = process.env.ANTHROPIC_SONNET_MODEL || 'claude-sonnet-4-20250514';

  const system = `Você é um professor de idiomas criando material didático em PORTUGUÊS para estudantes brasileiros.
Crie um material explicativo robusto, organizado e didático, mas objetivo.
Identifique o idioma da transcrição e use-o nos exemplos.
Priorize clareza e revisão rápida: frases curtas, listas e exemplos práticos.`;

  const prompt = `Baseado na transcrição abaixo, crie um material explicativo completo em PORTUGUÊS (com os termos no idioma de estudo quando necessário).

Estruture o conteúdo com as seguintes seções (use apenas as que fizerem sentido para o conteúdo):

1. **Resumo da aula** — Síntese do que foi ensinado
2. **Conceitos principais** — Explicação dos tópicos gramaticais, vocabulário ou conceitos abordados
3. **Vocabulário-chave** — Lista de palavras/expressões importantes (idioma de estudo → português)
4. **Exemplos práticos** — Frases de exemplo com tradução
5. **Regras e dicas** — Regras gramaticais ou dicas de uso
6. **Exercícios sugeridos** — 3 a 5 exercícios para praticar (com gabarito)

REGRAS DE QUALIDADE E TAMANHO (importante):
- Escreva de forma clara e pedagógica, sem enrolação.
- Cada seção deve ter de 4 a 8 linhas curtas.
- Use marcadores simples quando possível (uma ideia por linha).
- Em "Exemplos práticos", sempre inclua frase no idioma de estudo + tradução.
- Em "Regras e dicas", inclua alertas de erro comum começando por "Dica:".
- Evite repetir a mesma explicação em seções diferentes.

Retorne APENAS um JSON válido no formato:
{
  "titulo": "Título descritivo do material",
  "secoes": [
    {
      "titulo": "Nome da seção",
      "conteudo": "Texto da seção com \\n para quebras de linha"
    }
  ]
}

Transcrição da aula "${titulo}":
${transcricao.slice(0, 12000)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 3600,
        temperature: 0.3,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Erro na API Claude: ${res.status} — ${errText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as AnthropicMessageResponse;
    const textoRaw = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();

    // Limpar markdown code fences se houver
    const textoLimpo = textoRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    let resultado: { titulo: string; secoes: Array<{ titulo: string; conteudo: string }> };
    try {
      resultado = JSON.parse(textoLimpo);
    } catch {
      return NextResponse.json({ error: 'Resposta da IA não é JSON válido.' }, { status: 502 });
    }

    if (!resultado.secoes || !Array.isArray(resultado.secoes)) {
      return NextResponse.json({ error: 'Formato de resposta inválido.' }, { status: 502 });
    }

    return NextResponse.json({ conteudo: resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao gerar conteúdo do PDF.' },
      { status: 500 },
    );
  }
}
