import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Bot, X, Send, User } from 'lucide-react';

function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi there! I am your AI Assistant. Ask me anything about your spools or print history.' }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post('/api/chat', { messages: newMessages });
      if (res.data.text) {
        setMessages([...newMessages, { role: 'assistant', content: res.data.text }]);
      } else if (res.data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${res.data.error}` }]);
      }
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: `Error communicating with server.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
            width: '60px', height: '60px', borderRadius: '50%',
            backgroundColor: 'var(--primary-color)', color: '#000',
            border: 'none', boxShadow: '0 4px 12px rgba(0,255,136,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'transform 0.2s'
          }}
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
          width: '350px', height: '500px', backgroundColor: 'var(--card-bg)',
          borderRadius: '12px', border: '1px solid var(--border-color)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 15px', backgroundColor: 'var(--secondary-bg)',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
              <Bot size={20} /> AI Assistant
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                display: 'flex', gap: '8px', alignItems: 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: msg.role === 'user' ? '#444' : 'rgba(0,255,136,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: msg.role === 'user' ? '#fff' : 'var(--primary-color)'
                }}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div style={{
                  backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--secondary-bg)',
                  color: msg.role === 'user' ? '#000' : 'var(--text-color)',
                  padding: '10px 14px', borderRadius: '12px',
                  borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                  borderTopLeftRadius: msg.role === 'user' ? '12px' : '2px',
                  fontSize: '0.9rem', lineHeight: '1.4', maxWidth: '80%', wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ 
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  backgroundColor: 'rgba(0,255,136,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary-color)'
                }}>
                  <Bot size={16} />
                </div>
                <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: 'var(--secondary-bg)', fontSize: '0.9rem', fontStyle: 'italic', color: '#888' }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{
            display: 'flex', padding: '10px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)'
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question..."
              style={{
                flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)', color: 'var(--text-color)', outline: 'none'
              }}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              style={{
                background: 'none', border: 'none', color: input.trim() && !isLoading ? 'var(--primary-color)' : '#555',
                cursor: input.trim() && !isLoading ? 'pointer' : 'default', padding: '0 10px',
                display: 'flex', alignItems: 'center'
              }}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default FloatingAssistant;
