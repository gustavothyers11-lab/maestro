// API de redação — gera temas (GET) e corrige textos (POST) via Groq

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

function getApiKey() {
  const k = process.env.GROQ_API_KEY;
  if (!k) return null;
  return k;
}

async function chamarGroq(apiKey: string, system: string, user: string) {
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
        { role: 'user', content: user },
      ],
      temperature: 0.5,
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
// GET — gera tema de redação baseado nos cards do usuário
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API Groq não configurada.' },
      { status: 500 },
    );
  }

  // Busca cards recentes para contextualizar o tema
  const { data: cards } = await supabase
    .from('cards')
    .select('frente, verso')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false })
    .limit(30);

  const vocabulario = (cards ?? [])
    .map((c) => `${c.frente} — ${c.verso}`)
    .join('\n');

  const temFallback = !vocabulario.trim();

  if (temFallback) {
    // Sem cards — temas genéricos
    const temas = [
      { tema: 'Describe tu casa ideal en detalle', dica: 'Use adjetivos e vocabulário de móveis e cômodos.' },
      { tema: '¿Cuál fue el mejor viaje que hiciste?', dica: 'Pratique o pretérito e expressões de tempo.' },
      { tema: 'Escribe sobre tu rutina diaria', dica: 'Use verbos reflexivos e conectores temporais.' },
      { tema: '¿Qué harías si pudieras viajar al pasado?', dica: 'Pratique o condicional e o subjuntivo.' },
      { tema: 'Describe a tu mejor amigo/a', dica: 'Use adjetivos de personalidade e aparência.' },
    ];
    const escolhido = temas[Math.floor(Math.random() * temas.length)];
    return NextResponse.json(escolhido);
  }

  try {
    const resultado = await chamarGroq(
      apiKey,
      `Você é um professor de espanhol criativo. Gere UM tema de redação interessante baseado no vocabulário do aluno.
Retorne APENAS JSON: { "tema": "enunciado do tema em espanhol (frase imperativa ou pergunta)", "dica": "dica curta em português para ajudar o aluno" }`,
      `Aqui está o vocabulário recente do aluno:\n${vocabulario}\n\nGere um tema de redação criativo que use esse vocabulário.`,
    );

    return NextResponse.json({
      tema: resultado.tema ?? 'Escribe sobre tu día ideal',
      dica: resultado.dica ?? 'Use o vocabulário que você aprendeu recentemente.',
    });
  } catch {
    return NextResponse.json({
      tema: 'Describe cómo sería tu día perfecto',
      dica: 'Use vocabulário de rotina, comida e lugares.',
    });
  }
}

// ---------------------------------------------------------------------------
// POST — corrige redação do usuário
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API Groq não configurada.' },
      { status: 500 },
    );
  }

  let body: { tema?: string; texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { tema, texto } = body;

  if (!texto || typeof texto !== 'string' || texto.trim().length < 10) {
    return NextResponse.json(
      { error: 'O texto deve ter pelo menos 10 caracteres.' },
      { status: 400 },
    );
  }

  try {
    const resultado = await chamarGroq(
      apiKey,
      `Você é um professor de espanhol corrigindo a redação de um aluno de nível intermediário/avançado.
Avalie o texto quanto a: gramática, ortografia, vocabulário, coerência e fluência.
Retorne APENAS JSON no formato:
{
  "nota": 0.0 a 10.0,
  "resumo": "avaliação geral breve em português (1-2 frases)",
  "erros": [
    {
      "trecho": "trecho exato com erro no texto do aluno",
      "correcao": "trecho corrigido em espanhol",
      "explicacao": "explicação do erro em português"
    }
  ],
  "pontosBons": "o que o aluno fez bem (em português, 1-2 frases)",
  "sugestaoMelhoria": "sugestão concreta para melhorar (em português)"
}`,
      `Tema da redação: "${tema ?? 'livre'}"

Texto do aluno:
"""
${texto.trim().slice(0, 5000)}
"""

Corrija a redação acima.`,
    );

    const nota = Math.min(10, Math.max(0, Number(resultado.nota) || 0));
    const xpGanho = Math.round(nota * 3);

    return NextResponse.json({
      nota,
      resumo: resultado.resumo ?? 'Redação avaliada.',
      erros: Array.isArray(resultado.erros) ? resultado.erros : [],
      pontosBons: resultado.pontosBons ?? '',
      sugestaoMelhoria: resultado.sugestaoMelhoria ?? '',
      xpGanho,
    });
  } catch {
    return NextResponse.json(
      { error: 'Erro ao corrigir a redação. Tente novamente.' },
      { status: 502 },
    );
  }
}
