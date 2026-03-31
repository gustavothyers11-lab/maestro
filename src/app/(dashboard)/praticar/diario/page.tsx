// Página de diário — escrita livre em espanhol com correção positiva por IA

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErroDiario {
  trecho: string;
  correcao: string;
  explicacao: string;
}

interface Correcao {
  mensagem: string;
  erros: ErroDiario[];
  elogios: string;
  dicaDoDia: string;
}

interface Entrada {
  id: string;
  conteudo: string;
  correcao: Correcao | null;
  criado_em: string;
  palavras: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatarDataHoje() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function previewTexto(texto: string, max = 60) {
  if (texto.length <= max) return texto;
  return texto.slice(0, max).trim() + '…';
}

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

export default function DiarioPage() {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [correcaoAtual, setCorrecaoAtual] = useState<Correcao | null>(null);
  const [xpGanho, setXpGanho] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Entrada[]>([]);
  const [carregandoHist, setCarregandoHist] = useState(true);
  const [entradaSelecionada, setEntradaSelecionada] = useState<Entrada | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
  const xpAnimado = useContagem(correcaoAtual ? xpGanho : 0);

  // ── Buscar histórico ────────────────────────────────────────────────
  const buscarHistorico = useCallback(async () => {
    try {
      const res = await fetch('/api/diario');
      const data = await res.json();
      if (res.ok && data.entradas) {
        setHistorico(data.entradas);
      }
    } catch {
      // silently fail
    } finally {
      setCarregandoHist(false);
    }
  }, []);

  useEffect(() => { buscarHistorico(); }, [buscarHistorico]);

  // ── Enviar para correção ────────────────────────────────────────────
  const corrigir = useCallback(async () => {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch('/api/diario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conteudo: texto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro ao corrigir');

      setCorrecaoAtual(data.correcao as Correcao);
      setXpGanho(data.xpGanho ?? 10);
      setPainelAberto(true);

      // Refresh histórico
      buscarHistorico();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setEnviando(false);
    }
  }, [texto, enviando, buscarHistorico]);

  // ── Nova entrada ────────────────────────────────────────────────────
  const novaEntrada = useCallback(() => {
    setTexto('');
    setCorrecaoAtual(null);
    setXpGanho(0);
    setPainelAberto(false);
    setEntradaSelecionada(null);
    setErro(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  // ── Ver entrada antiga ──────────────────────────────────────────────
  const verEntrada = useCallback((entrada: Entrada) => {
    setEntradaSelecionada(entrada);
    setCorrecaoAtual(entrada.correcao);
    setTexto(entrada.conteudo);
    setPainelAberto(true);
    setXpGanho(0);
  }, []);

  // Ctrl+Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && texto.trim() && !correcaoAtual) {
        e.preventDefault();
        corrigir();
      }
    },
    [corrigir, texto, correcaoAtual],
  );

  // ====================================================================
  return (
    <div className="diario-page relative min-h-screen">
      {/* Orbs */}
      <div aria-hidden="true" className="pointer-events-none absolute top-20 left-1/4 h-80 w-80 rounded-full bg-emerald-500/6 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-20 right-1/3 h-64 w-64 rounded-full bg-[#1260CC]/6 blur-[100px]" />

      <div className="flex min-h-screen">
        {/* ═══════════════════════ SIDEBAR — Histórico ════════════════ */}
        <aside className="diario-sidebar hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-[#12122a]/50">
          <div className="p-5 border-b border-gray-200 dark:border-white/[0.06]">
            <Link
              href="/dashboard/praticar"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors mb-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </Link>
            <h2 className="text-xs font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider">
              Entradas anteriores
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {carregandoHist ? (
              <div className="flex justify-center py-8">
                <span className="diario-spinner h-5 w-5 rounded-full border-2 border-gray-300 dark:border-white/10 border-t-emerald-500" />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-center text-xs text-gray-400 dark:text-white/20 py-8">
                Nenhuma entrada ainda.
                <br />Comece a escrever! 📝
              </p>
            ) : (
              historico.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => verEntrada(ent)}
                  className={`diario-hist-item w-full text-left rounded-xl p-3 transition-all duration-200 ${
                    entradaSelecionada?.id === ent.id
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'hover:bg-gray-100 dark:hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 tabular-nums">
                    {formatarData(ent.criado_em)}
                    <span className="ml-2 text-gray-300 dark:text-white/15">
                      {ent.palavras} palavras
                    </span>
                  </p>
                  <p className="text-sm text-gray-600 dark:text-white/50 mt-1 leading-snug line-clamp-2">
                    {previewTexto(ent.conteudo)}
                  </p>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={novaEntrada}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.97]"
            >
              <span className="text-base">✏️</span>
              Nova entrada
            </button>
          </div>
        </aside>

        {/* ═══════════════════════ MAIN — Editor ═════════════════════ */}
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <header className="diario-stagger px-4 sm:px-6 lg:px-8 pt-6 pb-4" style={{ '--diario-delay': '0ms' } as React.CSSProperties}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href="/dashboard/praticar"
                  className="lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 transition-colors mb-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </Link>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    📔 Diário
                  </span>
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-white/35 capitalize">
                  {formatarDataHoje()}
                </p>
              </div>

              {/* Mobile: dropdown history */}
              <div className="lg:hidden flex items-center gap-2">
                {xpGanho > 0 && correcaoAtual && (
                  <span className="diario-xp-badge text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                    +{xpAnimado} XP
                  </span>
                )}
                <button
                  type="button"
                  onClick={novaEntrada}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-white/40 transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.08]"
                >
                  ✏️ Nova
                </button>
              </div>
            </div>
          </header>

          {/* Editor area */}
          <div className="diario-stagger flex-1 flex flex-col px-4 sm:px-6 lg:px-8 pb-6" style={{ '--diario-delay': '100ms' } as React.CSSProperties}>
            <div className="diario-editor relative flex-1 flex flex-col rounded-2xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#1a1a2e]/60 backdrop-blur-sm shadow-xl overflow-hidden">
              {/* Top shimmer */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />

              {/* Textarea */}
              <div className="flex-1 p-4 sm:p-6">
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Comece a escrever aqui... Escreva sobre o seu dia, seus pensamentos, o que quiser. 📝"
                  disabled={enviando || !!entradaSelecionada}
                  className="diario-textarea w-full h-full min-h-[300px] lg:min-h-[400px] resize-none bg-transparent text-base sm:text-lg leading-relaxed text-gray-900 dark:text-white/90 placeholder:text-gray-300 dark:placeholder:text-white/15 outline-none disabled:opacity-60"
                  autoFocus
                />
              </div>

              {/* Footer bar */}
              <div className="flex items-center justify-between gap-4 border-t border-gray-100 dark:border-white/[0.04] px-4 sm:px-6 py-3 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold tabular-nums transition-colors ${
                    palavras >= 10 ? 'text-emerald-500' : 'text-gray-400 dark:text-white/25'
                  }`}>
                    {palavras} {palavras === 1 ? 'palavra' : 'palavras'}
                  </span>
                  {!correcaoAtual && texto.trim() && (
                    <span className="text-[10px] text-gray-300 dark:text-white/15">
                      Ctrl+Enter para corrigir
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* XP badge (desktop) */}
                  {xpGanho > 0 && correcaoAtual && (
                    <span className="diario-xp-badge hidden lg:inline text-sm font-black bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                      +{xpAnimado} XP
                    </span>
                  )}

                  {correcaoAtual && !entradaSelecionada ? (
                    <button
                      type="button"
                      onClick={() => setPainelAberto(!painelAberto)}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition-all duration-200 hover:bg-emerald-500/20"
                    >
                      {painelAberto ? 'Ocultar correção' : 'Ver correção'}
                    </button>
                  ) : entradaSelecionada ? (
                    <button
                      type="button"
                      onClick={novaEntrada}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.97]"
                    >
                      ✏️ Escrever novo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={corrigir}
                      disabled={!texto.trim() || enviando}
                      className="diario-btn-corrigir flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1260CC] to-[#378ADD] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#1260CC]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {enviando ? (
                        <>
                          <span className="diario-spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                          Corrigindo...
                        </>
                      ) : (
                        'Corrigir com IA ✨'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error toast */}
            {erro && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {erro}
              </div>
            )}
          </div>
        </main>

        {/* ═══════════════════════ PAINEL — Correção ═════════════════ */}
        <div
          className={`
            diario-painel fixed lg:relative inset-y-0 right-0 z-30
            w-full sm:w-96 lg:w-80 xl:w-96 shrink-0
            border-l border-gray-200 dark:border-white/[0.06]
            bg-white dark:bg-[#14142e]/95 backdrop-blur-xl
            transform transition-transform duration-300 ease-out
            ${painelAberto ? 'translate-x-0' : 'translate-x-full lg:translate-x-full'}
            flex flex-col overflow-hidden shadow-2xl lg:shadow-none
          `}
        >
          {/* Painel header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/[0.06]">
            <h3 className="text-sm font-bold text-gray-500 dark:text-white/40 uppercase tracking-wider">
              Correção
            </h3>
            <button
              type="button"
              onClick={() => setPainelAberto(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 dark:text-white/30 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Painel content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {correcaoAtual && (
              <>
                {/* Mensagem encorajadora */}
                <div className="diario-correcao-item rounded-xl bg-emerald-500/10 border border-emerald-500/15 p-4">
                  <p className="text-sm font-medium text-emerald-400">
                    🎉 {correcaoAtual.mensagem}
                  </p>
                </div>

                {/* Elogios */}
                {correcaoAtual.elogios && (
                  <div className="diario-correcao-item rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-4">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2">
                      ✅ Pontos positivos
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-white/50 leading-relaxed">
                      {correcaoAtual.elogios}
                    </p>
                  </div>
                )}

                {/* Erros */}
                {correcaoAtual.erros.length > 0 ? (
                  <div className="diario-correcao-item space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-400 font-black">
                        {correcaoAtual.erros.length}
                      </span>
                      {correcaoAtual.erros.length === 1 ? 'Sugestão' : 'Sugestões'}
                    </h4>
                    {correcaoAtual.erros.map((err, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-4 space-y-2"
                      >
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
                        <p className="text-xs text-gray-500 dark:text-white/35 leading-relaxed">
                          💡 {err.explicacao}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="diario-correcao-item rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4 text-center">
                    <p className="text-3xl mb-2">🏆</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      Nenhum erro encontrado!
                    </p>
                    <p className="text-xs text-emerald-400/50 mt-1">
                      Texto impecável. Parabéns!
                    </p>
                  </div>
                )}

                {/* Dica do dia */}
                {correcaoAtual.dicaDoDia && (
                  <div className="diario-correcao-item rounded-xl bg-[#1260CC]/5 border border-[#1260CC]/15 p-4">
                    <h4 className="text-xs font-bold text-[#378ADD] uppercase tracking-wider mb-2">
                      💡 Dica do dia
                    </h4>
                    <p className="text-sm text-[#378ADD]/70 leading-relaxed">
                      {correcaoAtual.dicaDoDia}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Overlay for mobile painel */}
        {painelAberto && (
          <div
            className="lg:hidden fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
            onClick={() => setPainelAberto(false)}
          />
        )}
      </div>

      {/* Mobile history — horizontal scroll at bottom */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-10 border-t border-gray-200 dark:border-white/[0.06] bg-white/90 dark:bg-[#0f0f1a]/90 backdrop-blur-xl">
        <div className="flex overflow-x-auto gap-2 p-3 scrollbar-hide">
          {historico.slice(0, 5).map((ent) => (
            <button
              key={ent.id}
              type="button"
              onClick={() => verEntrada(ent)}
              className={`shrink-0 rounded-xl px-3 py-2 text-left transition-all duration-200 min-w-[140px] max-w-[180px] ${
                entradaSelecionada?.id === ent.id
                  ? 'bg-emerald-500/10 border border-emerald-500/20'
                  : 'bg-gray-100 dark:bg-white/[0.04] border border-transparent'
              }`}
            >
              <p className="text-[10px] font-semibold text-gray-400 dark:text-white/25 tabular-nums">
                {formatarData(ent.criado_em)}
              </p>
              <p className="text-xs text-gray-600 dark:text-white/40 mt-0.5 truncate">
                {previewTexto(ent.conteudo, 35)}
              </p>
            </button>
          ))}
          {historico.length === 0 && !carregandoHist && (
            <p className="text-xs text-gray-400 dark:text-white/20 py-2 px-2">
              Suas entradas aparecerão aqui
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
