import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, appBasename } from '../App';
import type { AppSnapshot } from '../domain/types';
import { AppProvider } from '../state/AppState';

export function renderAt(snapshot: AppSnapshot, path = '/') {
  const basename = appBasename();
  const entry = basename === '/' ? path : `${basename}${path === '/' ? '/' : path}`;
  return render(
    <MemoryRouter initialEntries={[entry]} basename={basename === '/' ? undefined : basename}>
      <AppProvider initial={snapshot} persist={false}>
        <AppRoutes />
      </AppProvider>
    </MemoryRouter>,
  );
}
