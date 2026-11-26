import { LogOut, Shield, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import PageHeader from '../../ui/shell/PageHeader';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import StatusPill from '../../ui/StatusPill';
import '../login/auth.css';

export default function Profile() {
  const { user, logout } = useAuth();
  return (
    <>
      <PageHeader title="Profile" />
      <div className="au-profile">
        <Card className="au-profile__who">
          <span className="au-avatar" aria-hidden="true"><User size={40} /></span>
          <h2>{user?.username}</h2>
          {user?.is_admin === 1 && <StatusPill tone="warning"><Shield size={14} aria-hidden="true" /> Admin</StatusPill>}
          <Button variant="danger" icon={LogOut} onClick={logout}>Sign out</Button>
        </Card>
        <Card>
          <h3>Account details</h3>
          <p>You are currently logged in as <strong>{user?.username}</strong>.</p>
          <p>If you signed in via Authentik (SSO), logging out here will only end your local Filament Manager session.</p>
        </Card>
      </div>
    </>
  );
}
