// API de ditado — retorna frase aleatória (GET) e avalia resposta do usuário (POST)

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

// ---------------------------------------------------------------------------
// GET — frase aleatória dos cards do usuário
// ---------------------------------------------------------------------------

export async function GET() {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // Busca todos os cards do usuário que tenham texto na frente
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, frente, verso')
    .eq('user_id', user.id)
    .not('frente', 'is', null);

  if (error) {
    return NextResponse.json(
      { error: 'Erro ao buscar cards.' },
      { status: 500 },
    );
  }

  if (!cards || cards.length === 0) {
    return NextResponse.json(
      { error: 'Nenhum card encontrado. Crie cards primeiro para praticar ditado.' },
      { status: 404 },
    );
  }

  // Escolhe um card aleatório
  const card = cards[Math.floor(Math.random() * cards.length)];

  return NextResponse.json({
    id: card.id,
    frase: card.frente,
    traducao: card.verso,
  });
}

// ---------------------------------------------------------------------------
// POST — avalia a resposta do usuário com Groq
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const supabase = await createClient();
  const { user } = await getAuthUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Chave da API Groq não configurada.' },
      { status: 500 },
    );
  }

  let body: { fraseOriginal?: string; fraseUsuario?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido.' },
      { status: 400 },
    );
  }

  const { fraseOriginal, fraseUsuario } = body;

  if (!fraseOriginal || !fraseUsuario) {
    return NextResponse.json(
      { error: 'Campos "fraseOriginal" e "fraseUsuario" são obrigatórios.' },
      { status: 400 },
    );
  }

  // Normaliza para comparação simples
  const normalizar = (s: string) =>
    s.trim().toLowerCase().replace(/[¡¿.,!?;:"""'']/g, '').replace(/\s+/g, ' ');

  const original = normalizar(fraseOriginal);
  const usuario = normalizar(fraseUsuario);

  // Match exato — retorna direto sem gastar tokens da IA
  if (original === usuario) {
    return NextResponse.json({
      acertou: true,
      nota: 100,
      feedback: '¡Perfecto! Você acertou tudo! 🎉',
      diferencas: [],
      fraseCorreta: fraseOriginal,
    });
  }

  // Usa Groq para análise detalhada
  const systemPrompt = `Você é um professor de idiomas avaliando um exercício de ditado.
Compare a frase original com o que o aluno escreveu.
Retorne APENAS JSON válido no formato:
{
  "nota": 0-100,
  "feedback": "feedback breve e encorajador em português",
  "diferencas": [{"esperado": "palavra correta", "escrito": "o que o aluno escreveu"}],
  "dicas": "dica opcional sobre a frase"
}`;

  const userPrompt = `Frase original: "${fraseOriginal}"
Resposta do aluno: "${fraseUsuario}"

Avalie a resposta. Considere acentos e ortografia.`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!groqRes.ok) {
      throw new Error(`Groq ${groqRes.status}`);
    }

    const groqJson = await groqRes.json();
    const content = groqJson.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da Groq');
    }

    const resultado = JSON.parse(content);

    return NextResponse.json({
      acertou: resultado.nota >= 90,
      nota: resultado.nota,
      feedback: resultado.feedback,
      diferencas: resultado.diferencas ?? [],
      dicas: resultado.dicas ?? null,
      fraseCorreta: fraseOriginal,
    });
  } catch {
    // Fallback: comparação simples sem IA
    const palavrasOriginal = original.split(' ');
    const palavrasUsuario = usuario.split(' ');
    const diferencas: { esperado: string; escrito: string }[] = [];

    palavrasOriginal.forEach((p, i) => {
      if (palavrasUsuario[i] !== p) {
        diferencas.push({ esperado: p, escrito: palavrasUsuario[i] ?? '(faltou)' });
      }
    });

    const acertadas = palavrasOriginal.length - diferencas.length;
    const nota = Math.max(0, Math.round((acertadas / palavrasOriginal.length) * 100));

    return NextResponse.json({
      acertou: nota >= 90,
      nota,
      feedback: nota >= 90
        ? '¡Muy bien! Quase perfeito!'
        : nota >= 60
          ? 'Bom trabalho, mas tem alguns erros. Tente novamente!'
          : 'Continue praticando, você vai melhorar!',
      diferencas,
      fraseCorreta: fraseOriginal,
    });
  }
}
