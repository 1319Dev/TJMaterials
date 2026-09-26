import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { HomePage } from './pages/HomePage';
import { InventoryPage } from './pages/InventoryPage';
import { MorePage } from './pages/MorePage';
import { MtrRequestPage } from './pages/MtrRequestPage';
import { ProjectPage } from './pages/ProjectPage';
import { ReceivePage } from './pages/ReceivePage';
import { SearchPage } from './pages/SearchPage';

export function appBasename(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '/';
  return base.replace(/\/$/, '');
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<HomePage />} />
        <Route path="receive" element={<ReceivePage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="project" element={<ProjectPage />} />
        <Route path="mtr-request" element={<MtrRequestPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename={appBasename()}>
      <AppRoutes />
    </BrowserRouter>
  );
}
