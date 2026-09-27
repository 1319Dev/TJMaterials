import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { DailyReceivePage } from './pages/DailyReceivePage';
import { HomePage } from './pages/HomePage';
import { MtrDeskPage } from './pages/MtrDeskPage';
import { PackingSlipsPage } from './pages/PackingSlipsPage';
import { TrackerPage } from './pages/TrackerPage';
import { InventoryPage } from './pages/InventoryPage';
import { MorePage } from './pages/MorePage';
import { MtrRequestPage } from './pages/MtrRequestPage';
import { ProjectPage } from './pages/ProjectPage';
import { ReceivePage } from './pages/ReceivePage';
import { SearchPage } from './pages/SearchPage';
import { FittingFormPage, FittingListPage } from './pages/FittingPage';
import { FlangeFormPage, FlangeListPage } from './pages/FlangePage';
import { TallyPage } from './pages/TallyPage';
import { ValveFormPage, ValveListPage } from './pages/ValvePage';

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
        <Route path="daily" element={<DailyReceivePage />} />
        <Route path="receive" element={<ReceivePage />} />
        <Route path="packing-slips" element={<PackingSlipsPage />} />
        <Route path="mtrs" element={<MtrDeskPage />} />
        <Route path="tracker" element={<TrackerPage />} />
        <Route path="tally" element={<TallyPage />} />
        <Route path="fittings" element={<FittingListPage />} />
        <Route path="fittings/:fittingId" element={<FittingFormPage />} />
        <Route path="flanges" element={<FlangeListPage />} />
        <Route path="flanges/:flangeId" element={<FlangeFormPage />} />
        <Route path="valves" element={<ValveListPage />} />
        <Route path="valves/:valveId" element={<ValveFormPage />} />
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
