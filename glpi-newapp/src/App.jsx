import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Reset from './pages/backoffice/reset/Reset';
import Dashboard from './pages/backoffice/dashboard/DashBoard';
import BackOfficeLayout from './components/BackOfficeLayout';
import ImportPage from './pages/backoffice/import/ImportPage';
import Tickets from './pages/backoffice/tickets/Tickets';

import Element from './pages/frontoffice/elements/Element';
import CreateTicket from './pages/frontoffice/tickets/CreateTicket';
import KanbanPage from './pages/frontoffice/tickets/KanbanPage';
import FrontOfficeLayout from './components/FrontOfficeLayout';

const Assets = () => <div><h2>Gestion du matériel informatique</h2></div>;

const ProtectedRoute = ({ children }) => {
  const { isConnected } = useAuth();
  return isConnected ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Routes publiques / FrontOffice ── */}
          <Route path="/login" element={<Login />} />
          
          <Route path="/frontoffice" element={<FrontOfficeLayout />}>
            <Route index element={<Navigate to="elements" replace />} />
            <Route path="elements" element={<Element />} />
            <Route path="/frontoffice/create-ticket" element={<CreateTicket />} />
            <Route path="/frontoffice/kanban" element={<KanbanPage />} />
            {/* <Route path="create-ticket" element={<CreateTicket />} /> */}
          </Route>

          {/* ── Routes protégées (backoffice) ── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <BackOfficeLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reset" element={<Reset />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="assets" element={<Assets />} />
            <Route path="tickets" element={<Tickets />} />
          </Route>

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}