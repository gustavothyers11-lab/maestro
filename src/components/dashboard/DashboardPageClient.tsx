// Conteúdo client do dashboard — interações de UI, estado local e animações

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';

// ---------------------------------------------------------------------------
// Dados mockados
// ---------------------------------------------------------------------------

const MOCK_BARALHOS = [
  { id: '1', nome: 'Vocabulário', cor: '#1260CC', total: 40, revisados: 28 },
  { id: '2', nome: 'Verbos', cor: '#0ABFDE', total: 25, revisados: 12 },
  { id: '3', nome: 'Frases', cor: '#378ADD', total: 30, revisados: 9 },
];

const MOCK_CARDS_PENDENTES = [
  { id: 'c1', frente: 'Hablar', baralho: 'Verbos', genero: 'neutro' as const },
  { id: 'c2', frente: 'La mariposa', baralho: 'Vocabulário', genero: 'feminino' as const },
  { id: 'c3', frente: 'El atardecer', baralho: 'Vocabulário', genero: 'masculino' as const },
  { id: 'c4', frente: 'Tener en cuenta', baralho: 'Frases', genero: 'neutro' as const },
  { id: 'c5', frente: 'Dormir', baralho: 'Verbos', genero: 'neutro' as const },
  { id: 'c6', frente: 'La estrella', baralho: 'Vocabulário', genero: 'feminino' as const },
  { id: 'c7', frente: 'Poder', baralho: 'Verbos', genero: 'neutro' as const },
  { id: 'c8', frente: 'Buenos días', baralho: 'Frases', genero: 'neutro' as const },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-gray-200 dark:bg-white/[0.06] ${className}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Dark mode toggle
// ---------------------------------------------------------------------------

function DarkModeToggle() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains('dark'));
  }, []);

  const alternar = () => {
    const next = !escuro;
    setEscuro(next);
    document.documentElement.classList.toggle('dark', next);
  };

  return (
    <button
      onClick={alternar}
      aria-label={escuro ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className="
        dark-toggle flex h-9 w-9 items-center justify-center rounded-xl
        bg-gray-100 text-gray-600
        dark:bg-white/10 dark:text-yellow-300
        hover:bg-gray-200 dark:hover:bg-white/20
        transition-colors duration-200
      "
    >
      <span className="dark-toggle-icon inline-block transition-transform duration-500">
        {escuro ? (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </span>
    </button>
  );
}

export default function DashboardPageClient() {
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setCarregando(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (carregando) {
    return (
      <div className="dash-page w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-14" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-64" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page w-full px-4 py-6 sm:px-6 lg:px-8 scroll-smooth">
      <header
        className="dash-section flex items-center justify-between mb-6"
        style={{ '--stagger': '0ms' } as React.CSSProperties}
      >
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] bg-clip-text text-transparent">
            Maestro
          </span>
        </h1>
        <DarkModeToggle />
      </header>

      <div
        className="dash-section mb-6"
        style={{ '--stagger': '100ms' } as React.CSSProperties}
      >
        <div
          className="
            streak-banner relative overflow-hidden rounded-2xl border
            border-yellow-500/60
            bg-gradient-to-r from-amber-900/80 via-orange-900/80 to-amber-900/80
            p-4 sm:p-5 transition-shadow duration-300
          "
          style={{ boxShadow: '0 0 24px rgba(234,179,8,0.3)' }}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className="streak-particle absolute rounded-full bg-white/10"
                style={{
                  width: `${4 + i * 2}px`,
                  height: `${4 + i * 2}px`,
                  left: `${10 + i * 15}%`,
                  top: `${20 + (i % 3) * 25}%`,
                  '--delay': `${i * 0.4}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-4">
            <div className="streak-fire flex-shrink-0 text-4xl sm:text-5xl select-none">🔥</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="streak-count text-3xl sm:text-4xl font-extrabold tabular-nums text-yellow-300">7</span>
                <span className="text-sm sm:text-base font-semibold text-white/80">dias seguidos!</span>
                <span className="streak-meta-badge ml-auto inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-bold text-green-300 border border-green-500/30">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Meta de hoje
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-white/60 leading-relaxed">Você está em chamas! Ninguém te para.</p>
            </div>
          </div>

          <span className="absolute -top-px -right-px rounded-bl-xl rounded-tr-2xl px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/30 text-yellow-200">
            Em chamas
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="dash-section" style={{ '--stagger': '200ms' } as React.CSSProperties}>
            <Card variante="default">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-500 dark:text-white/60 uppercase tracking-wide">Meta diária</h3>
                <span className="text-xs font-semibold text-gray-400 dark:text-white/40 tabular-nums">60%</span>
              </div>
              <ProgressBar valor={60} variante="default" />
              <div className="mt-3 flex items-end justify-between">
                <p className="text-sm text-gray-600 dark:text-white/70">
                  <span className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">12</span>
                  <span className="mx-1 text-gray-300 dark:text-white/30">/</span>
                  <span className="font-semibold tabular-nums">20</span>
                  <span className="ml-1 text-gray-400 dark:text-white/50 text-xs">cards revisados hoje</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-white/40 tabular-nums flex items-center gap-1">
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.828a1 1 0 101.415-1.414L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  18 min
                </p>
              </div>
            </Card>
          </div>

          <div className="dash-section" style={{ '--stagger': '300ms' } as React.CSSProperties}>
            <Link href="/estudar" className="block">
              <button
                type="button"
                className="
                  estudar-btn group relative w-full overflow-hidden rounded-2xl
                  bg-gradient-to-r from-[#1260CC] via-[#378ADD] to-[#0ABFDE]
                  px-6 py-4 text-lg font-bold text-white
                  shadow-lg shadow-primary/25
                  hover:shadow-xl hover:shadow-cyan/30
                  active:scale-[0.98]
                  transition-all duration-200
                "
              >
                <span
                  aria-hidden="true"
                  className="
                    pointer-events-none absolute inset-0
                    bg-gradient-to-r from-white/0 via-white/25 to-white/0
                    -translate-x-full group-hover:translate-x-full
                    transition-transform duration-700 ease-in-out
                  "
                />
                <span className="relative flex items-center justify-center gap-3">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Estudar Agora
                </span>
              </button>
            </Link>
          </div>

          <div className="dash-section" style={{ '--stagger': '400ms' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">Seus Baralhos</h2>
              <Link href="/baralhos" className="text-xs font-semibold text-primary dark:text-cyan hover:underline">Ver todos →</Link>
            </div>
            <div className="space-y-2.5">
              {MOCK_BARALHOS.map((b, i) => {
                const pct = Math.round((b.revisados / b.total) * 100);
                return (
                  <Link key={b.id} href={`/baralhos/${b.id}`} className="block">
                    <div
                      className="
                        dash-stagger group relative overflow-hidden rounded-xl
                        border border-gray-200 dark:border-white/10
                        bg-white dark:bg-[#1a1a2e] p-3.5
                        hover:border-primary/30 dark:hover:border-cyan/30
                        hover:shadow-md transition-all duration-200
                      "
                      style={{ '--stagger': `${i * 100}ms` } as React.CSSProperties}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-cyan opacity-0 group-hover:opacity-40 transition-opacity duration-200"
                        style={{
                          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                          WebkitMaskComposite: 'xor',
                          maskComposite: 'exclude',
                          padding: '1px',
                        }}
                      />
                      <div className="relative flex items-center gap-3">
                        <div
                          className="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: b.cor }}
                        >
                          {b.nome.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{b.nome}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-white/50">{pct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dash-section" style={{ '--stagger': '200ms' } as React.CSSProperties}>
            <Card variante="highlighted">
              <div className="flex items-center justify-between mb-3">
                <Badge variante="nivel" ativo>
                  Nível 5
                </Badge>
                <Badge variante="xp">1.250 XP</Badge>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-white/45">
                  <span>Progresso para nível 6</span>
                  <span className="font-semibold tabular-nums">1.250 / 2.000</span>
                </div>
                <ProgressBar valor={65} variante="xp" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] p-2.5 text-center">
                  <p className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">156</p>
                  <p className="text-[11px] text-gray-500 dark:text-white/45">Cards dominados</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] p-2.5 text-center">
                  <p className="text-lg font-extrabold text-gray-900 dark:text-white tabular-nums">89%</p>
                  <p className="text-[11px] text-gray-500 dark:text-white/45">Taxa de acerto</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="dash-section" style={{ '--stagger': '300ms' } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">8 cards para revisar hoje</h2>
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-red-500/15 px-1.5 text-[11px] font-bold text-red-500 dark:text-red-400 tabular-nums">
                {MOCK_CARDS_PENDENTES.length}
              </span>
            </div>

            <div className="space-y-2">
              {MOCK_CARDS_PENDENTES.map((c, i) => {
                const cor: Record<string, string> = {
                  masculino: 'border-l-blue-400',
                  feminino: 'border-l-pink-400',
                  neutro: 'border-l-gray-300 dark:border-l-gray-600',
                };
                return (
                  <div
                    key={c.id}
                    className={`
                      dash-stagger flex items-center gap-3 rounded-lg border-l-[3px]
                      ${cor[c.genero]}
                      bg-gray-50 dark:bg-white/[0.04] px-3 py-2.5
                      hover:bg-gray-100 dark:hover:bg-white/[0.07]
                      transition-colors duration-150
                    `}
                    style={{ '--stagger': `${i * 80}ms` } as React.CSSProperties}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.frente}</p>
                      <p className="text-xs text-gray-500 dark:text-white/45 truncate">{c.baralho}</p>
                    </div>
                    <svg className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                );
              })}
            </div>

            <Link
              href="/estudar"
              className="
                mt-3 flex items-center justify-center gap-1.5 rounded-xl
                border border-primary/20 dark:border-cyan/20
                bg-primary/5 dark:bg-cyan/5
                px-4 py-2 text-sm font-semibold
                text-primary dark:text-cyan
                hover:bg-primary/10 dark:hover:bg-cyan/10
                transition-colors duration-150
              "
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Revisar todas
            </Link>
          </div>

          <div className="dash-section" style={{ '--stagger': '400ms' } as React.CSSProperties}>
            <Card variante="default">
              <div className="flex items-start gap-3">
                <div className="missao-icon flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-400/15 text-xl">
                  🎯
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Missão do dia</h3>
                    <Badge variante="xp">+30 XP</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-white/50 mb-3">Revisar 5 verbos irregulares</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-gray-500 dark:text-white/45 tabular-nums">
                      <span>Progresso</span>
                      <span>3 / 5</span>
                    </div>
                    <ProgressBar valor={60} variante="default" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
