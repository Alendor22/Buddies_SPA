import { redirect } from 'next/navigation';

export default function LegacyVerifyEmailPage() {
  redirect('/sign-up');
}
