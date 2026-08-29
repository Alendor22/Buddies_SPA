import { redirect } from 'next/navigation';

export default function LegacyResetPasswordPage() {
  redirect('/sign-in');
}
