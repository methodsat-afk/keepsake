import { Logo } from '@/components/ui/Logo';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div
          className="bg-white p-8"
          style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-xl)' }}
        >
          <h1 className="mb-6 font-display text-3xl" style={{ color: 'var(--foreground)' }}>Welcome back</h1>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
