import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, Shield } from 'lucide-react';

function Profile() {
  const { user, logout } = useAuth();

  return (
    <div>
      <div className="card title-card" style={{ marginBottom: '20px', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0', color: 'var(--primary-color)' }}>User Profile</h2>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Manage your account and session</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ 
            width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(0, 255, 136, 0.1)', 
            display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid var(--primary-color)'
          }}>
            <User size={40} color="var(--primary-color)" />
          </div>
          
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{user?.username}</h2>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            {user?.is_admin === 1 && (
              <span style={{ 
                backgroundColor: 'rgba(255, 170, 0, 0.1)', color: '#ffaa00', padding: '4px 8px', 
                borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold'
              }}>
                <Shield size={14} /> Admin
              </span>
            )}
          </div>

          <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '15px 0' }}></div>

          <button 
            onClick={logout}
            className="btn btn-danger"
            style={{ 
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
              padding: '10px', borderRadius: '6px', border: '1px solid #ff4444', backgroundColor: 'rgba(255, 68, 68, 0.1)', 
              color: '#ff4444', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        <div className="card" style={{ flex: '2 1 400px' }}>
          <h3>Account Details</h3>
          <p style={{ color: '#888' }}>
            You are currently logged in as <strong>{user?.username}</strong>. 
          </p>
          <p style={{ color: '#888' }}>
            If you signed in via Authentik (SSO), logging out here will only end your local Filament Manager session.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Profile;
