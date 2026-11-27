import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Skeleton from './ui/Skeleton';
import Login from './screens/login';
import AppShell from './ui/shell/AppShell';
import AssistantProvider from './ui/shell/AssistantProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { ToastProvider } from './ui/Toast';
import { SocketProvider } from './contexts/SocketContext';

// Each screen loads on demand, so the first visit downloads only what it shows.
const FilamentManager = lazy(() => import('./screens/spools'));
const Archive = lazy(() => import('./screens/history'));
const Analytics = lazy(() => import('./screens/analytics'));
const Settings = lazy(() => import('./screens/settings'));
const PrintStatus = lazy(() => import('./screens/print-status'));
const ScrapSaver = lazy(() => import('./screens/scrap-saver'));
const Profile = lazy(() => import('./screens/profile'));
const Calculator = lazy(() => import('./screens/calculator'));
const Jobs = lazy(() => import('./screens/jobs'));

const PrivateRoute = ({ children }) => {
  const { user, loading, setupRequired } = useAuth();

  if (loading) return <div className="au-loading" role="status">Loading...</div>;
  if (!user || setupRequired) return <Login />;

  return children;
};

function AppRoutes() {
  return (
    <Suspense fallback={<Skeleton height={240} count={2} />}>
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
    </Suspense>
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
