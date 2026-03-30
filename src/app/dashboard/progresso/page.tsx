// Página de progresso — dados reais de estudo, mapa de conhecimento, gráfico semanal

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Tipos da API
// ---------------------------------------------------------------------------

interface DiaSemana {
  data: string;
  abrev: string;
  cards: number;
  acerto: number;
  xp: number;
}

interface TemaInfo {
  nome: string;
  tema: string;
  cor: string;
  total: number;
  dominados: number;
}

interface ProgressoData {
  totalEstudados: number;
  estudadosSemana: number;
  taxaAcerto: number;
  streakAtual: number;
  melhorStreak: number;
  semana: DiaSemana[];
  linhaTempo: DiaSemana[];
  temas: TemaInfo[];
}

const TEMA_ICONES: Record<string, string> = {
  'Vocabulário': '📚',
  'Verbos': '⚡',
  'Gramática': '📖',
  'Frases': '💬',
  'Expressões': '🗣️',
  'Cultura': '🌎',
  'Gírias': '🎭',
  'Outro': '📝',
};

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function ProgressoPage() {
  const [dados, setDados] = useState<ProgressoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function buscar() {
      try {
        const res = await fetch('/api/progresso');
        if (!res.ok) return;
        const data = await res.json();
        setDados(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    buscar();
  }, []);

  const maxSemana = useMemo(() => {
    if (!dados) return 1;
    return Math.max(1, ...dados.semana.map((d) => d.cards));
  }, [dados]);

  const totalSemanal = useMemo(() => {
    if (!dados) return 0;
    return dados.semana.reduce((s, d) => s + d.cards, 0);
  }, [dados]);

  // Resumo cards (real data)
  const resumo = useMemo(() => {
    if (!dados) return [];
    return [
      {
        label: 'Cards estudados',
        valor: dados.totalEstudados.toLocaleString('pt-BR'),
        icone: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        ),
        cor: 'from-primary to-medium',
        corIcone: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-cyan',
      },
      {
        label: 'Taxa de acerto',
        valor: `${dados.taxaAcerto}%`,
        icone: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        cor: 'from-emerald-400 to-emerald-600',
        corIcone: 'bg-emerald-400/10 text-emerald-500 dark:bg-emerald-400/20 dark:text-emerald-400',
      },
      {
        label: 'Streak atual',
        valor: `${dados.streakAtual} ${dados.streakAtual === 1 ? 'dia' : 'dias'}`,
        icone: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 6.51 6.51 0 009 11.5a3 3 0 105.09-2.137 8.284 8.284 0 011.272-4.149z" />
          </svg>
        ),
        cor: 'from-orange-400 to-orange-600',
        corIcone: 'bg-orange-400/10 text-orange-500 dark:bg-orange-400/20 dark:text-orange-400',
      },
      {
        label: 'Esta semana',
        valor: dados.estudadosSemana.toLocaleString('pt-BR'),
        icone: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        cor: 'from-violet-400 to-violet-600',
        corIcone: 'bg-violet-400/10 text-violet-500 dark:bg-violet-400/20 dark:text-violet-400',
      },
    ];
  }, [dados]);

  // Dica dinâmica baseada nos dados reais
  const dica = useMemo(() => {
    if (!dados || dados.temas.length === 0) return null;
    const sorted = [...dados.temas].sort((a, b) => {
      const pctA = a.total > 0 ? a.dominados / a.total : 0;
      const pctB = b.total > 0 ? b.dominados / b.total : 0;
      return pctA - pctB;
    });
    const pior = sorted[0];
    const melhor = sorted[sorted.length - 1];
    if (sorted.length < 2) return null;
    const pctMelhor = melhor.total > 0 ? Math.round((melhor.dominados / melhor.total) * 100) : 0;
    const pctPior = pior.total > 0 ? Math.round((pior.dominados / pior.total) * 100) : 0;
    return { melhor: melhor.nome, pctMelhor, pior: pior.nome, pctPior };
  }, [dados]);

  const temDados = dados && dados.totalEstudados > 0;

  // ── Loading skeleton ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="prog-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        <div className="prog-header">
          <div className="h-10 w-48 rounded-xl bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
          <div className="mt-2 h-4 w-64 rounded-lg bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
      </div>
    );
  }

  // ── Estado vazio ──────────────────────────────────────────────────
  if (!temDados) {
    return (
      <div className="prog-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="prog-header mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-primary via-medium to-cyan bg-clip-text text-transparent">
              Progresso
            </span>
          </h1>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20 text-4xl mb-6">
            📊
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Comece a estudar para ver seu progresso aqui!
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/40 max-w-sm">
            Assim que você revisar seus primeiros cards, suas estatísticas aparecerão nesta página.
          </p>
          <Link
            href="/dashboard/estudar"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-medium px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Começar a estudar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="prog-page mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

      {/* ─── HEADER ────────────────────────────────────────────── */}
      <div className="prog-header">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-primary via-medium to-cyan bg-clip-text text-transparent">
            Progresso
          </span>
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/40">
          Últimos 30 dias de estudo
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          1. RESUMO DO PERÍODO
      ═══════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {resumo.map((item, i) => (
          <div
            key={item.label}
            className="prog-stat-card group relative overflow-hidden rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-4 sm:p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/30 hover:-translate-y-0.5"
            style={{ '--prog-stat-delay': `${i * 80}ms` } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-br from-white/0 via-white/0 to-gray-50/50 dark:to-white/[0.02]" />
            <div className="relative flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tabular-nums tracking-tight">
                  {item.valor}
                </p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.corIcone} transition-transform duration-200 group-hover:scale-110`}>
                {item.icone}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-full">
              <div
                className={`prog-stat-bar h-full bg-gradient-to-r ${item.cor}`}
                style={{ '--prog-stat-delay': `${i * 80 + 300}ms` } as React.CSSProperties}
              />
            </div>
          </div>
        ))}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          2. MAPA DE CONHECIMENTO POR TEMA
      ═══════════════════════════════════════════════════════════ */}
      {dados!.temas.length > 0 && (
        <section className="prog-section rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 sm:p-6" style={{ '--prog-section-delay': '200ms' } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🗺️</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Mapa de Conhecimento
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dados!.temas.map((tema, i) => {
              const pct = tema.total > 0 ? Math.round((tema.dominados / tema.total) * 100) : 0;
              const icone = TEMA_ICONES[tema.tema] || TEMA_ICONES[tema.nome] || '📝';
              return (
                <div
                  key={tema.nome}
                  className="prog-tema-card group rounded-xl border border-gray-100 dark:border-white/[0.04] bg-gray-50/50 dark:bg-white/[0.02] p-4 transition-all duration-200 hover:bg-white dark:hover:bg-white/[0.04] hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20"
                  style={{ '--prog-tema-delay': `${i * 100 + 400}ms` } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-base transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: `${tema.cor}1f` }}
                      >
                        {icone}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{tema.nome}</p>
                        <p className="text-[11px] text-gray-400 dark:text-white/30">
                          {tema.dominados}/{tema.total} cards
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-extrabold tabular-nums"
                      style={{ color: tema.cor }}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200/60 dark:bg-white/[0.06]">
                    <div
                      className="prog-tema-bar absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                      style={{
                        '--prog-tema-width': `${pct}%`,
                        '--prog-tema-delay': `${i * 100 + 600}ms`,
                        background: `linear-gradient(90deg, ${tema.cor}, ${tema.cor}cc)`,
                      } as React.CSSProperties}
                    />
                    <div
                      className="prog-tema-bar absolute inset-y-0 left-0 rounded-full blur-sm opacity-40 transition-all duration-700"
                      style={{
                        '--prog-tema-width': `${pct}%`,
                        '--prog-tema-delay': `${i * 100 + 600}ms`,
                        background: tema.cor,
                      } as React.CSSProperties}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Layout 2 colunas: linha do tempo + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

        {/* ═══════════════════════════════════════════════════════
            3. LINHA DO TEMPO
        ═══════════════════════════════════════════════════════ */}
        {dados!.linhaTempo.length > 0 && (
          <section className="prog-section lg:col-span-3 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 sm:p-6" style={{ '--prog-section-delay': '350ms' } as React.CSSProperties}>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">📅</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Linha do Tempo
              </h2>
            </div>

            <div className="space-y-1">
              {dados!.linhaTempo.map((atv, i) => (
                <div
                  key={atv.data}
                  className="prog-timeline-item group relative flex items-center gap-4 rounded-xl px-3 py-3 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  style={{ '--prog-timeline-delay': `${i * 70 + 500}ms` } as React.CSSProperties}
                >
                  {i < dados!.linhaTempo.length - 1 && (
                    <div className="absolute left-[22px] top-[42px] w-px h-[calc(100%-18px)] bg-gray-200 dark:bg-white/[0.06]" />
                  )}

                  <div className={`relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${
                    i === 0
                      ? 'bg-primary dark:bg-cyan shadow-md shadow-primary/30 dark:shadow-cyan/30'
                      : 'bg-gray-300 dark:bg-white/20'
                  }`}>
                    {i === 0 && <div className="absolute inset-0 animate-ping rounded-full bg-primary/40 dark:bg-cyan/30" />}
                  </div>

                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {atv.abrev}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-white/30">
                        {atv.cards} cards revisados
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        atv.acerto >= 85
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400'
                          : atv.acerto >= 70
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                            : 'bg-red-50 text-red-500 dark:bg-red-400/10 dark:text-red-400'
                      }`}>
                        {atv.acerto}%
                      </span>

                      <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 tabular-nums">
                        +{atv.xp} XP
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════
            4. GRÁFICO DE ATIVIDADE SEMANAL
        ═══════════════════════════════════════════════════════ */}
        <section className={`prog-section ${dados!.linhaTempo.length > 0 ? 'lg:col-span-2' : 'lg:col-span-5'} rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 sm:p-6`} style={{ '--prog-section-delay': '500ms' } as React.CSSProperties}>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Esta Semana
            </h2>
          </div>

          <div className="flex items-end justify-between gap-2 sm:gap-3 h-44">
            {dados!.semana.map((dia, i) => {
              const pctAltura = maxSemana > 0 ? (dia.cards / maxSemana) * 100 : 0;
              const isHoje = i === dados!.semana.length - 1;

              return (
                <div
                  key={dia.abrev}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className={`prog-chart-label text-[10px] font-bold tabular-nums ${
                    isHoje
                      ? 'text-primary dark:text-cyan'
                      : 'text-gray-400 dark:text-white/30'
                  }`}
                    style={{ '--prog-chart-delay': `${i * 80 + 700}ms` } as React.CSSProperties}
                  >
                    {dia.cards}
                  </span>

                  <div className="relative w-full flex-1 flex items-end">
                    <div
                      className={`prog-chart-bar relative w-full rounded-t-lg overflow-hidden ${
                        isHoje ? 'shadow-md shadow-primary/20 dark:shadow-cyan/20' : ''
                      }`}
                      style={{
                        '--prog-chart-height': `${Math.max(pctAltura, 5)}%`,
                        '--prog-chart-delay': `${i * 80 + 700}ms`,
                      } as React.CSSProperties}
                    >
                      <div className={`absolute inset-0 ${
                        isHoje
                          ? 'bg-gradient-to-t from-primary to-cyan'
                          : 'bg-gradient-to-t from-primary/70 to-primary/40 dark:from-primary/50 dark:to-primary/25'
                      }`} />
                      <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-200 hover:opacity-100" />
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold ${
                    isHoje
                      ? 'text-primary dark:text-cyan font-bold'
                      : 'text-gray-400 dark:text-white/30'
                  }`}>
                    {dia.abrev}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-50 dark:bg-white/[0.03] p-3">
            <span className="text-xs font-semibold text-gray-500 dark:text-white/40">
              Total semanal
            </span>
            <span className="text-sm font-extrabold text-gray-900 dark:text-white tabular-nums">
              {totalSemanal} cards
            </span>
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5. DICA MOTIVACIONAL
      ═══════════════════════════════════════════════════════════ */}
      {dica && (
        <div
          className="prog-tip relative overflow-hidden rounded-2xl border border-primary/10 dark:border-cyan/10 bg-gradient-to-r from-primary/5 via-transparent to-cyan/5 dark:from-primary/10 dark:to-cyan/10 p-5 sm:p-6"
          style={{ '--prog-tip-delay': '800ms' } as React.CSSProperties}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">💡</span>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Dica de estudo</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-white/40 leading-relaxed">
                Você domina <strong className="text-emerald-600 dark:text-emerald-400">{dica.pctMelhor}%</strong> em {dica.melhor} mas apenas{' '}
                <strong className="text-orange-500 dark:text-orange-400">{dica.pctPior}%</strong> em {dica.pior}. Que tal focar nesse tema esta semana?
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          6. TESTE DE NOTIFICAÇÕES
      ═══════════════════════════════════════════════════════════ */}
      <NotificacoesTeste />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente de teste de notificações
// ---------------------------------------------------------------------------

function NotificacoesTeste() {
  const [mensagem, setMensagem] = useState('');
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const addLog = useCallback((msg: string) => {
    setLogEntries((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  async function pedirPermissao() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

    // Diagnóstico completo
    addLog('── Diagnóstico ──');
    addLog(`iOS: ${isIOS}`);
    addLog(`Standalone (PWA): ${isStandalone}`);
    addLog(`navigator.standalone: ${(navigator as unknown as { standalone?: boolean }).standalone}`);
    addLog(`display-mode standalone: ${window.matchMedia('(display-mode: standalone)').matches}`);
    addLog(`"Notification" in window: ${'Notification' in window}`);
    addLog(`"serviceWorker" in navigator: ${'serviceWorker' in navigator}`);
    addLog(`"PushManager" in window: ${'PushManager' in window}`);
    addLog(`UserAgent: ${navigator.userAgent.slice(0, 120)}`);
    addLog('──────────────────');

    if (!('Notification' in window)) {
      if (isIOS && !isStandalone) {
        addLog('⚠️ Notification API ausente. No iOS, precisa:');
        addLog('1. Abrir no Safari (NÃO Chrome/Firefox)');
        addLog('2. Tocar compartilhar (↑) → "Adicionar à Tela de Início"');
        addLog('3. Abrir o Maestro pelo ícone na tela inicial');
      } else if (isIOS && isStandalone) {
        addLog('❌ Notification API não disponível mesmo como PWA.');
        addLog('Pode ser que o iOS não reconheceu como PWA válido.');
        addLog('Tente: remover da tela inicial → limpar cache do Safari → adicionar novamente.');
      } else {
        addLog('❌ Este navegador não suporta notificações.');
      }
      return;
    }

    addLog('Notification API disponível. Registrando...');

    try {
      const { solicitarPermissao } = await import('@/lib/notifications');
      const token = await solicitarPermissao();

      if (token) {
        addLog(`✅ Token FCM obtido: ${token.slice(0, 20)}...`);
        addLog('Token salvo no perfil do Supabase.');

        // Verificar se realmente salvou
        const { createBrowserClient } = await import('@supabase/ssr');
        const sb = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          const { data: profile, error: profileErr } = await sb
            .from('profiles')
            .select('fcm_token')
            .eq('id', user.id)
            .single();
          if (profileErr) {
            addLog(`⚠️ Erro ao verificar profile: ${profileErr.message}`);
          } else if (profile?.fcm_token) {
            addLog(`✅ Confirmado: fcm_token salvo no banco (${(profile.fcm_token as string).slice(0, 20)}...)`);
          } else {
            addLog('❌ fcm_token NÃO está no banco! O upsert pode ter falhado por RLS.');
          }
        }
      } else {
        addLog('❌ Não foi possível obter token FCM.');
      }
    } catch (err) {
      addLog(`❌ Erro ao registrar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function enviarTeste() {
    const texto = mensagem.trim();
    if (!texto) {
      addLog('⚠️ Digite uma mensagem primeiro.');
      return;
    }

    setEnviando(true);
    addLog(`Enviando push: "${texto}"...`);

    try {
      const res = await fetch('/api/notificacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'conquista',
          titulo: '🔔 Teste de Notificação',
          mensagem: texto,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        addLog(`❌ Erro ${res.status}: ${data.error || JSON.stringify(data)}`);
      } else if (data.enviado === false) {
        addLog(`⚠️ Não enviado: ${data.motivo || 'sem token FCM no perfil'}`);
      } else {
        addLog(`✅ Push enviado! ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`❌ Erro de rede: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEnviando(false);
    }
  }

  async function testarLocal() {
    const texto = mensagem.trim() || 'Teste local do Maestro';
    addLog(`Notificação local: "${texto}"...`);

    if (Notification.permission !== 'granted') {
      addLog('❌ Permissão não concedida. Clique em "Ativar Permissão" primeiro.');
      return;
    }

    try {
      new Notification('🔔 Teste Local', { body: texto, icon: '/icon-192.png' });
      addLog('✅ Notificação local exibida.');
    } catch (err) {
      addLog(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between p-5 sm:p-6 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Teste de Notificações
          </h2>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {aberto && (
        <div className="border-t border-gray-200/60 dark:border-white/[0.06] p-5 sm:p-6 space-y-5">
          {/* Passo 1 */}
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-white/70">1. Ativar permissão + registrar token</p>
            <button
              onClick={pedirPermissao}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ativar Permissão
            </button>
          </div>

          {/* Passo 2 */}
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-white/70">2. Enviar notificação de teste</p>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite a mensagem..."
              rows={2}
              className="mb-3 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.03] p-2.5 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                onClick={enviarTeste}
                disabled={enviando}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {enviando ? 'Enviando...' : 'Push (servidor)'}
              </button>
              <button
                onClick={testarLocal}
                className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 transition-colors"
              >
                Local (sem servidor)
              </button>
            </div>
          </div>

          {/* Log */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700 dark:text-white/70">Log</p>
              <button onClick={() => setLogEntries([])} className="text-xs text-gray-400 hover:text-gray-200">Limpar</button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-100 dark:bg-black/30 p-3 font-mono text-xs">
              {logEntries.length === 0 ? (
                <span className="text-gray-400">Nenhum log ainda...</span>
              ) : (
                logEntries.map((entry, i) => (
                  <div key={i} className="mb-1 whitespace-pre-wrap">{entry}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
