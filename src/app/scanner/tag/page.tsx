import DogQrScanner from '@/components/scanner/DogQrScanner';

export const metadata = {
  title: 'Scan Dog Tag | Buddies',
  description: 'Use a Buddies QR tag as a secondary dog identity check.',
};

export default function TagScannerPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <DogQrScanner />
    </main>
  );
}
