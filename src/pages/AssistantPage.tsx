import { FormEvent, useState } from 'react';

const API_URL = import.meta.env.VITE_AI_API_URL as string;

type Purchase = {
  title: string;
  amount: number;
  category: string;
  date: string;
};

const prompts = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Что можно сократить без ущерба для жизни?',
  'Смогу ли я купить квартиру через 5 лет?',
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
    purchases: readJson<Purchase[]>('moneypilot-purchases', []),
    familyMembers: readJson('moneypilot-family-members', []),
    familyGoals: readJson('moneypilot-family-goals', []),
    retirementAge: readNumber('moneypilot-retirement-age'),
    retirementIncome: readNumber('moneypilot-retirement-income'),
    suggestedItem: readJson('moneypilot-suggestedItem', null),
  };
}

const SYSTEM_PROMPT = `Ты — финансовый консультант приложения MoneyPilot. Твоя задача — помогать пользователю управлять личными финансами: отвечать на вопросы, давать рекомендации, анализировать привычки и строить планы.

Правила:
- Всегда отвечай на русском языке.
- Говори простым языком, без канцелярита.
- Будь конкретным: если можно посчитать — считай.
- Не давай советов по инвестированию в ценные бумаги или криптовалюту.
- Не рекомендуй конкретные банки или финансовые продукты.
- Не делай прогнозов о курсах валют или акций.

Если пользователь передал финансовые данные — используй их для анализа. Если данных нет — дай универсальный совет.`;

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
      const contextStr = JSON.stringify(context, null, 2);

      const response = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'cloud-ai',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Данные пользователя из приложения MoneyPilot:\n${contextStr}\n\nВопрос: ${text}` },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        setAnswer(reply);
      } else {
        setError('Пустой ответ от агента. Попробуйте переформулировать вопрос.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось связаться с агентом. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Интеллект, который понимает ваши финансы</h3>
          <p>Диалог без шаблонов: вы задаёте вопрос, я формирую вывод на основе ваших данных.</p>
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
          <p className="assistant-intro">Выберите подсказку или сформулируйте свой вопрос о доходах, расходах или накоплениях.</p>

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
              {answer ? <p>{answer}</p> : <p>Здесь появится развёрнутый ответ в формате финансового плана.</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
