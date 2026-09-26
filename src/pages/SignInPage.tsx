import { useState } from 'react';
import { authRedirectTo } from '../data/supabase';
import { useApp } from '../state/AppState';
import { Field, controlClass } from '../components/ui';

export function SignInPage() {
  const { signInWithPassword, signUpWithPassword, sendMagicLink, continueOnDevice, hasDeviceCopy } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<string | null>, success: string) {
    setBusy(true);
    setError('');
    setNotice('');
    const message = await action();
    setBusy(false);
    if (message) setError(message);
    else setNotice(success);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Inspector sign-in</h1>
      <p className="text-sm text-pmi-muted">
        Sign in to your project. A new account starts empty. Material is recorded only when you receive it. Offline work stays on this device and syncs when you are back online.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => signInWithPassword(email, password), 'Signed in.');
        }}
      >
        <Field label="Email">
          <input
            className={controlClass}
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Password">
          <input
            className={controlClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? (
          <p role="alert" className="pmi-flag">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="border-2 border-pmi-border bg-pmi-card p-3 font-bold">
            {notice}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text">
          Sign in
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold"
          onClick={() => void run(() => signUpWithPassword(email, password), 'Account created. Check your email if a confirmation link was sent.')}
        >
          Create account
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold"
          onClick={() =>
            void run(
              () => sendMagicLink(email),
              `Sign-in link sent. It opens ${authRedirectTo()}.`,
            )
          }
        >
          Email me a sign-in link
        </button>
      </form>
      <button type="button" className="min-h-14 w-full border-2 border-pmi-border text-lg font-bold" onClick={continueOnDevice}>
        {hasDeviceCopy ? 'Continue on this device' : 'Work on this device'}
      </button>
      <p className="text-sm text-pmi-muted">
        The first sign-in needs a connection. After that, this device keeps the project and syncs when it can.
      </p>
    </div>
  );
}
