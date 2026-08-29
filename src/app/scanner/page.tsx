import DogRecognitionCamera from '@/components/scanner/DogRecognitionCamera';

export const metadata = {
  title: 'Identify a Dog | Buddies',
  description: 'Identify a dog visually with Buddies Doggy Recognition, with tag scanning as a secondary check.',
};

export default function ScannerPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <DogRecognitionCamera />
    </main>
  );
}
