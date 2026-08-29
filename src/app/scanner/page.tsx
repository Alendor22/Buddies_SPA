import DogRecognitionCamera from '@/components/scanner/DogRecognitionCamera';

export const metadata = {
  title: 'Identify a Dog | Buddies',
  description: 'Camera-first visual dog identification with photo upload and secondary tag verification.',
};

export default function ScannerPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <DogRecognitionCamera />
    </main>
  );
}
