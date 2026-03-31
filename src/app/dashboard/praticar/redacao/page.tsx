// Página de redação — escrita em espanhol com correção por IA

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Tema {
  tema: string;
  dica: string;
}

interface ErroRedacao {
  trecho: string;
  correcao: string;
  explicacao: string;
}

interface Resultado {
  nota: number;
  resumo: string;
  erros: ErroRedacao[];
  pontosBons: string;
  sugestaoMelhoria: string;
  xpGanho: number;
}

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------

function useContagem(alvo: number, duracao = 1000) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (alvo === 0) { setValor(0); return; }
    let cancelado = false;
    const inicio = performance.now();
    function frame(agora: number) {
      if (cancelado) return;
      const p = Math.min((agora - inicio) / duracao, 1);
      setValor(Number((((1 - (1 - p) * (1 - p)) * alvo)).toFixed(1)));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { cancelado = true; };
  }, [alvo, duracao]);
  return valor;
}

const PALAVRAS_MINIMAS = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RedacaoPage() {
  const [tema, setTema] = useState<Tema | null>(null);
  const [carregandoTema, setCarregandoTema] = useState(false);
  const [texto, setTexto] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroExpandido, setErroExpandido] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const pctPalavras = Math.min(100, Math.round((palavras / PALAVRAS_MINIMAS) * 100));
  const podEnviar = palavras >= PALAVRAS_MINIMAS && !verificando && !resultado;

  // ── Buscar tema ─────────────────────────────────────────────────────
  const buscarTema = useCallback(async () => {
    setCarregandoTema(true);
    setErro(null);
    setResultado(null);
    setTexto('');
    setErroExpandido(null);

    try {
      const res = await fetch('/api/redacao');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar tema');
      setTema(data as Tema);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setCarregandoTema(false);
    }
  }, []);

  useEffect(() => { buscarTema(); }, [buscarTema]);

  // ── Enviar para correção ────────────────────────────────────────────
  const enviar = useCallback(async () => {
    if (!podEnviar || !tema) return;
    setVerificando(true);
    setErro(null);

    try {
      const res = await fetch('/api/redacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema: tema.tema, texto: texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao corrigir');
      setResultado(data as Resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setVerificando(false);
    }
  }, [podEnviar, tema, texto]);

  // Ctrl+Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && podEnviar) {
        e.preventDefault();
        enviar();
      }
    },
    [enviar, podEnviar],
  );

  // Nota animation
  const notaAnimada = useContagem(resultado ? resultado.nota : 0);
  const xpAnimado = useContagem(resultado ? resultado.xpGanho : 0, 800);

  const notaCor =
    resultado && resultado.nota >= 8
      ? 'text-emerald-400'
      : resultado && resultado.nota >= 5
        ? 'text-amber-400'
        : 'text-red-400';

  const notaGradient =
    resultado && resultado.nota >= 8
      ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20'
      : resultado && resultado.nota >= 5
        ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20'
        : 'from-red-500/10 to-red-500/5 border-red-500/20';

  // ====================================================================
  return (
    <div className="redacao-page relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      {/* Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute top-16 left-1/4 h-80 w-80 rounded-full bg-[#1260CC]/8 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-20 right-1/3 h-64 w-64 rounded-full bg-pink-500/6 blur-[100px]" />

      {/* Header */}
      <header className="redacao-stagger mb-8" style={{ '--redacao-delay': '0ms' } as React.CSSProperties}>
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
          <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
            ✍️ Redação
          </span>
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-white/40">
          Escreva sobre o tema proposto. A IA vai corrigir e dar feedback.
        </p>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* ═══ Tema card ══════════════════════════════════════════════ */}
        <div className="redacao-stagger" style={{ '--redacao-delay': '100ms' } as React.CSSProperties}>
          <div className="redacao-card relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/80 backdrop-blur-sm p-6 shadow-xl">
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

            <div className="flex items-start justify-between gap-4 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/30 bg-pink-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-pink-300">
                Vocabulário desta semana
              </span>
              <button
                type="button"
                onClick={buscarTema}
                disabled={carregandoTema || verificando}
                className="redacao-dado group flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-white/40 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/[0.08] hover:text-gray-700 dark:hover:text-white/60 disabled:opacity-40"
              >
                <span className="text-base transition-transform duration-300 group-hover:rotate-180">🎲</span>
                Novo tema
              </button>
            </div>

            {carregandoTema ? (
              <div className="flex items-center gap-3 py-4">
                <span className="redacao-spinner h-5 w-5 rounded-full border-2 border-gray-300 dark:border-white/10 border-t-[#1260CC]" />
                <span className="text-sm text-gray-400 dark:text-white/30">Gerando tema...</span>
              </div>
            ) : tema ? (
              <>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-snug">
                  &ldquo;{tema.tema}&rdquo;
                </h2>
                {tema.dica && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-white/35 flex items-start gap-1.5">
                    <span className="shrink-0">💡</span>
                    {tema.dica}
                  </p>
                )}
              </>
            ) : erro ? (
              <p className="text-sm text-red-400">{erro}</p>
            ) : null}
          </div>
        </div>

        {/* ═══ Editor ═════════════════════════════════════════════════ */}
        {tema && !carregandoTema && (
          <div className="redacao-stagger" style={{ '--redacao-delay': '200ms' } as React.CSSProperties}>
            <div className="redacao-card relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/80 backdrop-blur-sm p-6 shadow-xl">

              {/* Word counter */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 dark:text-white/30">
                  Sua redação
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-white/[0.06]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 bg-gradient-to-r from-[#1260CC] to-[#0ABFDE]"
                      style={{ width: `${pctPalavras}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${
                    palavras >= PALAVRAS_MINIMAS
                      ? 'text-emerald-400'
                      : 'text-gray-400 dark:text-white/30'
                  }`}>
                    {palavras}/{PALAVRAS_MINIMAS}
                  </span>
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Comece a escrever aqui..."
                disabled={verificando || !!resultado}
                rows={10}
                className="w-full resize-none rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] p-4 text-base leading-relaxed text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/20 outline-none transition-all duration-200 focus:border-[#1260CC]/50 focus:ring-2 focus:ring-[#1260CC]/20 disabled:opacity-50"
              />

              {/* Hint */}
              {palavras > 0 && palavras < PALAVRAS_MINIMAS && !resultado && (
                <p className="mt-2 text-xs text-gray-400 dark:text-white/25">
                  Faltam {PALAVRAS_MINIMAS - palavras} palavras para o mínimo
                </p>
              )}

              {/* Submit button */}
              {!resultado && (
                <button
                  type="button"
                  onClick={enviar}
                  disabled={!podEnviar}
                  className="redacao-btn-enviar mt-4 w-full rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {verificando ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="redacao-spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                      Corrigindo...
                    </span>
                  ) : (
                    'Enviar para correção ✓'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ Resultado ══════════════════════════════════════════════ */}
        {resultado && (
          <div className="redacao-resultado space-y-5">

            {/* Nota + resumo */}
            <div className={`rounded-2xl border bg-gradient-to-br ${notaGradient} p-6`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {/* Ring de nota */}
                  <div className="redacao-nota-ring relative flex h-20 w-20 items-center justify-center">
                    <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-200 dark:text-white/[0.06]" />
                      <circle
                        cx="40" cy="40" r="34" fill="none" strokeWidth="4"
                        strokeLinecap="round"
                        className={notaCor}
                        stroke="currentColor"
                        strokeDasharray={`${(resultado.nota / 10) * 213.6} 213.6`}
                        style={{ transition: 'stroke-dasharray 1s ease-out' }}
                      />
                    </svg>
                    <span className={`text-xl font-black tabular-nums ${notaCor}`}>
                      {notaAnimada.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-800 dark:text-white">
                      {resultado.nota >= 8 ? '🎉 Excelente!' : resultado.nota >= 5 ? '💪 Bom trabalho!' : '📚 Continue praticando!'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-white/40 mt-0.5 max-w-xs">
                      {resultado.resumo}
                    </p>
                  </div>
                </div>
                {resultado.xpGanho > 0 && (
                  <div className="redacao-xp-badge flex flex-col items-center">
                    <span className="text-xl font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent tabular-nums">
                      +{Math.round(xpAnimado)}
                    </span>
                    <span className="text-[9px] font-bold text-amber-400/50 uppercase tracking-widest">XP</span>
                  </div>
                )}
              </div>

              {/* Pontos bons */}
              {resultado.pontosBons && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/15 p-3 mt-2">
                  <p className="text-sm text-emerald-400 flex items-start gap-1.5">
                    <span className="shrink-0">✅</span>
                    {resultado.pontosBons}
                  </p>
                </div>
              )}
            </div>

            {/* Erros encontrados */}
            {resultado.erros.length > 0 && (
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/80 backdrop-blur-sm p-6 shadow-xl">
                <h3 className="text-xs font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] text-red-400 font-black">
                    {resultado.erros.length}
                  </span>
                  {resultado.erros.length === 1 ? 'Erro encontrado' : 'Erros encontrados'}
                </h3>

                <div className="space-y-3">
                  {resultado.erros.map((err, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setErroExpandido(erroExpandido === i ? null : i)}
                      className="redacao-erro-item w-full text-left rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.03] p-4 transition-all duration-200 hover:bg-gray-100 dark:hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-sm text-red-400 line-through">
                              {err.trecho}
                            </span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-400 dark:text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-sm text-emerald-400 font-medium">
                              {err.correcao}
                            </span>
                          </div>
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 text-gray-400 dark:text-white/20 shrink-0 transition-transform duration-200 ${erroExpandido === i ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {erroExpandido === i && (
                        <p className="mt-3 text-sm text-gray-600 dark:text-white/50 border-t border-gray-200 dark:border-white/[0.06] pt-3">
                          💡 {err.explicacao}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestão de melhoria */}
            {resultado.sugestaoMelhoria && (
              <div className="rounded-2xl border border-[#1260CC]/20 bg-[#1260CC]/5 p-5">
                <h3 className="text-xs font-bold text-[#378ADD] uppercase tracking-wider mb-2">
                  Sugestão de melhoria
                </h3>
                <p className="text-sm text-[#378ADD]/80">
                  {resultado.sugestaoMelhoria}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={buscarTema}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.01] active:scale-[0.98]"
              >
                Novo tema →
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

        {/* Error state */}
        {erro && !tema && (
          <div className="redacao-stagger" style={{ '--redacao-delay': '100ms' } as React.CSSProperties}>
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="text-red-300 text-sm">{erro}</p>
              <button
                onClick={buscarTema}
                className="mt-4 rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
