import { FormEvent, useState } from 'react';

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
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || loading) return;

    setLoading(true);
    setError('');
    setAnswer('');

    try {
      const context = collectContext();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        setAnswer(reply);
      } else {
        setError('Пустой ответ от агента.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связаться с агентом.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Финансовый агент на основе ваших данных</h3>
          <p>Ваши доходы, расходы и цели автоматически передаются агенту. Просто задайте вопрос.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card assistant-panel">
          <div className="assistant-header">
            <div>
              <p className="eyebrow">Совет дня</p>
              <h4>Проверяйте расходы по факту</h4>
            </div>
            <span>AI</span>
          </div>
          <p className="assistant-intro">Выберите подсказку или задайте свой вопрос.</p>

          <div className="chip-row">
            {prompts.map(item => (
              <button key={item} type="button" className="chip" onClick={() => setQuestion(item)}>{item}</button>
            ))}
          </div>

          <form className="assistant-form" onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Например: как снизить траты на подписки?"
              disabled={loading}
            />
            <button type="submit" className="primary-button" disabled={loading || !question.trim()}>
              {loading ? 'Думаю...' : 'Получить совет'}
            </button>
          </form>

          {error && (
            <div className="assistant-answer-box filled" style={{ borderColor: '#ff6b6b' }}>
              <p style={{ color: '#ff6b6b' }}>{error}</p>
            </div>
          )}

          {!error && (
            <div className={`assistant-answer-box ${answer ? 'filled' : 'empty'}`}>
              {answer ? <p>{answer}</p> : <p>Здесь появится ответ агента с учётом ваших данных.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
