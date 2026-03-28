'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex items-center justify-center bg-[#0f0f1a] text-white">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Algo deu errado</h2>
          <p className="text-white/60 text-sm">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
