import { redirect } from 'next/navigation';

export default function LegacyForgotPasswordPage() {
  redirect('/sign-in');
}
