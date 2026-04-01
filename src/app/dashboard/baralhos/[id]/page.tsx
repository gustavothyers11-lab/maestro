// Página de detalhe do baralho — visualiza cards, busca, edita, deleta
// /dashboard/baralhos/[id]

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCards } from '@/hooks/useCards';
import type { Baralho, Card, Genero } from '@/types';
import Modal from '@/components/ui/Modal';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const INTERVALO_DOMINADO = 21;
const REPETICOES_DOMINADO = 5;

const GENERO_CONFIG: Record<Genero, { label: string; cor: string; bg: string }> = {
  masculino: { label: 'Masc.', cor: 'text-blue-500', bg: 'bg-blue-500/10 dark:bg-blue-400/15' },
  feminino:  { label: 'Fem.',  cor: 'text-pink-500', bg: 'bg-pink-500/10 dark:bg-pink-400/15' },
  neutro:    { label: 'Neutro',cor: 'text-gray-400', bg: 'bg-gray-500/10 dark:bg-white/[0.06]' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusCard(c: Card): 'dominado' | 'aprendendo' | 'novo' {
  if (c.intervalo >= INTERVALO_DOMINADO && c.repeticoes >= REPETICOES_DOMINADO) return 'dominado';
  if (c.repeticoes > 0) return 'aprendendo';
  return 'novo';
}

const STATUS_CONFIG = {
  dominado:   { label: 'Dominado',   cor: 'text-emerald-500', bg: 'bg-emerald-500/10 dark:bg-emerald-400/15', dot: 'bg-emerald-500' },
  aprendendo: { label: 'Aprendendo', cor: 'text-amber-500',   bg: 'bg-amber-500/10 dark:bg-amber-400/15',     dot: 'bg-amber-500' },
  novo:       { label: 'Novo',       cor: 'text-blue-400',    bg: 'bg-blue-500/10 dark:bg-blue-400/15',        dot: 'bg-blue-400' },
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  const agora = new Date();
  const diff = d.getTime() - agora.getTime();
  const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  return `Em ${dias} dias`;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CardSkeleton({ index }: { index: number }) {
  return (
    <div
      className="bdCard-stagger rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 animate-pulse"
      style={{ '--bdCard-delay': `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2 flex-1">
          <div className="h-5 w-3/4 rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-gray-100 dark:bg-white/[0.06]" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-white/10" />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-6 w-14 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
        <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente — Card individual do grid
// ---------------------------------------------------------------------------

interface CardItemProps {
  card: Card;
  index: number;
  onEditar: (c: Card) => void;
  onDeletar: (c: Card) => void;
  onMover: (c: Card) => void;
}

function CardItem({ card, index, onEditar, onDeletar, onMover }: CardItemProps) {
  const status = statusCard(card);
  const cfg = STATUS_CONFIG[status];
  const genCfg = GENERO_CONFIG[card.genero];

  return (
    <div
      className="bdCard-stagger group relative rounded-2xl border border-gray-200/60 dark:border-white/[0.06] bg-white dark:bg-[#1a1a35] p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 hover:border-gray-300/80 dark:hover:border-white/[0.12] cursor-default"
      style={{ '--bdCard-delay': `${index * 60}ms` } as React.CSSProperties}
    >
      {/* Glow no hover */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-br from-[var(--bdCard-cor)]/5 to-transparent" />

      {/* Conteúdo */}
      <div className="relative z-10">
        {/* Frente + verso */}
        <div className="mb-3">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white leading-snug">
            {card.frente}
          </p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {card.verso}
          </p>
        </div>

        {/* Notas (se houver) */}
        {card.notas && (
          <p className="text-[11.5px] text-gray-400 dark:text-gray-500 italic mb-3 line-clamp-1">
            &quot;{card.notas}&quot;
          </p>
        )}

        {/* Badges: gênero + status + revisão */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${genCfg.bg} ${genCfg.cor}`}>
            {genCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.cor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400">
            🕐 {formatarData(card.proximoRevisao)}
          </span>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onEditar(card)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </button>
          <button
            onClick={() => onMover(card)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Mover
          </button>
          <button
            onClick={() => onDeletar(card)}
            className="inline-flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado vazio
// ---------------------------------------------------------------------------

function EstadoVazio({ nomeBaralho }: { nomeBaralho: string }) {
  const router = useRouter();

  return (
    <div className="bdEmpty-in flex flex-col items-center justify-center py-20 text-center">
      {/* Illustration */}
      <div className="bdEmpty-icon relative w-24 h-24 mb-6">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-white/[0.06] dark:to-white/[0.02] rotate-6 transition-transform" />
        <div className="absolute inset-0 rounded-2xl bg-white dark:bg-[#1a1a35] border border-gray-200/60 dark:border-white/[0.08] flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        Nenhum card em &quot;{nomeBaralho}&quot;
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
        Vá até as <strong>Aulas</strong> para gerar cards automaticamente ou crie manualmente.
      </p>

      <button
        onClick={() => router.push('/dashboard/aulas')}
        className="bdEmpty-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1260CC] text-white text-sm font-semibold shadow-lg shadow-[#1260CC]/25 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        Ir para Aulas
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal Editar Card
// ---------------------------------------------------------------------------

interface ModalEditarProps {
  card: Card | null;
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (id: string, dados: { frente: string; verso: string; genero: Genero; notas: string }) => Promise<void>;
  salvando: boolean;
}

function ModalEditar({ card, aberto, onFechar, onSalvar, salvando }: ModalEditarProps) {
  const [frente, setFrente] = useState('');
  const [verso, setVerso] = useState('');
  const [genero, setGenero] = useState<Genero>('neutro');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (card) {
      setFrente(card.frente);
      setVerso(card.verso);
      setGenero(card.genero);
      setNotas(card.notas ?? '');
    }
  }, [card]);

  const handleSalvar = async () => {
    if (!card || frente.trim().length === 0 || verso.trim().length === 0) return;
    await onSalvar(card.id, { frente: frente.trim(), verso: verso.trim(), genero, notas: notas.trim() });
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Editar Card">
      <div className="space-y-4">
        {/* Frente */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Frente (Idioma)
          </label>
          <input
            type="text"
            value={frente}
            onChange={(e) => setFrente(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow"
            placeholder="Palabra en español..."
          />
        </div>

        {/* Verso */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Verso (Português)
          </label>
          <input
            type="text"
            value={verso}
            onChange={(e) => setVerso(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow"
            placeholder="Tradução em português..."
          />
        </div>

        {/* Gênero */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Gênero
          </label>
          <div className="flex gap-2">
            {(['masculino', 'feminino', 'neutro'] as Genero[]).map((g) => (
              <button
                key={g}
                onClick={() => setGenero(g)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 ${
                  genero === g
                    ? g === 'masculino'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:bg-blue-400/15 dark:border-blue-400/30 dark:text-blue-400'
                      : g === 'feminino'
                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-500 dark:bg-pink-400/15 dark:border-pink-400/30 dark:text-pink-400'
                      : 'bg-gray-200/60 border-gray-300/60 text-gray-600 dark:bg-white/[0.08] dark:border-white/[0.12] dark:text-gray-300'
                    : 'bg-transparent border-gray-200 dark:border-white/[0.06] text-gray-400 hover:border-gray-300 dark:hover:border-white/[0.12]'
                }`}
              >
                {GENERO_CONFIG[g].label}
              </button>
            ))}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow resize-none"
            placeholder="Exemplo de uso, dica de memorização..."
          />
        </div>

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || frente.trim().length === 0 || verso.trim().length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1260CC] text-white text-sm font-semibold shadow-lg shadow-[#1260CC]/25 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ModalNovoCardProps {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: { frente: string; verso: string; genero: Genero; notas: string }) => Promise<void>;
  salvando: boolean;
  erro?: string | null;
}

function ModalNovoCard({ aberto, onFechar, onCriar, salvando, erro }: ModalNovoCardProps) {
  const [frente, setFrente] = useState('');
  const [verso, setVerso] = useState('');
  const [genero, setGenero] = useState<Genero>('neutro');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setFrente('');
    setVerso('');
    setGenero('neutro');
    setNotas('');
  }, [aberto]);

  const handleCriar = async () => {
    if (frente.trim().length === 0 || verso.trim().length === 0) return;
    await onCriar({ frente: frente.trim(), verso: verso.trim(), genero, notas: notas.trim() });
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Novo Card">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Frente (idioma de estudo)
          </label>
          <input
            type="text"
            value={frente}
            onChange={(e) => setFrente(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow"
            placeholder="Palavra ou frase..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Verso (português)
          </label>
          <input
            type="text"
            value={verso}
            onChange={(e) => setVerso(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow"
            placeholder="Tradução em português..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Gênero
          </label>
          <div className="flex gap-2">
            {(['masculino', 'feminino', 'neutro'] as Genero[]).map((g) => (
              <button
                key={g}
                onClick={() => setGenero(g)}
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 ${
                  genero === g
                    ? g === 'masculino'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 dark:bg-blue-400/15 dark:border-blue-400/30 dark:text-blue-400'
                      : g === 'feminino'
                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-500 dark:bg-pink-400/15 dark:border-pink-400/30 dark:text-pink-400'
                      : 'bg-gray-200/60 border-gray-300/60 text-gray-600 dark:bg-white/[0.08] dark:border-white/[0.12] dark:text-gray-300'
                    : 'bg-transparent border-gray-200 dark:border-white/[0.06] text-gray-400 hover:border-gray-300 dark:hover:border-white/[0.12]'
                }`}
              >
                {GENERO_CONFIG[g].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Notas (opcional)
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow resize-none"
            placeholder="Exemplo de uso ou dica..."
          />
        </div>

        {erro && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {erro}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCriar}
            disabled={salvando || frente.trim().length === 0 || verso.trim().length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1260CC] text-white text-sm font-semibold shadow-lg shadow-[#1260CC]/25 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {salvando ? 'Criando…' : 'Criar card'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal Confirmar Exclusão
// ---------------------------------------------------------------------------

interface ModalDeletarProps {
  card: Card | null;
  aberto: boolean;
  onFechar: () => void;
  onConfirmar: (id: string) => Promise<void>;
  deletando: boolean;
}

function ModalDeletar({ card, aberto, onFechar, onConfirmar, deletando }: ModalDeletarProps) {
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Excluir Card">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Tem certeza que deseja excluir o card <strong className="text-gray-900 dark:text-white">&quot;{card?.frente}&quot;</strong>?
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Essa ação não pode ser desfeita. Todo o histórico de revisões deste card será perdido.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => card && onConfirmar(card.id)}
            disabled={deletando}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {deletando ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal Editar Baralho (renomear)
// ---------------------------------------------------------------------------

interface ModalEditarBaralhoProps {
  baralho: Baralho | null;
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (nome: string) => Promise<void>;
  salvando: boolean;
}

function ModalEditarBaralho({ baralho, aberto, onFechar, onSalvar, salvando }: ModalEditarBaralhoProps) {
  const [nome, setNome] = useState('');

  useEffect(() => {
    if (baralho && aberto) setNome(baralho.nome);
  }, [baralho, aberto]);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Editar Baralho">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Nome do baralho
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 transition-shadow"
            placeholder="Nome do baralho..."
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => nome.trim() && onSalvar(nome.trim())}
            disabled={salvando || nome.trim().length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1260CC] text-white text-sm font-semibold shadow-lg shadow-[#1260CC]/25 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modal Mover Card(s) para outro baralho
// ---------------------------------------------------------------------------

interface ModalMoverCardProps {
  card: Card | null;
  aberto: boolean;
  baralhos: Baralho[];
  baralhoAtualId: string;
  onFechar: () => void;
  onMover: (cardId: string, novoBaralhoId: string) => Promise<void>;
  movendo: boolean;
}

function ModalMoverCard({ card, aberto, baralhos, baralhoAtualId, onFechar, onMover, movendo }: ModalMoverCardProps) {
  const [destino, setDestino] = useState('');
  const outrosBaralhos = baralhos.filter((b) => b.id !== baralhoAtualId);

  useEffect(() => {
    if (aberto) setDestino('');
  }, [aberto]);

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Mover Card">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Mover <strong className="text-gray-900 dark:text-white">&quot;{card?.frente}&quot;</strong> para:
        </p>

        {outrosBaralhos.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            Você não tem outros baralhos. Crie um novo baralho primeiro.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {outrosBaralhos.map((b) => (
              <button
                key={b.id}
                onClick={() => setDestino(b.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                  destino === b.id
                    ? 'border-[#1260CC]/50 bg-[#1260CC]/10 text-[#1260CC] dark:bg-[#1260CC]/20 dark:text-blue-300'
                    : 'border-gray-200 dark:border-white/[0.06] text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/[0.12] hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: b.cor }}
                  />
                  {b.nome}
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {b.totalCards} cards
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onFechar}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => card && destino && onMover(card.id, destino)}
            disabled={movendo || !destino}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1260CC] text-white text-sm font-semibold shadow-lg shadow-[#1260CC]/25 hover:shadow-xl hover:shadow-[#1260CC]/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {movendo ? 'Movendo…' : 'Mover'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function BaralhoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const baralhoId = params.id as string;

  // Estado do baralho (metadados)
  const [baralho, setBaralho] = useState<Baralho | null>(null);
  const [loadingBaralho, setLoadingBaralho] = useState(true);

  // Cards via hook (filtra por baralho)
  const { cards, loading: loadingCards, estatisticas, deletarCard, salvarCards, recarregar } = useCards({ baralhoId });

  // Busca local
  const [busca, setBusca] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);

  // Modais
  const [cardEditando, setCardEditando] = useState<Card | null>(null);
  const [cardDeletando, setCardDeletando] = useState<Card | null>(null);
  const [cardMovendo, setCardMovendo] = useState<Card | null>(null);
  const [novoCardAberto, setNovoCardAberto] = useState(false);
  const [editarBaralhoAberto, setEditarBaralhoAberto] = useState(false);
  const [salvandoNovoCard, setSalvandoNovoCard] = useState(false);
  const [erroNovoCard, setErroNovoCard] = useState<string | null>(null);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [salvandoBaralho, setSalvandoBaralho] = useState(false);
  const [movendoCard, setMovendoCard] = useState(false);
  const [deletandoCard, setDeletandoCard] = useState(false);
  const [todosBaralhos, setTodosBaralhos] = useState<Baralho[]>([]);

  // ── Buscar baralho ───────────────────────────────────────────────────
  useEffect(() => {
    if (!baralhoId) return;
    setLoadingBaralho(true);

    fetch('/api/baralhos')
      .then((r) => r.json())
      .then((data) => {
        const todos = data.baralhos ?? [];
        setTodosBaralhos(todos);
        const found = todos.find((b: Baralho) => b.id === baralhoId);
        setBaralho(found ?? null);
      })
      .catch(() => setBaralho(null))
      .finally(() => setLoadingBaralho(false));
  }, [baralhoId]);

  // ── Cards filtrados por busca ────────────────────────────────────────
  const cardsFiltrados = useMemo(() => {
    if (!busca.trim()) return cards;
    const t = busca.toLowerCase().trim();
    return cards.filter(
      (c) =>
        c.frente.toLowerCase().includes(t) ||
        c.verso.toLowerCase().includes(t) ||
        (c.notas?.toLowerCase().includes(t) ?? false),
    );
  }, [cards, busca]);

  // ── Stats derivadas ──────────────────────────────────────────────────
  const vencidosHoje = useMemo(
    () => cards.filter((c) => new Date(c.proximoRevisao) <= new Date()).length,
    [cards],
  );

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleEditar = useCallback(async (id: string, dados: { frente: string; verso: string; genero: Genero; notas: string }) => {
    setSalvandoEdit(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...dados }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setCardEditando(null);
      await recarregar();
    } catch {
      // silently fail — poderia mostrar toast
    } finally {
      setSalvandoEdit(false);
    }
  }, [recarregar]);

  const handleDeletar = useCallback(async (id: string) => {
    setDeletandoCard(true);
    try {
      await deletarCard(id);
      setCardDeletando(null);
    } catch {
      // silently fail
    } finally {
      setDeletandoCard(false);
    }
  }, [deletarCard]);

  const handleCriarCard = useCallback(async (dados: { frente: string; verso: string; genero: Genero; notas: string }) => {
    setSalvandoNovoCard(true);
    setErroNovoCard(null);
    try {
      await salvarCards([
        {
          frente: dados.frente,
          verso: dados.verso,
          genero: dados.genero,
          notas: dados.notas || null,
          audioUrl: null,
          baralhoId,
          aulaId: null,
        },
      ]);
      setNovoCardAberto(false);
      await recarregar();
    } catch (e) {
      setErroNovoCard(e instanceof Error ? e.message : 'Erro ao criar card.');
    } finally {
      setSalvandoNovoCard(false);
    }
  }, [baralhoId, recarregar, salvarCards]);

  const handleRenomearBaralho = useCallback(async (novoNome: string) => {
    setSalvandoBaralho(true);
    try {
      const res = await fetch('/api/baralhos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: baralhoId, nome: novoNome }),
      });
      if (!res.ok) throw new Error('Falha ao renomear');
      const data = await res.json();
      setBaralho(data.baralho);
      setEditarBaralhoAberto(false);
    } catch {
      // silently fail
    } finally {
      setSalvandoBaralho(false);
    }
  }, [baralhoId]);

  const handleMoverCard = useCallback(async (cardId: string, novoBaralhoId: string) => {
    setMovendoCard(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, baralhoId: novoBaralhoId }),
      });
      if (!res.ok) throw new Error('Falha ao mover');
      setCardMovendo(null);
      await recarregar();
    } catch {
      // silently fail
    } finally {
      setMovendoCard(false);
    }
  }, [recarregar]);

  // ── Loading state ────────────────────────────────────────────────────
  const isLoading = loadingBaralho || loadingCards;

  // ── Cor do baralho para o CSS ────────────────────────────────────────
  const cor = baralho?.cor ?? '#1260CC';

  return (
    <div
      className="bdPage-in min-h-screen px-4 sm:px-6 lg:px-8 py-6 pb-20"
      style={{ '--bdCard-cor': cor } as React.CSSProperties}
    >
      <div className="max-w-5xl mx-auto">

        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="bdHeader-in mb-8">
          {/* Voltar */}
          <button
            onClick={() => router.push('/dashboard/baralhos')}
            className="bdBack-btn group inline-flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.06] group-hover:bg-gray-200 dark:group-hover:bg-white/[0.12] transition-all duration-200 group-hover:-translate-x-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </span>
            Voltar aos baralhos
          </button>

          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-8 w-64 rounded-xl bg-gray-200 dark:bg-white/10" />
              <div className="h-4 w-32 rounded-lg bg-gray-100 dark:bg-white/[0.06]" />
            </div>
          ) : baralho ? (
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Ícone colorido */}
                <div
                  className="bdHeader-icon flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${cor}, ${cor}cc)`,
                    boxShadow: `0 8px 24px ${cor}33`,
                  }}
                >
                  <span className="drop-shadow-sm">🃏</span>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {baralho.nome}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: cor }}
                    />
                    {baralho.tema}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditarBaralhoAberto(true)}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.06] text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.10] transition-colors"
                  title="Editar baralho"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setErroNovoCard(null);
                    setNovoCardAberto(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.06] text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/[0.10] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Novo card
                </button>

                <button
                  onClick={() => router.push(`/dashboard/estudar?baralho=${baralhoId}`)}
                  className="bdStudy-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${cor}, ${cor}dd)`,
                    boxShadow: `0 8px 24px ${cor}40`,
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Estudar este baralho
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">Baralho não encontrado.</p>
              <button
                onClick={() => router.push('/dashboard/baralhos')}
                className="mt-4 text-sm font-medium text-[#1260CC] hover:underline"
              >
                Voltar aos baralhos
              </button>
            </div>
          )}
        </div>

        {/* ─── Estatísticas ──────────────────────────────────────── */}
        {!isLoading && baralho && (
          <div className="bdStats-in grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Total de cards', valor: estatisticas.total, icone: '📇', corBg: 'from-blue-500/10 to-blue-600/5 dark:from-blue-400/15 dark:to-blue-500/5' },
              { label: 'Dominados', valor: estatisticas.dominados, icone: '🏆', corBg: 'from-emerald-500/10 to-emerald-600/5 dark:from-emerald-400/15 dark:to-emerald-500/5' },
              { label: 'Vencidos hoje', valor: vencidosHoje, icone: '🔥', corBg: 'from-amber-500/10 to-amber-600/5 dark:from-amber-400/15 dark:to-amber-500/5' },
              { label: 'Novos', valor: cards.filter((c) => c.repeticoes === 0).length, icone: '✨', corBg: 'from-purple-500/10 to-purple-600/5 dark:from-purple-400/15 dark:to-purple-500/5' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`bdStat-stagger rounded-2xl p-4 bg-gradient-to-br ${stat.corBg} border border-gray-200/60 dark:border-white/[0.06]`}
                style={{ '--bdStat-delay': `${i * 80}ms` } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base leading-none">{stat.icone}</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">{stat.valor}</span>
                </div>
                <p className="text-[11.5px] font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ─── Busca ─────────────────────────────────────────────── */}
        {!isLoading && baralho && cards.length > 0 && (
          <div className="bdSearch-in mb-6">
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={buscaRef}
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar cards por texto…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1a35] text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1260CC]/40 focus:border-transparent transition-all duration-200"
              />
              {busca && (
                <button
                  onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {busca && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 ml-1">
                {cardsFiltrados.length} {cardsFiltrados.length === 1 ? 'resultado' : 'resultados'} para &quot;{busca}&quot;
              </p>
            )}
          </div>
        )}

        {/* ─── Grid de cards ─────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} index={i} />
            ))}
          </div>
        ) : !baralho ? null : cards.length === 0 ? (
          <EstadoVazio nomeBaralho={baralho.nome} />
        ) : cardsFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum card encontrado para &quot;{busca}&quot;</p>
            <button
              onClick={() => setBusca('')}
              className="mt-3 text-sm font-medium text-[#1260CC] hover:underline"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cardsFiltrados.map((card, i) => (
              <CardItem
                key={card.id}
                card={card}
                index={i}
                onEditar={setCardEditando}
                onDeletar={setCardDeletando}
                onMover={setCardMovendo}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Modais ────────────────────────────────────────────── */}
      <ModalEditar
        card={cardEditando}
        aberto={!!cardEditando}
        onFechar={() => setCardEditando(null)}
        onSalvar={handleEditar}
        salvando={salvandoEdit}
      />
      <ModalNovoCard
        aberto={novoCardAberto}
        onFechar={() => {
          if (salvandoNovoCard) return;
          setNovoCardAberto(false);
          setErroNovoCard(null);
        }}
        onCriar={handleCriarCard}
        salvando={salvandoNovoCard}
        erro={erroNovoCard}
      />
      <ModalDeletar
        card={cardDeletando}
        aberto={!!cardDeletando}
        onFechar={() => setCardDeletando(null)}
        onConfirmar={handleDeletar}
        deletando={deletandoCard}
      />
      <ModalEditarBaralho
        baralho={baralho}
        aberto={editarBaralhoAberto}
        onFechar={() => setEditarBaralhoAberto(false)}
        onSalvar={handleRenomearBaralho}
        salvando={salvandoBaralho}
      />
      <ModalMoverCard
        card={cardMovendo}
        aberto={!!cardMovendo}
        baralhos={todosBaralhos}
        baralhoAtualId={baralhoId}
        onFechar={() => setCardMovendo(null)}
        onMover={handleMoverCard}
        movendo={movendoCard}
      />
    </div>
  );
}
