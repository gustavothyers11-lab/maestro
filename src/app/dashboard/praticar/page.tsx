// Hub de práticas — seleção dos 3 modos disponíveis

'use client';

import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

const MODOS = [
  {
    emoji: '💬',
    titulo: 'Conversa',
    descricao: 'Ouça o dialogo entre 2 pessoas e digite cada fala no idioma de estudo',
    dificuldade: 'Intermediário',
    badgeClass: 'border-cyan-500/40 bg-cyan-500/20 text-cyan-300',
    href: '/dashboard/praticar/conversa',
    iconGlow: 'shadow-cyan-500/30',
  },
  {
    emoji: '🎧',
    titulo: 'Ditado',
    descricao: 'Ouça frases no idioma de estudo e escreva o que entendeu',
    dificuldade: 'Intermediário',
    badgeClass: 'border-orange-500/40 bg-orange-500/20 text-orange-300',
    href: '/dashboard/praticar/ditado',
    iconGlow: 'shadow-orange-500/30',
  },
  {
    emoji: '✍️',
    titulo: 'Redação',
    descricao: 'Receba um tema e escreva no idioma de estudo. A IA corrige seu texto',
    dificuldade: 'Avançado',
    badgeClass: 'border-red-500/40 bg-red-500/20 text-red-300',
    href: '/dashboard/praticar/redacao',
    iconGlow: 'shadow-red-500/30',
  },
  {
    emoji: '📔',
    titulo: 'Diário',
    descricao: 'Escreva livremente no idioma de estudo. A IA corrige depois sem interromper',
    dificuldade: 'Todos os níveis',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
    href: '/dashboard/praticar/diario',
    iconGlow: 'shadow-emerald-500/30',
  },
] as const;

export default function PraticarPage() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-[#0f0f1a] px-4 py-10 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute top-10 left-1/4 h-72 w-72 rounded-full bg-[#1260CC]/15 blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-14 right-1/4 h-80 w-80 rounded-full bg-[#0ABFDE]/12 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Hub de Práticas
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/55 sm:text-base">
            Escolha um modo e pratique com foco em escuta, escrita guiada e escrita livre.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {MODOS.map((modo, idx) => (
            <article
              key={modo.titulo}
              className="prat-stagger group relative overflow-hidden rounded-2xl border border-white/10 bg-[#16162a]/85 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_55px_-28px_rgba(10,191,222,0.55)]"
              style={{
                '--prat-delay': `${(idx + 1) * 100}ms`,
              } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl p-[1.5px]"
                style={{
                  background: 'linear-gradient(135deg, rgba(18,96,204,0.95), rgba(10,191,222,0.95))',
                  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(10,191,222,0.18), transparent 55%)',
                }}
              />

              <div className="relative z-10 flex h-full flex-col">
                <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/8 text-4xl shadow-lg transition-transform duration-300 group-hover:scale-110 ${modo.iconGlow}`}>
                  {modo.emoji}
                </div>

                <h2 className="text-xl font-bold text-white">{modo.titulo}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/65">{modo.descricao}</p>

                <span className={`mt-4 inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${modo.badgeClass}`}>
                  {modo.dificuldade}
                </span>

                <button
                  type="button"
                  onClick={() => router.push(modo.href)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#1260CC] to-[#0ABFDE] px-5 py-3 text-sm font-bold text-white transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                >
                  Praticar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
