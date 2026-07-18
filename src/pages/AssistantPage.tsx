import { FormEvent, useState } from 'react';

const prompts = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Что можно сократить без ущерба для жизни?',
  'Смогу ли я купить квартиру через 5 лет?',
];

function buildAnswer(text: string) {
  const query = text.toLowerCase();
  if (!query) {
    return 'Опишите вашу финансовую цель или проблему, и я подскажу ход.';
  }
  if (query.includes('квартира') || query.includes('жилье')) {
    return 'Первые шаги — создать подушку безопасности и направлять 10-15% дохода в накопления. Для квартиры важно снизить переменные расходы и искать дополнительные доходы.';
  }
  if (query.includes('переплач') || query.includes('дорог') || query.includes('подпис')) {
    return 'Ваша зона экономии — кафе, такси и подписки. Пересмотрите подписки, переведите часть расходов на экономные альтернативы и посмотрите, какие траты можно автоматизировать.';
  }
  if (query.includes('работать') || query.includes('недостат') || query.includes('доход')) {
    return 'Если доход кажется недостаточным, попробуйте детализировать расходы и создать план «обязательные / желаемые / разовые». Это снимает эмоциональный контроль и показывает реальные возможности.';
  }
  return 'Хороший вопрос. Оптимальное решение — начать с бюджета, распределить траты по приоритетам и проверить, где можно сократить без дискомфорта.';
}

export default function AssistantPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAnswer(buildAnswer(question.trim()));
  };

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Интеллект, который понимает ваши финансы</h3>
          <p>Диалог без шаблонов: вы задаёте вопрос, я формирую вывод на основе ваших целей.</p>
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
            />
            <button type="submit" className="primary-button">Получить совет</button>
          </form>

          <div className={`assistant-answer-box ${answer ? 'filled' : 'empty'}`}>
            {answer ? <p>{answer}</p> : <p>Здесь появится развёрнутый ответ в формате финансового плана.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
