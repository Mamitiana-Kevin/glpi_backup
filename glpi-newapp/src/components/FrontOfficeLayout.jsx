import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './BackOfficeLayout.css'; // On réutilise les styles de base
import '../assets/css/All.css';

export default function FrontOfficeLayout() {
  const { logout, isConnected } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="glpi-layout">
      {/* Sidebar FrontOffice */}
      <aside className={`glpi-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="logo-text">{isCollapsed ? 'F' : 'FrontOffice'}</span>
          <button className="toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? '❯' : '❮'}
          </button>
        </div>

        <nav className="sidebar-menu">
          <Link to="/frontoffice/elements" className="menu-item">
            <span className="icon">📦</span>
            {!isCollapsed && <span className="label">Éléments du parc</span>}
          </Link>
          
          <Link to="/frontoffice/create-ticket" className="menu-item">
            <span className="icon">🎫</span>
            {!isCollapsed && <span className="label">Créer un Ticket</span>}
          </Link>

          <Link to="/frontoffice/kanban" className="menu-item">
            <span className="icon">✅</span>
            {!isCollapsed && <span className="label">Gestion des Tickets</span>}
          </Link>
          
          <Link to="/dashboard" className="menu-item">
            <span className="icon">📊</span>
            {!isCollapsed && <span className="label">Retour Dashboard</span>}
          </Link>

          {/* On peut ajouter d'autres liens ici */}
          <Link to="#" className="menu-item">
            <span className="icon">🎫</span>
            {!isCollapsed && <span className="label">Mes Tickets</span>}
          </Link>
        </nav>

        <div className="sidebar-footer">
          {isConnected ? (
            <button onClick={handleLogout} className="logout-btn">
              <span className="icon">🚪</span>
              {!isCollapsed && <span className="label">Déconnexion</span>}
            </button>
          ) : (
            <Link to="/login" className="menu-item">
              <span className="icon">🔑</span>
              {!isCollapsed && <span className="label">Connexion</span>}
            </Link>
          )}
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="glpi-main-container">
        <header className="glpi-topbar">
          <div className="topbar-title">
            FrontOffice / Parc
          </div>
          <div className="user-profile">
            {isConnected ? 'Connecté' : 'Mode visiteur'}
          </div>
        </header>
        <div className="glpi-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
