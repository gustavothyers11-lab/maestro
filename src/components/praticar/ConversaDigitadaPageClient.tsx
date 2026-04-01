'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getLangCode } from '@/utils/idioma';

interface Turno {
  speaker: 'A' | 'B';
  texto: string;
  traducao: string;
}

interface Dialogo {
  titulo: string;
  tema: string;
  turnos: Turno[];
}

interface Diferenca {
  esperado: string;
  escrito: string;
}

interface ResultadoValidacao {
  acertou: boolean;
  nota: number;
  feedback: string;
  diferencas: Diferenca[];
  dicas?: string;
  fraseCorreta: string;
}

interface VozesDialogo {
  A: SpeechSynthesisVoice | null;
  B: SpeechSynthesisVoice | null;
}

const DIALOGOS: Record<string, Dialogo> = {
  es: {
    titulo: 'Conversa no cafe',
    tema: 'pedido e rotina',
    turnos: [
      { speaker: 'A', texto: 'Hola, buenos dias. Que vas a pedir?', traducao: 'Oi, bom dia. O que voce vai pedir?' },
      { speaker: 'B', texto: 'Voy a pedir un cafe con leche y una tostada.', traducao: 'Vou pedir um cafe com leite e uma torrada.' },
      { speaker: 'A', texto: 'Perfecto, yo quiero un te y un bocadillo.', traducao: 'Perfeito, eu quero um cha e um sanduiche.' },
      { speaker: 'B', texto: 'La camarera llega en un minuto.', traducao: 'A atendente chega em um minuto.' },
      { speaker: 'A', texto: 'Despues vamos a la oficina juntos?', traducao: 'Depois vamos ao escritorio juntos?' },
      { speaker: 'B', texto: 'Si, pero primero tengo que enviar un mensaje.', traducao: 'Sim, mas primeiro eu preciso enviar uma mensagem.' },
      { speaker: 'A', texto: 'Sin problema, te espero aqui.', traducao: 'Sem problema, eu te espero aqui.' },
      { speaker: 'B', texto: 'Gracias, hoy tenemos una reunion importante.', traducao: 'Obrigado, hoje temos uma reuniao importante.' },
    ],
  },
  en: {
    titulo: 'Conversation at the station',
    tema: 'transport and time',
    turnos: [
      { speaker: 'A', texto: 'Hi, what time does the next train leave?', traducao: 'Oi, que horas sai o proximo trem?' },
      { speaker: 'B', texto: 'It leaves in fifteen minutes from platform three.', traducao: 'Ele sai em quinze minutos da plataforma tres.' },
      { speaker: 'A', texto: 'Great, do we have time to buy a snack?', traducao: 'Otimo, temos tempo para comprar um lanche?' },
      { speaker: 'B', texto: 'Yes, there is a small cafe near the entrance.', traducao: 'Sim, ha um pequeno cafe perto da entrada.' },
      { speaker: 'A', texto: 'Can you watch my backpack for a moment?', traducao: 'Voce pode olhar minha mochila por um momento?' },
      { speaker: 'B', texto: 'Sure, and do not forget your ticket.', traducao: 'Claro, e nao esqueca seu bilhete.' },
    ],
  },
  fr: {
    titulo: 'Conversation a la bibliotheque',
    tema: 'etudes',
    turnos: [
      { speaker: 'A', texto: 'Salut, tu etudies ici tous les jours?', traducao: 'Oi, voce estuda aqui todos os dias?' },
      { speaker: 'B', texto: 'Presque tous les jours, surtout le matin.', traducao: 'Quase todos os dias, principalmente de manha.' },
      { speaker: 'A', texto: 'Je cherche un livre de grammaire.', traducao: 'Eu procuro um livro de gramatica.' },
      { speaker: 'B', texto: 'Il est dans la section langue au deuxieme etage.', traducao: 'Ele esta na secao de idiomas no segundo andar.' },
      { speaker: 'A', texto: 'Merci, tu peux me montrer le chemin?', traducao: 'Obrigado, voce pode me mostrar o caminho?' },
      { speaker: 'B', texto: 'Bien sur, viens avec moi.', traducao: 'Claro, venha comigo.' },
    ],
  },
};

function escolherDialogo(langCode: string): Dialogo {
  const prefix = langCode.split('-')[0].toLowerCase();
  return DIALOGOS[prefix] ?? DIALOGOS.es;
}

function normalizarTexto(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + custo,
      );
    }
  }

  return dp[m][n];
}

function similaridade(fraseEsperada: string, fraseDigitada: string): number {
  const esperado = normalizarTexto(fraseEsperada);
  const digitado = normalizarTexto(fraseDigitada);

  if (!esperado || !digitado) return 0;

  const dist = levenshtein(esperado, digitado);
  const maxLen = Math.max(esperado.length, digitado.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function selecionarVozes(lang: string): VozesDialogo {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { A: null, B: null };
  }

  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.split('-')[0].toLowerCase();
  const candidatas = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const ordenadas = [...candidatas].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const n = v.name.toLowerCase();
      if (/dalia/.test(n)) return 5;
      if (/neural|natural|premium/.test(n)) return 3;
      if (/microsoft|google|apple/.test(n)) return 2;
      return 1;
    };
    return score(b) - score(a);
  });

  const vozA = ordenadas[0] ?? null;
  const vozB = ordenadas.find((v) => v.name !== vozA?.name) ?? vozA;

  return { A: vozA, B: vozB };
}

function falar(texto: string, lang: string, rate = 0.9, voice?: SpeechSynthesisVoice | null, pitch?: number): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = lang;
    utter.rate = rate;
    if (typeof pitch === 'number') utter.pitch = pitch;

    if (voice) utter.voice = voice;

    utter.onend = () => resolve();
    utter.onerror = () => resolve();

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  });
}

function extrairDiferencas(esperado: string, escrito: string): Diferenca[] {
  const esperadoPalavras = normalizarTexto(esperado).split(' ').filter(Boolean);
  const escritoPalavras = normalizarTexto(escrito).split(' ').filter(Boolean);
  const max = Math.max(esperadoPalavras.length, escritoPalavras.length);
  const difs: Diferenca[] = [];

  for (let i = 0; i < max; i += 1) {
    const e = esperadoPalavras[i] ?? '(faltou)';
    const k = escritoPalavras[i] ?? '(vazio)';
    if (e !== k) difs.push({ esperado: e, escrito: k });
    if (difs.length >= 8) break;
  }

  return difs;
}

export default function ConversaDigitadaPageClient() {
  const [langCode, setLangCode] = useState('es-ES');
  const [dialogo, setDialogo] = useState<Dialogo>(DIALOGOS.es);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [resposta, setResposta] = useState('');
  const [resultado, setResultado] = useState<ResultadoValidacao | null>(null);
  const [vozes, setVozes] = useState<VozesDialogo>({ A: null, B: null });
  const [tocandoConversa, setTocandoConversa] = useState(false);
  const [indiceFalando, setIndiceFalando] = useState<number | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [tentativas, setTentativas] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(10 * 60);

  const turnoAtual = dialogo.turnos[indiceAtual] ?? null;
  const finalizado = indiceAtual >= dialogo.turnos.length || segundosRestantes <= 0;
  const taxaAcerto = tentativas > 0 ? Math.round((acertos / tentativas) * 100) : 0;

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      createClient()
        .from('profiles')
        .select('idioma')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const code = getLangCode(data?.idioma);
          setLangCode(code);
          setDialogo(escolherDialogo(code));
          setVozes(selecionarVozes(code));
        });
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const syncVoices = () => setVozes(selecionarVozes(langCode));
    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [langCode]);

  useEffect(() => {
    if (finalizado) return undefined;

    const timer = setInterval(() => {
      setSegundosRestantes((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [finalizado]);

  const tempoLabel = useMemo(() => {
    const min = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
    const sec = String(segundosRestantes % 60).padStart(2, '0');
    return `${min}:${sec}`;
  }, [segundosRestantes]);

  const reiniciar = useCallback(() => {
    setDialogo((d) => escolherDialogo(langCode) || d);
    setIndiceAtual(0);
    setResposta('');
    setResultado(null);
    setTocandoConversa(false);
    setIndiceFalando(null);
    setAcertos(0);
    setTentativas(0);
    setSegundosRestantes(10 * 60);
  }, [langCode]);

  const ouvirConversa = useCallback(async () => {
    if (tocandoConversa || finalizado) return;
    setTocandoConversa(true);
    try {
      for (let i = 0; i < dialogo.turnos.length; i += 1) {
        const turno = dialogo.turnos[i];
        const voice = turno.speaker === 'A' ? vozes.A : vozes.B;
        const pitch = turno.speaker === 'A' ? 1.08 : 0.9;
        await falar(turno.texto, langCode, 0.9, voice, pitch);
        await new Promise((r) => setTimeout(r, 260));
      }
    } finally {
      setTocandoConversa(false);
    }
  }, [dialogo.turnos, finalizado, langCode, tocandoConversa, vozes.A, vozes.B]);

  const validar = useCallback(() => {
    if (!turnoAtual || !resposta.trim()) return;

    const score = similaridade(turnoAtual.texto, resposta);
    const nota = Math.max(0, Math.min(100, Math.round(score * 100)));
    const diferencas = extrairDiferencas(turnoAtual.texto, resposta);
    setTentativas((t) => t + 1);

    const acertou = score >= 0.82;

    if (acertou) {
      setAcertos((a) => a + 1);
      setResultado({
        acertou: true,
        nota,
        feedback: `Boa! Similaridade ${nota}%.`,
        diferencas,
        fraseCorreta: turnoAtual.texto,
        dicas: 'Mantenha o ritmo da conversa e tente repetir com a mesma entonacao.',
      });
      setIndiceAtual((i) => i + 1);
      setResposta('');
      return;
    }

    setResultado({
      acertou: false,
      nota,
      feedback: `Quase la (${nota}%). Tente novamente.`,
      diferencas,
      fraseCorreta: turnoAtual.texto,
      dicas: `Dica em portugues: ${turnoAtual.traducao}`,
    });
  }, [resposta, turnoAtual]);

  const notaCor =
    resultado && resultado.nota >= 90
      ? 'text-emerald-400'
      : resultado && resultado.nota >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  const notaBg =
    resultado && resultado.nota >= 90
      ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
      : resultado && resultado.nota >= 60
        ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
        : 'from-red-500/10 to-red-500/5 border-red-500/20';

  return (
    <div className="min-h-screen bg-[#0f0f1a] px-4 py-8 sm:px-6 lg:px-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href="/dashboard/praticar" className="text-xs font-semibold text-white/45 hover:text-white/75 transition-colors">
              ← Voltar para práticas
            </Link>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold">Conversa Digitada</h1>
            <p className="mt-2 text-sm text-white/60">
              Digite fala por fala da conversa entre duas pessoas no idioma da sua conta.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-cyan-200/80">Tempo</p>
            <p className="text-lg font-bold text-cyan-200">{tempoLabel}</p>
          </div>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#17172b]/85 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold">{dialogo.titulo}</h2>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/75">
              Tema: {dialogo.tema}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/55">Fala atual</p>
              <p className="text-sm font-bold mt-1">{Math.min(indiceAtual + 1, dialogo.turnos.length)}/{dialogo.turnos.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/55">Acertos</p>
              <p className="text-sm font-bold mt-1">{acertos}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[11px] text-white/55">Precisao</p>
              <p className="text-sm font-bold mt-1">{taxaAcerto}%</p>
            </div>
          </div>

          {!finalizado && turnoAtual && (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4">
                <p className="text-xs uppercase tracking-wider text-indigo-200/80 mb-1">
                  Falante {turnoAtual.speaker}
                </p>
                <p className="text-sm text-white/70">Ouca e digite exatamente a fala.</p>
                <p className="text-xs text-white/45 mt-2">Dica em portugues: {turnoAtual.traducao}</p>
              </div>

              {tentativas > 0 && (
                <div className="space-y-2">
                  {dialogo.turnos.slice(0, Math.max(1, indiceAtual)).map((turno, i) => {
                    const ativo = i === indiceFalando;
                    return (
                      <div
                        key={`${turno.speaker}-${i}`}
                        className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                          ativo
                            ? 'border-cyan-300/50 bg-cyan-500/15 text-cyan-100'
                            : 'border-white/10 bg-white/5 text-white/70'
                        }`}
                      >
                        <span className="font-bold mr-2">{turno.speaker}:</span>
                        {turno.texto}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={ouvirConversa}
                  disabled={tocandoConversa}
                  className="rounded-xl bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 transition disabled:opacity-60"
                >
                  {tocandoConversa ? 'Reproduzindo conversa...' : 'Ouvir conversa'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const voice = turnoAtual.speaker === 'A' ? vozes.A : vozes.B;
                    const pitch = turnoAtual.speaker === 'A' ? 1.08 : 0.9;
                    void falar(turnoAtual.texto, langCode, 0.75, voice, pitch);
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10 transition"
                >
                  Ouvir fala devagar
                </button>
              </div>

              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={3}
                placeholder="Digite aqui a frase que voce ouviu..."
                className="w-full rounded-xl border border-white/12 bg-[#0f0f1f] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={validar}
                  disabled={!resposta.trim()}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Validar fala
                </button>
                <button
                  type="button"
                  onClick={() => setResposta('')}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => setResultado(null)}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/10 transition"
                >
                  Limpar resultado
                </button>
              </div>

              {resultado && (
                <div className="space-y-4">
                  <div className={`rounded-xl border bg-gradient-to-br ${notaBg} p-5`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-4xl font-black tabular-nums ${notaCor}`}>
                          {resultado.nota}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {resultado.nota >= 90 ? 'Excelente!' : resultado.nota >= 60 ? 'Quase la!' : 'Continue tentando!'}
                          </p>
                          <p className="text-xs text-white/70 mt-0.5">{resultado.feedback}</p>
                        </div>
                      </div>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.10]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1260CC] to-[#0ABFDE]"
                        style={{ width: `${resultado.nota}%` }}
                      />
                    </div>
                  </div>

                  {resultado.diferencas.length > 0 && (
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                      <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">
                        Diferencas encontradas
                      </h3>
                      <div className="space-y-2">
                        {resultado.diferencas.map((d, i) => (
                          <div key={i} className="flex items-center gap-3 text-sm">
                            <span className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-red-300 line-through">
                              {d.escrito}
                            </span>
                            <span className="text-white/40">→</span>
                            <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-300 font-medium">
                              {d.esperado}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Frase correta</h3>
                    <p className="text-base font-medium text-white">{resultado.fraseCorreta}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const voice = turnoAtual.speaker === 'A' ? vozes.A : vozes.B;
                        const pitch = turnoAtual.speaker === 'A' ? 1.08 : 0.9;
                        void falar(resultado.fraseCorreta, langCode, 0.9, voice, pitch);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Ouvir novamente
                    </button>
                  </div>

                  {resultado.dicas && (
                    <div className="rounded-xl border border-[#1260CC]/20 bg-[#1260CC]/8 p-4">
                      <p className="text-sm text-[#8cc3ff]">{resultado.dicas}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {finalizado && (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-5 text-center">
              <h3 className="text-xl font-bold text-emerald-200">Sessao finalizada</h3>
              <p className="mt-2 text-sm text-emerald-50/90">
                Voce concluiu {indiceAtual >= dialogo.turnos.length ? 'todas as falas' : 'o tempo de 10 minutos'}.
              </p>
              <p className="mt-1 text-sm text-emerald-100/90">
                Precisao final: <strong>{taxaAcerto}%</strong> ({acertos}/{tentativas || 1} acertos)
              </p>
              <button
                type="button"
                onClick={reiniciar}
                className="mt-4 rounded-xl bg-white text-emerald-700 px-5 py-2.5 text-sm font-bold hover:bg-emerald-50 transition"
              >
                Praticar novamente
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
