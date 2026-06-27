import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Database, Archive as ArchiveIcon, Settings as SettingsIcon, Printer } from 'lucide-react';
import FilamentManager from './components/FilamentManager';
import Archive from './components/Archive';
import Settings from './components/Settings';
import PrintStatus from './components/PrintStatus';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="sidebar">
          <h1>Filament Manager</h1>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Database size={20} /> Spool Inventory
          </NavLink>
          <NavLink to="/print-status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Printer size={20} /> Print Status
          </NavLink>
          <NavLink to="/archive" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <ArchiveIcon size={20} /> Print Archive
          </NavLink>
          <div style={{ flex: 1 }}></div>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <SettingsIcon size={20} /> Settings
          </NavLink>
        </nav>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<FilamentManager />} />
            <Route path="/print-status" element={<PrintStatus />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
