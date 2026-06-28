import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Buddies',
  description: 'Dog identity, safety, walking, and community network'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
