import { RotateCw } from 'lucide-react';
import Button from './Button';
import './States.css';

export default function LoadError({ message = 'Could not load this page.', onRetry }) {
  return (
    <div className="ui-error" role="alert">
      <p>{message}</p>
      <Button variant="outline" icon={RotateCw} onClick={onRetry}>Try again</Button>
    </div>
  );
}
