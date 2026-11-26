import { Sparkles } from 'lucide-react';
import Button from '../Button';
import { useAssistant } from './assistantContext';
import './PageHeader.css';

export default function PageHeader({ title, status, actions }) {
  const assistant = useAssistant();
  return (
    <header className="ui-header">
      <div className="ui-header__title">
        <h1>{title}</h1>
        {status}
      </div>
      <div className="ui-header__actions">
        {actions}
        <Button variant="secondary" icon={Sparkles} className="ui-header__assistant" aria-label="Ask the assistant" onClick={assistant.open}>
          Ask the assistant
        </Button>
      </div>
    </header>
  );
}
