'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Aula, MaterialAula } from '@/types/index';

interface AulaComMateriais {
  aula: Aula;
  materiais: MaterialAula[];
}

export default function MateriaisPageClient() {
  const [aulasComMateriais, setAulasComMateriais] = useState<AulaComMateriais[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroAula, setFiltroAula] = useState<string>('');

  const carregarMateriais = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const resAulas = await fetch('/api/aulas');
      if (!resAulas.ok) throw new Error('Erro ao carregar aulas');

      const { aulas }: { aulas: Aula[] } = await resAulas.json();

      // Filtrar apenas aulas que têm materiais
      const result = aulas
        .map((aula) => ({
          aula,
          materiais: aula.materiais || [],
        }))
        .filter((item) => item.materiais.length > 0);

      setAulasComMateriais(result);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  }, []);

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
      </div>

      {/* Filtro */}
      {aulasComMateriais.length > 0 && (
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
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      {aulasFiltradasComMateriais.length === 0 ? (
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
            Nenhum material encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            {filtroAula
              ? 'Tente outro termo de busca'
              : 'Adicione materiais às suas aulas para vê-los aqui'}
          </p>
          <Link
            href="/dashboard/aulas"
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
            Criar aula com materiais
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {aulasFiltradasComMateriais.map((item) => (
            <MaterialesAulaCard key={item.aula.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// Componente para exibir os materiais de uma aula
interface MaterialesAulaCardProps {
  item: AulaComMateriais;
}

function MaterialesAulaCard({ item }: MaterialesAulaCardProps) {
  const { aula, materiais } = item;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] transition-all hover:shadow-md dark:hover:shadow-lg hover:border-gray-300 dark:hover:border-white/[0.15]">
      {/* Header com título da aula */}
      <div className="border-b border-gray-100 dark:border-white/[0.05] bg-gradient-to-r from-gray-50 to-white dark:from-white/[0.05] dark:to-white/[0.02] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
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
          <Link
            href={`/dashboard/aulas/${aula.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 dark:text-white/60 hover:text-primary dark:hover:text-cyan hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors flex-shrink-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19l-7-7 7-7m8 14l-8-8"
              />
            </svg>
            Ver aula
          </Link>
        </div>
      </div>

      {/* Lista de materiais */}
      <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
        {materiais.map((material) => (
          <MaterialItem key={material.id} material={material} />
        ))}
      </div>
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
