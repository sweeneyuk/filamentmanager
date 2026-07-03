import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Database, Archive as ArchiveIcon, Settings as SettingsIcon, Printer, Activity } from 'lucide-react';
import FilamentManager from './components/FilamentManager';
import Archive from './components/Archive';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import PrintStatus from './components/PrintStatus';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading, setupRequired } = useAuth();

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-color)' }}>Loading...</div>;
  if (!user || setupRequired) return <Login />;

  return children;
};

function MainApp() {
  const { user, setupRequired } = useAuth();
  
  return (
    <Router>
      <div className="app-container">
        {user && !setupRequired && (
          <nav className="sidebar">
            <h1>Filament Manager</h1>
            <NavLink to="/print-status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Printer size={20} /> Print Status
            </NavLink>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Database size={20} /> Spool Inventory
            </NavLink>
            <NavLink to="/archive" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArchiveIcon size={20} /> Print Archive
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Activity size={20} /> Analytics
            </NavLink>
            <div style={{ flex: 1 }}></div>
            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <SettingsIcon size={20} /> Settings
            </NavLink>
          </nav>
        )}
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<PrivateRoute><FilamentManager /></PrivateRoute>} />
            <Route path="/print-status" element={<PrivateRoute><PrintStatus /></PrivateRoute>} />
            <Route path="/archive" element={<PrivateRoute><Archive /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
