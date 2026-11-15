import { useEffect, useRef, useState } from 'react';
import { apiRequest, safeStorage } from '../api';

function getSessionId() {
  const saved = safeStorage.getItem('shree_help_chat_session');
  if (saved) return saved;

  const id = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  safeStorage.setItem('shree_help_chat_session', id);
  return id;
}

const css = `
.cw-btn{position:fixed;right:20px;bottom:20px;width:58px;height:58px;padding:0;border-radius:50%;border:2px solid #ff5200;background:#fff;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:9999;overflow:hidden}
.cw-btn-open{border:0;background:#ff5200}
.cw-launcher-img{display:block;width:100%;height:100%;object-fit:cover}
.cw-panel{position:fixed;right:20px;bottom:90px;width:min(370px,calc(100vw - 24px));height:min(520px,calc(100vh - 120px));background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;z-index:9999;font-family:'Plus Jakarta Sans',system-ui,sans-serif}
.cw-head{background:#fff7ed;color:#311b12;padding:14px 16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #fed7aa}
.cw-agent-brand{display:flex;align-items:center;gap:10px}
.cw-agent-avatar{width:38px;height:38px;flex:0 0 38px;border-radius:50%;object-fit:cover;background:#fff;border:1px solid #fed7aa}
.cw-head small{display:block;font-weight:500;color:#9a3412;font-size:12px}
.cw-x{background:none;border:0;color:#311b12;font-size:20px;cursor:pointer}
.cw-body{flex:1;overflow-y:auto;padding:14px;background:#fffaf6;display:flex;flex-direction:column;gap:8px}
.cw-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
.cw-bot{background:#fff;border:1px solid #eadfd2;align-self:flex-start;color:#2a1a1a}
.cw-bot-row{width:100%;display:flex;align-items:flex-end;gap:6px;align-self:flex-start}
.cw-msg-avatar{width:26px;height:26px;flex:0 0 26px;border-radius:50%;object-fit:cover;background:#fff;border:1px solid #eadfd2}
.cw-bot-row .cw-msg{max-width:calc(100% - 32px)}
.cw-me{background:#ff5200;color:#fff;align-self:flex-end}
.cw-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.cw-chip{border:1px solid #ff5200;background:#fff;color:#9a3412;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer}
.cw-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eadfd2;background:#fff}
.cw-in{flex:1;min-width:0;border:1px solid #d9cbb9;border-radius:10px;padding:10px;font-size:14px;outline:none}
.cw-send{background:#ff5200;border:0;border-radius:10px;padding:0 16px;font-weight:700;color:#fff;cursor:pointer}
.cw-send:disabled{opacity:.55;cursor:default}
@media(max-width:760px){
  .cw-btn{right:14px;bottom:calc(76px + env(safe-area-inset-bottom))}
  .cw-panel{right:12px;bottom:calc(132px + env(safe-area-inset-bottom));width:calc(100vw - 24px);height:min(520px,calc(100vh - 156px));max-height:calc(100dvh - 156px)}
}
`;

const initialQuickReplies = [
  'Track my order',
  'Cancel an order',
  'Issue with my order',
  'Payment / refund',
  'Talk to support'
];

export default function ChatWidget({ open: controlledOpen, onOpenChange }) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = typeof controlledOpen === 'boolean' ? controlledOpen : localOpen;
  const setOpen = onOpenChange || setLocalOpen;
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [chips, setChips] = useState(initialQuickReplies);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Namaste! I can track your order, help with an issue, request a cancellation, or connect you with our team.'
    }
  ]);
  const sessionId = useRef(null);
  if (!sessionId.current) sessionId.current = getSessionId();
  const endRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    apiRequest('/api/chat/start', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sessionId.current })
    })
      .then((data) => {
        if (data.sessionId) {
          sessionId.current = data.sessionId;
          safeStorage.setItem('shree_help_chat_session', data.sessionId);
        }
        if (data.reply) setMessages([{ from: 'bot', text: data.reply }]);
        setChips(data.quickReplies || []);
      })
      .catch((err) => {
        started.current = false;
        setMessages((current) => [
          ...current,
          { from: 'bot', text: `I could not connect to support: ${err.message}. Please try again.` }
        ]);
      });
  }, [open]);

  async function send(text) {
    const message = text.trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { from: 'me', text: message }]);
    setInput('');
    setChips([]);
    setBusy(true);
    try {
      const data = await apiRequest('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sessionId.current, message })
      });
      if (data.sessionId) {
        sessionId.current = data.sessionId;
        safeStorage.setItem('shree_help_chat_session', data.sessionId);
      }
      setMessages((current) => [
        ...current,
        { from: 'bot', text: data.reply || 'Sorry, something went wrong.' }
      ]);
      setChips(data.quickReplies || []);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { from: 'bot', text: `I could not reach support: ${err.message}. Please try again.` }
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      {open && (
        <div className="cw-panel" role="dialog" aria-label="Radha Swami help chat">
          <div className="cw-head">
            <div className="cw-agent-brand">
              <img className="cw-agent-avatar" src="/agent-avatar.jpg" alt="" />
              <div>
                Radha Swami Help
                <small>Track • Issues • Cancellation • Support</small>
              </div>
            </div>
            <button
              type="button"
              className="cw-x"
              onClick={() => setOpen(false)}
              aria-label="Close help chat"
            >
              ×
            </button>
          </div>
          <div className="cw-body" aria-live="polite">
            {messages.map((message, index) =>
              message.from === 'me' ? (
                <div key={`${index}-${message.from}`} className="cw-msg cw-me">
                  {message.text}
                </div>
              ) : (
                <div key={`${index}-${message.from}`} className="cw-bot-row">
                  <img className="cw-msg-avatar" src="/agent-avatar.jpg" alt="" />
                  <div className="cw-msg cw-bot">{message.text}</div>
                </div>
              )
            )}
            {chips.length > 0 && (
              <div className="cw-chips">
                {chips.map((chip) => (
                  <button
                    type="button"
                    key={chip}
                    className="cw-chip"
                    disabled={busy}
                    onClick={() => send(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="cw-bot-row">
                <img className="cw-msg-avatar" src="/agent-avatar.jpg" alt="" />
                <div className="cw-msg cw-bot">One moment…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="cw-form"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
          >
            <input
              className="cw-in"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a message…"
              maxLength={1000}
              aria-label="Message to help agent"
            />
            <button className="cw-send" type="submit" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        className={`cw-btn ${open ? 'cw-btn-open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        title="Radha Swami Help"
      >
        {open ? '×' : <img className="cw-launcher-img" src="/agent-avatar.jpg" alt="" />}
      </button>
    </>
  );
}
