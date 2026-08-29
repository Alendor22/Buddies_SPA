import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/sign-up" />
    </main>
  );
}
