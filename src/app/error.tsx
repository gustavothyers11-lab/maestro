'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Chunk fail após deploy → reload automático (1x)
    const isChunkError =
      error.message?.includes('Loading chunk') ||
      error.message?.includes('ChunkLoadError') ||
      error.message?.includes('Failed to fetch dynamically imported module');

    if (isChunkError && !sessionStorage.getItem('maestro_chunk_reload')) {
      sessionStorage.setItem('maestro_chunk_reload', '1');
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Algo deu errado
        </h2>
        <p className="text-gray-500 dark:text-white/60 text-sm">
          {error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}
