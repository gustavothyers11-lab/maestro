// Página de ditado — exercício de escuta e transcrição de frases em espanhol

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getLangCode } from '@/utils/idioma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Frase {
  id: string;
  frase: string;
  traducao: string;
}

interface Diferenca {
  esperado: string;
  escrito: string;
}

interface Resultado {
  acertou: boolean;
  nota: number;
  feedback: string;
  diferencas: Diferenca[];
  dicas?: string | null;
  fraseCorreta: string;
}

// ---------------------------------------------------------------------------
// TTS helper
// ---------------------------------------------------------------------------

function falar(texto: string, lang: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = lang;
  u.rate = rate;
  window.speechSynthesis.speak(u);
}

// ---------------------------------------------------------------------------
// Animated XP counter
// ---------------------------------------------------------------------------

function useContagem(alvo: number, duracao = 800) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    if (alvo === 0) { setValor(0); return; }
    let cancelado = false;
    const inicio = performance.now();
    function frame(agora: number) {
      if (cancelado) return;
      const p = Math.min((agora - inicio) / duracao, 1);
      setValor(Math.round((1 - (1 - p) * (1 - p)) * alvo));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { cancelado = true; };
  }, [alvo, duracao]);

  return valor;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DitadoPage() {
  // State
  const [frase, setFrase] = useState<Frase | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [texto, setTexto] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [fraseOuvida, setFraseOuvida] = useState(false);
  const [langCode, setLangCode] = useState('es-ES');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carregar idioma do perfil
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      createClient().from('profiles').select('idioma').eq('id', user.id).single()
        .then(({ data }) => { if (data?.idioma) setLangCode(getLangCode(data.idioma)); });
    });
  }, []);

  // ── Buscar frase ────────────────────────────────────────────────────
  const buscarFrase = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setResultado(null);
    setTexto('');
    setFraseOuvida(false);

    try {
      const res = await fetch('/api/ditado');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao buscar frase');
      setFrase(data as Frase);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Busca inicial
  useEffect(() => { buscarFrase(); }, [buscarFrase]);

  // ── Ouvir frase ─────────────────────────────────────────────────────
  const ouvirFrase = useCallback((devagar = false) => {
    if (!frase) return;
    setFalando(true);
    setFraseOuvida(true);
    const u = new SpeechSynthesisUtterance(frase.frase);
    u.lang = langCode;
    u.rate = devagar ? 0.7 : 0.85;
    u.onend = () => setFalando(false);
    u.onerror = () => setFalando(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);

    // Focus textarea after short delay
    setTimeout(() => textareaRef.current?.focus(), 400);
  }, [frase]);

  // ── Verificar ───────────────────────────────────────────────────────
  const verificar = useCallback(async () => {
    if (!frase || !texto.trim()) return;
    setVerificando(true);

    try {
      const res = await fetch('/api/ditado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fraseOriginal: frase.frase,
          fraseUsuario: texto.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao verificar');
      setResultado(data as Resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setVerificando(false);
    }
  }, [frase, texto]);

  // Keyboard shortcut: Ctrl+Enter to verify
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        verificar();
      }
    },
    [verificar],
  );

  // Nota colors
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

  // XP animation
  const xpGanho = resultado ? Math.round(resultado.nota / 10) * 2 : 0;
  const xpAnimado = useContagem(resultado ? xpGanho : 0);

  // ====================================================================

  return (
    <div className="ditado-page relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      {/* Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute top-16 left-1/3 h-80 w-80 rounded-full bg-[#1260CC]/8 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-16 right-1/4 h-64 w-64 rounded-full bg-[#0ABFDE]/8 blur-[100px]" />

      {/* Header */}
      <header className="ditado-stagger mb-8" style={{ '--ditado-delay': '0ms' } as React.CSSProperties}>
        <Link
          href="/dashboard/praticar"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            🎧 Ditado
          </span>
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-white/40">
          Ouça a frase e escreva o que entendeu.
        </p>
      </header>

      {/* Erro global */}
      {erro && !frase && (
        <div className="ditado-stagger max-w-xl" style={{ '--ditado-delay': '100ms' } as React.CSSProperties}>
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-red-300 text-sm">{erro}</p>
            <button
              onClick={buscarFrase}
              className="mt-4 rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Card principal */}
      {frase && (
        <div className="ditado-stagger max-w-xl" style={{ '--ditado-delay': '100ms' } as React.CSSProperties}>
          <div className="ditado-card relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl">

            {/* Shimmer decorativo no topo */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1260CC]/30 to-transparent" />

            {/* Botões de áudio */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                type="button"
                onClick={() => ouvirFrase(false)}
                disabled={falando || carregando}
                className={`
                  ditado-btn-audio group relative flex-1 flex items-center justify-center gap-2.5
                  rounded-xl py-3.5 px-5 text-sm font-bold text-white
                  transition-all duration-200
                  ${falando
                    ? 'bg-amber-500 shadow-lg shadow-amber-500/30 scale-[1.02]'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.97]'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {/* Sound wave animation */}
                {falando ? (
                  <span className="ditado-wave flex items-center gap-0.5">
                    <span className="ditado-wave-bar h-4 w-0.5 rounded-full bg-white" style={{ '--wave-i': 0 } as React.CSSProperties} />
                    <span className="ditado-wave-bar h-4 w-0.5 rounded-full bg-white" style={{ '--wave-i': 1 } as React.CSSProperties} />
                    <span className="ditado-wave-bar h-4 w-0.5 rounded-full bg-white" style={{ '--wave-i': 2 } as React.CSSProperties} />
                    <span className="ditado-wave-bar h-4 w-0.5 rounded-full bg-white" style={{ '--wave-i': 3 } as React.CSSProperties} />
                    <span className="ditado-wave-bar h-4 w-0.5 rounded-full bg-white" style={{ '--wave-i': 4 } as React.CSSProperties} />
                  </span>
                ) : (
                  <span className="text-lg">🔊</span>
                )}
                {falando ? 'Reproduzindo...' : 'Ouvir frase'}
              </button>

              <button
                type="button"
                onClick={() => ouvirFrase(true)}
                disabled={falando || carregando}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] py-3.5 px-5 text-sm font-semibold text-gray-600 dark:text-white/50 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-800 dark:hover:text-white/70 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🐢 Mais devagar
              </button>
            </div>

            {/* Textarea */}
            <div className="relative mb-5">
              <textarea
                ref={textareaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={fraseOuvida ? 'Escreva o que você ouviu...' : 'Clique em "Ouvir frase" primeiro'}
                disabled={verificando || !!resultado}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] p-4 text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none transition-all duration-200 focus:border-[#1260CC]/50 focus:ring-2 focus:ring-[#1260CC]/20 disabled:opacity-50"
              />
              {texto.trim() && !resultado && (
                <span className="absolute bottom-3 right-3 text-[10px] text-gray-400 dark:text-white/20">
                  Ctrl+Enter para verificar
                </span>
              )}
            </div>

            {/* Botão verificar */}
            {!resultado && (
              <button
                type="button"
                onClick={verificar}
                disabled={!texto.trim() || verificando || !fraseOuvida}
                className="ditado-btn-verificar w-full rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {verificando ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="ditado-spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                    Verificando...
                  </span>
                ) : (
                  'Verificar ✓'
                )}
              </button>
            )}

            {/* ── Resultado ──────────────────────────────────────────── */}
            {resultado && (
              <div className="ditado-resultado space-y-4">
                {/* Nota + XP */}
                <div className={`rounded-xl border bg-gradient-to-br ${notaBg} p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-4xl font-black tabular-nums ${notaCor}`}>
                        {resultado.nota}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                          {resultado.nota >= 90 ? '🎉 Excelente!' : resultado.nota >= 60 ? '💪 Quase lá!' : '📚 Continue tentando!'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                          {resultado.feedback}
                        </p>
                      </div>
                    </div>
                    {xpGanho > 0 && (
                      <div className="ditado-xp-badge flex flex-col items-center">
                        <span className="text-lg font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent tabular-nums">
                          +{xpAnimado}
                        </span>
                        <span className="text-[9px] font-bold text-amber-400/50 uppercase tracking-widest">XP</span>
                      </div>
                    )}
                  </div>

                  {/* Barra de nota */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="ditado-nota-bar absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1260CC] to-[#0ABFDE]"
                      style={{ '--ditado-nota': `${resultado.nota}%` } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Diferenças */}
                {resultado.diferencas.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] p-4">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-3">
                      Diferenças encontradas
                    </h3>
                    <div className="space-y-2">
                      {resultado.diferencas.map((d, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-red-400 line-through">
                            {d.escrito}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 dark:text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-400 font-medium">
                            {d.esperado}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frase correta */}
                <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] p-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-2">
                    Frase correta
                  </h3>
                  <p className="text-base font-medium text-gray-800 dark:text-white">
                    {resultado.fraseCorreta}
                  </p>
                  {frase?.traducao && (
                    <p className="text-sm text-gray-500 dark:text-white/35 mt-1 italic">
                      {frase.traducao}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => falar(resultado.fraseCorreta, langCode)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    🔊 Ouvir novamente
                  </button>
                </div>

                {/* Dicas */}
                {resultado.dicas && (
                  <div className="rounded-xl border border-[#1260CC]/20 bg-[#1260CC]/5 p-4">
                    <p className="text-sm text-[#378ADD]">
                      💡 {resultado.dicas}
                    </p>
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={buscarFrase}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.01] active:scale-[0.98]"
                  >
                    Próxima frase →
                  </button>
                  <Link
                    href="/dashboard/praticar"
                    className="flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-gray-600 dark:text-white/50 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/[0.08]"
                  >
                    Sair
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {carregando && (
        <div className="ditado-stagger max-w-xl" style={{ '--ditado-delay': '100ms' } as React.CSSProperties}>
          <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/80 p-8 text-center">
            <div className="ditado-spinner mx-auto h-8 w-8 rounded-full border-2 border-gray-300 dark:border-white/10 border-t-[#1260CC]" />
            <p className="mt-4 text-sm text-gray-500 dark:text-white/40">Buscando frase...</p>
          </div>
        </div>
      )}
    </div>
  );
}
