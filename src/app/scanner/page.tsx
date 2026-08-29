import DogQrScanner from '@/components/scanner/DogQrScanner';

export const metadata = {
  title: 'Scan Dog Tag | Buddies',
  description: 'Scan a Buddies dog identity QR code and open its public safety profile.'
};

export default function ScannerPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <DogQrScanner />
    </main>
  );
}
