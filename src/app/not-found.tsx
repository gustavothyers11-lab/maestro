import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-extrabold text-gray-200 dark:text-white/10">
          404
        </h1>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Página não encontrada
        </h2>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
