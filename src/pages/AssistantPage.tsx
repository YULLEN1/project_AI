import { FormEvent, useState } from 'react';

const prompts = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Что можно сократить без ущерба для жизни?',
  'Смогу ли я купить квартиру через 5 лет?',
];

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('Я вижу, что самый быстрый эффект дадут сокращение кафе и такси. Это не ухудшит базовый уровень комфорта, но освободит заметную сумму.');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;

    const text = question.toLowerCase();
    if (text.includes('квартира')) {
      setAnswer('Если откладывать по 15 000 ₽ в месяц и не менять привычный уровень расходов, квартира через 5 лет станет реальной целью только при дополнительном росте дохода или снижении стоимости жилья.');
    } else if (text.includes('переплач')) {
      setAnswer('Сейчас чаще всего переплачиваете на переменных расходах: кафе, такси и подписки. Это даёт быстрый эффект без сильного дискомфорта.');
    } else {
      setAnswer('Сейчас лучше направить деньги на автоматическое накопление и сократить импульсивные покупки в первые 2 недели месяца.');
    }
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Персональные ответы на реальные вопросы</h3>
          <p>Вместо общего чата — эксперт по личным финансам, который опирается на вашу финансовую модель.</p>
        </div>
      </section>

      <section className="card large">
        <div className="chip-row">
          {prompts.map(item => (
            <button key={item} className="chip" onClick={() => setQuestion(item)}>{item}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Смогу ли я купить квартиру через 5 лет?" />
          <button type="submit">Получить ответ</button>
        </form>

        <div className="assistant-answer" style={{ marginTop: 16 }}>{answer}</div>
      </section>
    </div>
  );
}
