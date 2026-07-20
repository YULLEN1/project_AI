import { FormEvent, useRef, useState } from 'react';

const prompts = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Как накопить на крупную покупку?',
  'Что можно сократить без ущерба для жизни?',
];

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
    budget: readNumber('moneypilot-budget'),
    salaryDays: readNumber('moneypilot-daysToSalary'),
    savings: readNumber('moneypilot-savings'),
    purchases: readJson('moneypilot-purchases', []),
    familyMembers: readJson('moneypilot-family-members', []),
    familyGoals: readJson('moneypilot-family-goals', []),
    retirementAge: readNumber('moneypilot-retirement-age'),
    retirementIncome: readNumber('moneypilot-retirement-income'),
    suggestedItem: readJson('moneypilot-suggestedItem', null),
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
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
        const errMsg = err?.error || `Ошибка ${response.status}`;
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

  return (
    <div className="page-grid assistant-page-layout">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Финансовый агент</h3>
          <p>Ваши доходы, расходы и цели передаются агенту автоматически. Просто задайте вопрос.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card assistant-panel">
          <div className="assistant-header">
            <h4>Чат с агентом</h4>
            <span>AI</span>
          </div>

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
                <p>Задайте вопрос или выберите подсказку. Данные из приложения передаются автоматически.</p>
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
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Напишите вопрос..."
              disabled={loading}
            />
            <button type="submit" className="primary-button" disabled={loading || !input.trim()}>
              {loading ? '...' : '→'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
