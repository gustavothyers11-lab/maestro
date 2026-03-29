// Layout do dashboard — sidebar + top bar mobile + área de conteúdo

import Sidebar from '@/components/dashboard/Sidebar';
import MobileTopBar from '@/components/dashboard/MobileTopBar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-[#ffffff] dark:bg-[#0f0f1a] text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Top bar visível apenas no mobile */}
      <MobileTopBar />
      <Sidebar />
      {/* pt-14 no mobile para compensar o top bar fixo de 56px */}
      <main className="lg:ml-[240px] min-h-screen pb-16 lg:pb-0 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
