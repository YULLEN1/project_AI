import { FormEvent, useEffect, useRef, useState } from 'react';

const prompts = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Как накопить на крупную покупку?',
  'Что можно сократить без ущерба для жизни?',
];
const CHAT_STORAGE_KEY = 'moneypilot-assistant-messages';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function readNumber(key: string): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function collectContext() {
  return {
    currency: '₽ (рубли)',
    budget: readNumber('moneypilot-budget'),
    incomeEvents: readJson('moneypilot-income-events', []),
    savings: readNumber('moneypilot-savings'),
    purchases: readJson('moneypilot-purchases', []),
    familyMembers: readJson('moneypilot-family-members', []),
    familyGoals: readJson('moneypilot-family-goals', []),
    userAge: readNumber('moneypilot-user-age'),
    savingsGoals: readJson('moneypilot-savings-goals', []),
    suggestedItem: readJson('moneypilot-suggestedItem', null),
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const value = error as { error?: unknown; message?: unknown; detail?: unknown };
    return getErrorMessage(value.error ?? value.message ?? value.detail, fallback);
  }
  return fallback;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>(() => readJson<Message[]>(CHAT_STORAGE_KEY, []).filter(message => (
    (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'
  )));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('moneypilot-ai-consent') === 'true');
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  useEffect(() => {
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!consent) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Перед отправкой вопроса подтвердите передачу выбранных финансовых данных.' }]);
      return;
    }
    setLoading(true);
    setInput('');

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const context = collectContext();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const errMsg = getErrorMessage(err, `Ошибка ${response.status}`);
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${errMsg}` }]);
        return;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Пустой ответ от агента.' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err instanceof Error ? err.message : 'Ошибка соединения'}` }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(input.trim());
  };

  const handleConsent = (checked: boolean) => {
    setConsent(checked);
    window.localStorage.setItem('moneypilot-ai-consent', String(checked));
  };

  return (
    <div className="page-grid assistant-page-layout">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h2>Финансовый агент</h2>
          <p>Вы сами решаете, можно ли использовать данные приложения для ответа. Рекомендации носят справочный характер и не являются инвестиционной консультацией.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card assistant-panel">
          <div className="assistant-header">
            <h2>Чат с агентом</h2>
            <span>AI</span>
          </div>

          <label className="ai-consent">
            <input type="checkbox" checked={consent} onChange={e => handleConsent(e.target.checked)} />
            <span>Разрешаю передавать агенту лимит, доход, расходы, накопления и цели для персонального ответа.</span>
          </label>
          <p className="settings-note">Данные используются только для текущего запроса. Отключите согласие, чтобы остановить передачу.</p>

          <div className="chip-row">
            {prompts.map(item => (
              <button key={item} type="button" className="chip" onClick={() => send(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chat-empty">
                <p>Задайте вопрос или выберите подсказку. Перед отправкой подтвердите состав финансового контекста.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-assistant chat-msg-loading">
                <span className="dot-pulse" />
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input.trim());
                }
              }}
              placeholder="Опишите вашу ситуацию или задайте вопрос. Enter - отправить, Shift+Enter - новая строка."
              aria-label="Вопрос финансовому агенту"
              disabled={loading}
              rows={5}
            />
            <button type="submit" className="primary-button" disabled={loading || !input.trim()}>
              {loading ? 'Отправляем...' : 'Отправить'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
