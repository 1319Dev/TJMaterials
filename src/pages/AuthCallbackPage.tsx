import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppState';

export function AuthCallbackPage() {
  const { sessionEmail } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionEmail) navigate('/', { replace: true });
  }, [navigate, sessionEmail]);

  return <p className="text-lg font-bold">Finishing sign-in…</p>;
}
