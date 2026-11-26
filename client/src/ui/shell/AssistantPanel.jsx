import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import SidePanel from '../SidePanel';
import Button from '../Button';
import './AssistantPanel.css';

export default function AssistantPanel({ open, onClose, messages, isLoading, onSend }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open, isLoading]);

  const submit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input);
    setInput('');
  };

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Assistant"
      className="ui-assistant"
      footer={(
        <form className="ui-assistant__form" onSubmit={submit}>
          <input
            className="ui-input"
            aria-label="Message"
            placeholder="Ask about spools or prints"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" variant="primary" icon={Send} label="Send" disabled={!input.trim() || isLoading} />
        </form>
      )}
    >
      <ol className="ui-assistant__log" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`ui-assistant__msg is-${m.role}`}>
            <span className="ui-visually-hidden">{m.role === 'user' ? 'You:' : 'Assistant:'}</span>
            {m.content}
          </li>
        ))}
        {isLoading && <li className="ui-assistant__msg is-assistant is-typing">Thinking…</li>}
      </ol>
      <div ref={endRef} />
    </SidePanel>
  );
}
