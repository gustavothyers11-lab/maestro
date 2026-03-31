'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Aula, MaterialAula, CategoriaAula } from '@/types/index';

interface AulaComMateriais {
  aula: Aula;
  materiais: MaterialAula[];
}

const CATEGORIAS_AULA: CategoriaAula[] = ['geral', 'gramatica', 'vocabulario', 'conversacao', 'pronuncia'];

export default function MateriaisPageClient() {
  const [aulasComMateriais, setAulasComMateriais] = useState<AulaComMateriais[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroAula, setFiltroAula] = useState<string>('');
  const [mostraFormulario, setMostraFormulario] = useState(false);
  const [criandoAula, setCriandoAula] = useState(false);

  // Formulário de criação de aula
  const [novaAulaTitle, setNovaAulaTitle] = useState('');
  const [novaAulaCategoria, setNovaAulaCategoria] = useState<CategoriaAula>('geral');

  const carregarMateriais = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resAulas = await fetch('/api/aulas');
      if (!resAulas.ok) throw new Error('Erro ao carregar aulas');

      const data = await resAulas.json();
      const aulas: Aula[] = data.aulas || [];

      const result = aulas.map((aula) => ({
        aula,
        materiais: aula.materiais || [],
      }));

      setAulasComMateriais(result);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  }, []);

  const criarNovaAula = useCallback(async () => {
    const titulo = novaAulaTitle.trim();

    if (!titulo) {
      setError('Informe o título da aula');
      return;
    }

    setCriandoAula(true);
    setError(null);

    try {
      const res = await fetch('/api/aulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          categoria: novaAulaCategoria,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar aula');
      }

      setNovaAulaTitle('');
      setNovaAulaCategoria('geral');
      setMostraFormulario(false);
      setError(null);

      // Atualizar lista
      await carregarMateriais();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar aula');
    } finally {
      setCriandoAula(false);
    }
  }, [novaAulaTitle, novaAulaCategoria, carregarMateriais]);

  useEffect(() => {
    carregarMateriais();
  }, [carregarMateriais]);

  // Filtrar aulas
  const aulasFiltradasComMateriais = filtroAula
    ? aulasComMateriais.filter((item) =>
        item.aula.titulo.toLowerCase().includes(filtroAula.toLowerCase())
      )
    : aulasComMateriais;

  // Contar total de materiais
  const totalMateriais = aulasComMateriais.reduce(
    (sum, item) => sum + item.materiais.length,
    0
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Carregando materiais...
          </h1>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-gradient-to-r from-gray-200 to-gray-100 dark:from-white/[0.05] dark:to-white/[0.02] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Materiais
          </h1>
          <p className="text-sm text-gray-500 dark:text-white/50">
            {totalMateriais} material{totalMateriais !== 1 ? 'is' : ''} em{' '}
            {aulasComMateriais.length} aula{aulasComMateriais.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostraFormulario(!mostraFormulario)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-cyan px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-lg"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {mostraFormulario ? 'Cancelar' : 'Nova aula'}
        </button>
      </div>

      {/* Formulário de criação */}
      {mostraFormulario && (
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-gradient-to-br from-gray-50 to-white dark:from-white/[0.05] dark:to-white/[0.02] p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/80 block mb-2">
              Título da aula
            </label>
            <input
              type="text"
              placeholder="Ex: Verbos irregulares"
              value={novaAulaTitle}
              onChange={(e) => setNovaAulaTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-white/80 block mb-2">
              Categoria
            </label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CATEGORIAS_AULA.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNovaAulaCategoria(cat)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                    novaAulaCategoria === cat
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300 dark:bg-white/10 dark:text-white/60 dark:border-white/10'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {error && mostraFormulario && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={criarNovaAula}
              disabled={criandoAula || !novaAulaTitle.trim()}
              className="flex-1 rounded-lg bg-gradient-to-r from-primary to-cyan px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {criandoAula ? 'Criando...' : 'Criar aula'}
            </button>
            <button
              type="button"
              onClick={() => setMostraFormulario(false)}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtro */}
      {aulasComMateriais.length > 0 && !mostraFormulario && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filtrar por aula..."
            value={filtroAula}
            onChange={(e) => setFiltroAula(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.05] px-4 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {filtroAula && (
            <button
              onClick={() => setFiltroAula('')}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-white/50 dark:hover:text-white transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* Lista de materiais */}
      {error && !mostraFormulario && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {aulasFiltradasComMateriais.length === 0 && !mostraFormulario ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/[0.1] p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-white/20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.66V18.75a2.25 2.25 0 002.25 2.25H18a2.25 2.25 0 002.25-2.25V6.75a48.554 48.554 0 00-3-8.75m0 0V4.5M3 15a48.694 48.694 0 0115.838-.856"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            {aulasComMateriais.length === 0 ? 'Nenhuma aula encontrada' : 'Nenhuma aula encontrada para este filtro'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            {aulasComMateriais.length === 0
              ? 'Crie sua primeira aula para começar a anexar materiais'
              : 'Tente outro termo de busca'}
          </p>
          <button
            onClick={() => setMostraFormulario(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary/10 dark:bg-primary/15 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 dark:hover:bg-primary/25"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Criar primeira aula
          </button>
        </div>
      ) : (
        !mostraFormulario && (
          <div className="space-y-4">
            {aulasFiltradasComMateriais.map((item) => (
              <MaterialesAulaCard key={item.aula.id} item={item} onExcluir={carregarMateriais} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Componente para exibir os materiais de uma aula
interface MaterialesAulaCardProps {
  item: AulaComMateriais;
  onExcluir: () => void;
}

function MaterialesAulaCard({ item, onExcluir }: MaterialesAulaCardProps) {
  const { aula, materiais } = item;
  const [excluindo, setExcluindo] = useState(false);

  async function handleExcluir() {
    if (!confirm(`Excluir a aula "${aula.titulo}"? Isso não pode ser desfeito.`)) return;

    setExcluindo(true);
    try {
      const res = await fetch(`/api/aulas?id=${aula.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir aula');
        return;
      }
      onExcluir();
    } catch {
      alert('Erro ao excluir aula');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] transition-all hover:shadow-md dark:hover:shadow-lg hover:border-gray-300 dark:hover:border-white/[0.15]">
      {/* Header com título da aula */}
      <div className="border-b border-gray-100 dark:border-white/[0.05] bg-gradient-to-r from-gray-50 to-white dark:from-white/[0.05] dark:to-white/[0.02] px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white break-words">
                {aula.titulo}
              </h3>
              {aula.categoria && (
                <span className="inline-flex items-center rounded-lg bg-primary/10 dark:bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                  {aula.categoria}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-white/50">
              {materiais.length} material{materiais.length !== 1 ? 'is' : ''}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-start sm:flex-shrink-0">
            <Link
              href={`/dashboard/aulas/${aula.id}?tab=materiais`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-primary dark:hover:text-cyan hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19l-7-7 7-7m8 14l-8-8"
                />
              </svg>
              Gerenciar anexos
            </Link>
            <button
              type="button"
              onClick={handleExcluir}
              disabled={excluindo}
              title="Excluir aula"
              className="inline-flex items-center justify-center rounded-lg p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {excluindo ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de materiais */}
      {materiais.length === 0 ? (
        <div className="px-6 py-4 text-sm text-gray-500 dark:text-white/50">
          Esta aula ainda não possui materiais. Clique em "Gerenciar anexos" para adicionar.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
          {materiais.map((material) => (
            <MaterialItem key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}

// Componente para exibir um material individual
interface MaterialItemProps {
  material: MaterialAula;
}

function MaterialItem({ material }: MaterialItemProps) {
  const isUrl = material.url?.startsWith('http');
  const isPdf = material.url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block">
            {getPdfIcon(material.tipo)}
          </span>
          <h4 className="font-medium text-gray-900 dark:text-white truncate">
            {material.titulo}
          </h4>
        </div>
        {material.observacao && (
          <p className="text-sm text-gray-500 dark:text-white/50 truncate">
            {material.observacao}
          </p>
        )}
        <p className="text-xs text-gray-400 dark:text-white/30 mt-1">
          Tipo: <span className="font-medium">{material.tipo || 'Arquivo'}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isUrl && (
          <>
            {isPdf ? (
              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 dark:bg-primary/15 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 dark:hover:bg-primary/25 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Baixar PDF
              </a>
            ) : (
              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-white/[0.08] px-3 py-2 text-xs font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Abrir
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Helper para retornar o ícone correto baseado no tipo
function getPdfIcon(tipo?: string): React.ReactNode {
  switch (tipo?.toLowerCase()) {
    case 'pdf':
      return (
        <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391h2.786v.406h-2.41v2.805h2.27v.406h-2.27v3.779h.941v.405h-3.317V21h.001zm-2.14 0V13.609h2.787v.406h-2.411v8.985h-.376zm-2.555 0h-.405v-5.736h-.635V13.609h1.71v7.391zm-2.414-5.852h-.406V21h-.376v-5.852H5.444V13.609h3.632v.538z" />
        </svg>
      );
    case 'imagem':
    case 'image':
      return (
        <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case 'vídeo':
    case 'video':
      return (
        <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'áudio':
    case 'audio':
      return (
        <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}
