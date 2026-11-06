import FindLostDogForm from '@/components/recognition/FindLostDogForm';

export const dynamic = 'force-dynamic';

export default function FindLostDogPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <FindLostDogForm />
    </main>
  );
}
