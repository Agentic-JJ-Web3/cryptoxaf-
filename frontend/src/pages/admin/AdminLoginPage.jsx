import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../admin/AdminAuthContext';
import { ApiError } from '../../api/client';

export default function AdminLoginPage() {
  const { status, login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to="/admin/queue" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin/queue');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong signing in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[380px] flex-col justify-center px-5 text-ink">
      <div className="mb-7">
        <div className="text-lg tracking-tight">
          Crypto<b className="font-semibold">XAF</b>
        </div>
        <div className="mt-1 text-sm text-muted">Operator sign-in</div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-rule bg-card px-3.5 py-3 text-sm text-ink outline-none focus:border-vault focus:ring-2 focus:ring-vault/30"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-rule bg-card px-3.5 py-3 text-sm text-ink outline-none focus:border-vault focus:ring-2 focus:ring-vault/30"
          />
        </label>

        {error && <div className="text-sm text-fault">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-md bg-vault px-4 py-3.5 text-sm font-semibold text-paper-2 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
