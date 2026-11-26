import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { AssistantContext } from './assistantContext';
import AssistantPanel from './AssistantPanel';

const GREETING = { role: 'assistant', content: 'Hi there! I am your AI Assistant. Ask me anything about your spools or print history.' };

/** Holds the chat above the routes so it survives closing the panel and changing page. */
export default function AssistantProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [isLoading, setIsLoading] = useState(false);

  const send = useCallback(async (text) => {
    const content = text.trim();
    if (!content || isLoading) return;
    const newMessages = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setIsLoading(true);
    try {
      const res = await axios.post('/api/chat', { messages: newMessages });
      if (res.data.text) {
        setMessages([...newMessages, { role: 'assistant', content: res.data.text }]);
      } else if (res.data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${res.data.error}` }]);
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Error communicating with server.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const value = useMemo(() => ({ open: () => setIsOpen(true) }), []);
  return (
    <AssistantContext.Provider value={value}>
      {children}
      <AssistantPanel open={isOpen} onClose={() => setIsOpen(false)} messages={messages} isLoading={isLoading} onSend={send} />
    </AssistantContext.Provider>
  );
}
