// Layout do dashboard — sidebar + área de conteúdo

import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-[#ffffff] dark:bg-[#0f0f1a] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <Sidebar />
      <main className="lg:ml-[240px] min-h-screen pb-16 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
