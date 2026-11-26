import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import FilamentManager from './screens/spools';
import Archive from './screens/history';
import Analytics from './screens/analytics';
import Settings from './components/Settings';
import PrintStatus from './screens/print-status';
import ScrapSaver from './screens/scrap-saver';
import Profile from './components/Profile';
import Login from './components/Login';
import AppShell from './ui/shell/AppShell';
import AssistantProvider from './ui/shell/AssistantProvider';
import Calculator from './screens/calculator';
import Jobs from './screens/jobs';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { ToastProvider } from './ui/Toast';
import { SocketProvider } from './contexts/SocketContext';

const PrivateRoute = ({ children }) => {
  const { user, loading, setupRequired } = useAuth();

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-color)' }}>Loading...</div>;
  if (!user || setupRequired) return <Login />;

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/inventory" element={<PrivateRoute><FilamentManager /></PrivateRoute>} />
      <Route path="/" element={<PrivateRoute><PrintStatus /></PrivateRoute>} />
      <Route path="/archive" element={<PrivateRoute><Archive /></PrivateRoute>} />
      <Route path="/scrap-saver" element={<PrivateRoute><ScrapSaver /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/calculator" element={<PrivateRoute><Calculator /></PrivateRoute>} />
      <Route path="/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
    </Routes>
  );
}

function MainApp() {
  const { user, setupRequired } = useAuth();
  const signedIn = user && !setupRequired;

  return (
    <Router>
      {signedIn ? (
        <AssistantProvider>
          <AppShell user={user}>
            <AppRoutes />
          </AppShell>
        </AssistantProvider>
      ) : (
        <main className="ui-main ui-main--bare">
          <AppRoutes />
        </main>
      )}
    </Router>
  );
}

function App() {
  return (
    <ToastProvider>
      <AlertProvider>
        <AuthProvider>
          <SocketProvider>
            <MainApp />
          </SocketProvider>
        </AuthProvider>
      </AlertProvider>
    </ToastProvider>
  );
}

export default App;
