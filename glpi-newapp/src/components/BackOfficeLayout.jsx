// src/components/BackOfficeLayout.jsx
import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './BackOfficeLayout.css';
import '../assets/css/All.css';

export default function BackOfficeLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  // États pour gérer le comportement de la Sidebar
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openDropdown, setOpenDropdown] = useState({
    parc: false,
    assistance: false,
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Alterne l'ouverture d'un dropdown et force la sidebar à s'ouvrir si elle était repliée
  const toggleDropdown = (menu) => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    setOpenDropdown((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  return (
    <div className="glpi-layout">
      {/* Sidebar style GLPI 11 */}
      <aside className={`glpi-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <span className="logo-text">{isCollapsed ? 'G' : 'GLPI NewApp'}</span>
          <button className="toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? '❯' : '❮'}
          </button>
        </div>

        <nav className="sidebar-menu">
          {/* LIEN UNIQUE : TABLEAU DE BORD */}
          <Link to="/dashboard" className="menu-item">
            {!isCollapsed && <span className="label">Tableau de bord</span>}
          </Link>
          <Link to="/reset" className="menu-item">
            {!isCollapsed && <span className="label">Reset</span>}
          </Link>
          <Link to="/import" className="menu-item">
            {!isCollapsed && <span className="label">Import CSV</span>}
          </Link>
          <Link to="/costs/import" className="menu-item">
            {!isCollapsed && <span className="label">Import Sqlite</span>}
          </Link>
          <Link to="/kanban" className="menu-item">
            {!isCollapsed && <span className="label">Settings</span>}
          </Link>
          <Link to="/costs" className="menu-item">
            {!isCollapsed && <span className="label">Rapport Coûts</span>}
          </Link>

          {/* DROPDOWN 1 : PARC */}
          <div className={`menu-dropdown-wrapper ${openDropdown.parc && !isCollapsed ? 'open' : ''}`}>
            <button className="menu-item dropdown-trigger" onClick={() => toggleDropdown('parc')}>
              <span className="icon">🖥️</span>
              {!isCollapsed && (
                <>
                  <span className="label">Parc</span>
                  <span className="arrow">{openDropdown.parc ? '▼' : '▶'}</span>
                </>
              )}
            </button>
            
            {/* Sous-menus du Parc (Cachés si repliés) */}
            {openDropdown.parc && !isCollapsed && (
              <div className="sub-menu">
                <Link to="/assets/computers" className="sub-menu-item">Ordinateurs</Link>
                <Link to="#" className="sub-menu-item">Moniteurs</Link>
                <Link to="#" className="sub-menu-item">Logiciels</Link>
              </div>
            )}
          </div>

          {/* DROPDOWN 2 : ASSISTANCE */}
          <div className={`menu-dropdown-wrapper ${openDropdown.assistance && !isCollapsed ? 'open' : ''}`}>
            <button className="menu-item dropdown-trigger" onClick={() => toggleDropdown('assistance')}>
              <span className="icon">🎫</span>
              {!isCollapsed && (
                <>
                  <span className="label">Assistance</span>
                  <span className="arrow">{openDropdown.assistance ? '▼' : '▶'}</span>
                </>
              )}
            </button>

            {/* Sous-menus de l'Assistance */}
            {openDropdown.assistance && !isCollapsed && (
              <div className="sub-menu">
                <Link to="/tickets" className="sub-menu-item">Tickets</Link>
                <Link to="/frontoffice/create-ticket" className="sub-menu-item">Créer un ticket</Link>
              </div>
            )}
          </div>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <span className="icon">🚪</span>
            {!isCollapsed && <span className="label">Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Contenu Principal */}
      <div className="glpi-main-container">
        <header className="glpi-topbar">
          <div className="topbar-title">Examen GLPI 11 - Extension React</div>
          <div className="user-profile">Utilisateur : <strong>glpi</strong></div>
        </header>

        <main className="glpi-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}