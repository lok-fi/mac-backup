import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DataUploader from './DataUploader';
import Dashboard from './Dashboard';
import InteractiveBackground from './components/InteractiveBackground';
import AuroraBlobs from './components/AuroraBlobs';

// Soft gradient everywhere; the interactive dot field only on the upload/home page
// (kept off the dashboard so it stays clean and light).
function Background() {
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith('/d/');
  return (
    <>
      <AuroraBlobs />
      <InteractiveBackground opacity={isDashboard ? 0.4 : 1} />
    </>
  );
}

// No login: every route is open.
export default function App() {
  return (
    <div className="relative min-h-screen bg-white text-slate-900">
      <Router basename="/app">
        <Background />
        <Routes>
          <Route path="/" element={<DataUploader />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="/d/:dashboardId" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}
