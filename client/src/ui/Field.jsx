import { Children, cloneElement, isValidElement, useId } from 'react';
import './Field.css';

export default function Field({ label, hint, action, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child, {
      id: child.props.id || id,
      className: `ui-input ${child.props.className || ''}`.trim(),
      'aria-describedby': [child.props['aria-describedby'], hintId].filter(Boolean).join(' ') || undefined,
    })
    : child;
  return (
    <div className={`ui-field ${className}`.trim()}>
      <div className="ui-field__top">
        <label className="ui-field__label" htmlFor={child.props?.id || id}>{label}</label>
        {action}
      </div>
      {control}
      {hint && <div className="ui-field__hint" id={hintId}>{hint}</div>}
    </div>
  );
}

export function Switch({ label, checked, onChange, name, className = '' }) {
  return (
    <label className={`ui-switch ${className}`.trim()}>
      <input type="checkbox" role="switch" name={name} checked={!!checked} onChange={(e) => onChange?.(e.target.checked, e)} />
      <span className="ui-switch__track" aria-hidden="true"><span className="ui-switch__thumb" /></span>
      <span className="ui-switch__label">{label}</span>
    </label>
  );
}
