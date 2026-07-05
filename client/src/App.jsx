import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Database, Archive as ArchiveIcon, Settings as SettingsIcon, Printer, Activity, Recycle, User } from 'lucide-react';
import FilamentManager from './components/FilamentManager';
import Archive from './components/Archive';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import PrintStatus from './components/PrintStatus';
import ScrapSaver from './components/ScrapSaver';
import Profile from './components/Profile';
import Login from './components/Login';
import FloatingAssistant from './components/FloatingAssistant';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';

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
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Printer size={20} /> Print Status
            </NavLink>
            <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Database size={20} /> Spool Inventory
            </NavLink>
            <NavLink to="/archive" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <ArchiveIcon size={20} /> Print Archive
            </NavLink>
            <NavLink to="/scrap-saver" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Recycle size={20} /> Scrap Saver
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Activity size={20} /> Analytics
            </NavLink>
            <div className="nav-spacer"></div>
            <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <User size={20} /> Profile
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <SettingsIcon size={20} /> Settings
            </NavLink>
          </nav>
        )}
        
        <main className="main-content">
          <Routes>
            <Route path="/inventory" element={<PrivateRoute><FilamentManager /></PrivateRoute>} />
            <Route path="/" element={<PrivateRoute><PrintStatus /></PrivateRoute>} />
            <Route path="/archive" element={<PrivateRoute><Archive /></PrivateRoute>} />
            <Route path="/scrap-saver" element={<PrivateRoute><ScrapSaver /></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          </Routes>
        </main>
        
        {user && !setupRequired && <FloatingAssistant />}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AlertProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </AlertProvider>
  );
}

export default App;
