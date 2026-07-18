const members = [
  { name: 'Аня', role: 'Доход', contribute: 78000, color: 'linear-gradient(135deg, #37c7ff, #8b6dff)' },
  { name: 'Максим', role: 'Расходы', contribute: 43000, color: 'linear-gradient(135deg, #ffb54d, #ff6b6b)' },
];

const goals = ['Отпуск', 'Ремонт', 'Автомобиль', 'Образование детей'];

export default function FamilyPage() {
  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">Семейный режим</p>
          <h3>Один бюджет, прозрачность и общие цели</h3>
          <p>Каждый участник видит свои расходы, общие траты и накопления на важные цели.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card large">
          <h4>Общий бюджет семьи</h4>
          <p>Доступно: <strong>248 000 ₽</strong></p>
          <p>Осталось до цели: <strong>1 200 000 ₽</strong></p>
          <div className="stack" style={{ marginTop: 16 }}>
            {members.map(member => (
              <div key={member.name} className="card" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{member.name}</strong>
                  <span>{member.role}</span>
                </div>
                <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: member.color }} />
                <p style={{ marginTop: 8 }}>{member.contribute.toLocaleString('ru-RU')} ₽</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card large">
          <h4>Цели семьи</h4>
          <ul>
            {goals.map(goal => <li key={goal}>{goal}</li>)}
          </ul>
          <div className="forecast-box">
            <p>Сейчас на пути к цели</p>
            <strong>72%</strong>
            <span>прогресс по семейному плану</span>
          </div>
        </div>
      </section>
    </div>
  );
}
