// API de diário — histórico (GET) e salvar + corrigir (POST) via Groq

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null } as const;
  return { user } as const;
}

async function chamarGroq(apiKey: string, system: string, userMsg: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta vazia da Groq');
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// GET — histórico de entradas do diário (últimas 10)
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const { data: entradas, error } = await supabase
    .from('diario')
    .select('id, conteudo, correcao, criado_em, palavras')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar histórico.' }, { status: 500 });
  }

  return NextResponse.json({ entradas: entradas ?? [] });
}

// ---------------------------------------------------------------------------
// POST — salvar entrada + corrigir com IA
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: { conteudo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { conteudo } = body;

  if (!conteudo || typeof conteudo !== 'string' || conteudo.trim().length < 10) {
    return NextResponse.json(
      { error: 'O texto deve ter pelo menos 10 caracteres.' },
      { status: 400 },
    );
  }

  const textoLimpo = conteudo.trim().slice(0, 10000);
  const palavras = textoLimpo.split(/\s+/).length;

  // Tenta corrigir com IA
  const apiKey = process.env.GROQ_API_KEY;
  let correcao = null;

  if (apiKey) {
    try {
      correcao = await chamarGroq(
        apiKey,
        `Você é um professor de idiomas gentil e encorajador corrigindo o diário de um aluno.
Seja SEMPRE positivo e motivador. Nunca seja crítico. Celebre o esforço de escrever.
Identifique o idioma em que o aluno escreveu e corrija nesse mesmo idioma.
Retorne APENAS JSON no formato:
{
  "mensagem": "mensagem encorajadora curta em português (1 frase)",
  "erros": [
    {
      "trecho": "trecho exato com erro",
      "correcao": "trecho corrigido",
      "explicacao": "explicação simples e gentil em português"
    }
  ],
  "elogios": "pontos positivos do texto (em português, 1-2 frases)",
  "dicaDoDia": "uma dica útil do idioma relacionada ao texto"
}
Se não houver erros, retorne erros como array vazio e elogie muito o aluno.`,
        `Texto do diário do aluno:\n"""${textoLimpo}"""`,
      );
    } catch {
      // Salva sem correção se Groq falhar
      correcao = {
        mensagem: 'Parabéns por escrever hoje! 🎉',
        erros: [],
        elogios: 'Ótimo trabalho praticando!',
        dicaDoDia: 'Continue praticando todos os dias.',
      };
    }
  } else {
    correcao = {
      mensagem: 'Entrada salva! (Correção não disponível no momento)',
      erros: [],
      elogios: '',
      dicaDoDia: '',
    };
  }

  // XP: base por escrever + bônus por extensão
  const xpBase = 10;
  const xpBonus = Math.min(20, Math.floor(palavras / 25) * 5);
  const xpGanho = xpBase + xpBonus;

  // Salva no Supabase
  const { data: entrada, error } = await supabase
    .from('diario')
    .insert({
      user_id: user.id,
      conteudo: textoLimpo,
      correcao,
      palavras,
    })
    .select('id, criado_em, palavras')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar entrada.' }, { status: 500 });
  }

  return NextResponse.json({
    id: entrada.id,
    criado_em: entrada.criado_em,
    palavras: entrada.palavras,
    correcao,
    xpGanho,
  });
}
