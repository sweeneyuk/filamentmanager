import { forwardRef } from 'react';
import './Button.css';

const Button = forwardRef(function Button(
  { variant = 'secondary', icon: Icon, label, busy = false, href, children, className = '', type = 'button', disabled, ...rest },
  ref,
) {
  const iconOnly = Icon && !children;
  const classes = ['ui-btn', `ui-btn--${variant}`, iconOnly ? 'ui-btn--icon' : '', busy ? 'is-busy' : '', className]
    .filter(Boolean).join(' ');
  const content = (
    <>
      {Icon && <Icon size={18} aria-hidden="true" className="ui-btn__icon" />}
      {children && <span className="ui-btn__text">{children}</span>}
    </>
  );
  const a11y = { 'aria-label': iconOnly ? label : rest['aria-label'], title: iconOnly ? label : rest.title };
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest} {...a11y}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest} {...a11y}>
      {content}
    </button>
  );
});

export default Button;
