import ManagerHeader from '@/components/ManagerHeader';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ManagerHeader />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </>
  );
}
