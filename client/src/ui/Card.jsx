import './Card.css';

export default function Card({ as: Tag = 'section', className = '', ...rest }) {
  return <Tag className={`ui-card ${className}`.trim()} {...rest} />;
}
