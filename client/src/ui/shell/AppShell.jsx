import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Ellipsis, User } from 'lucide-react';
import SidePanel from '../SidePanel';
import { MAIN_NAV, SETTINGS_NAV } from './nav';
import './AppShell.css';

function NavItem({ to, label, icon: Icon, onClick, className = 'ui-nav__link' }) {
  return (
    <NavLink to={to} end={to === '/'} className={className} onClick={onClick} aria-label={label}>
      <Icon size={20} aria-hidden="true" />
      <span className="ui-nav__label">{label}</span>
      <span className="ui-nav__tip" aria-hidden="true">{label}</span>
    </NavLink>
  );
}

export default function AppShell({ user, children }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const userItem = { to: '/profile', label: user?.username || 'Profile', icon: User };
  const bottomMain = MAIN_NAV.slice(0, 3);
  const moreItems = [...MAIN_NAV.slice(3), SETTINGS_NAV, userItem];
  const moreActive = moreItems.some((it) => it.to === pathname);
  const close = () => setMoreOpen(false);

  return (
    <div className="ui-app">
      <nav className="ui-nav" aria-label="Main">
        <div className="ui-nav__brand">
          <span className="ui-nav__logo" aria-hidden="true" />
          <span className="ui-nav__label">Filament Manager</span>
        </div>
        {MAIN_NAV.map((it) => <NavItem key={it.to} {...it} />)}
        <div className="ui-nav__spacer" />
        <NavItem {...SETTINGS_NAV} />
        <NavItem {...userItem} />
      </nav>

      <nav className="ui-bottom" aria-label="Main">
        {bottomMain.map((it) => (
          <NavItem key={it.to} to={it.to} label={it.short} icon={it.icon} className="ui-bottom__item" />
        ))}
        <button
          type="button"
          className={`ui-bottom__item ${moreActive ? 'active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <Ellipsis size={20} aria-hidden="true" />
          <span className="ui-nav__label">More</span>
        </button>
      </nav>

      <main className="ui-main">{children}</main>

      <SidePanel open={moreOpen} onClose={close} title="More">
        <div className="ui-more">
          {moreItems.map((it) => <NavItem key={it.to} {...it} onClick={close} className="ui-more__link" />)}
        </div>
      </SidePanel>
    </div>
  );
}
