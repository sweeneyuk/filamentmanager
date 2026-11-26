import { LogOut } from 'lucide-react';
import Field from '../../ui/Field';
import Button from '../../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export default function SecurityTab({ settings, onChange }) {
  const { logout } = useAuth();
  const v = (name) => settings[name] || '';
  return (
    <div className="se-section">
      <h2>Authentication and security</h2>
      <p className="ui-muted">Optional: set up an OpenID Connect (OIDC) provider such as Authentik for single sign-on.</p>
      <div className="se-grid">
        <Field label="OIDC issuer URL"><input type="text" name="oidc_issuer" value={v('oidc_issuer')} onChange={onChange} placeholder="https://authentik.domain.com/application/o/filamentmanager/" /></Field>
        <Field label="OIDC client ID"><input type="text" name="oidc_client_id" value={v('oidc_client_id')} onChange={onChange} /></Field>
        <Field label="OIDC client secret"><input type="password" name="oidc_client_secret" value={v('oidc_client_secret')} onChange={onChange} autoComplete="off" /></Field>
      </div>
      <div><Button variant="outline" icon={LogOut} onClick={logout}>Sign out local admin</Button></div>
    </div>
  );
}
