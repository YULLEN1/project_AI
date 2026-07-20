import { useEffect, useState } from 'react';

const sampleQuestions = [
  'Почему в этом месяце денег стало меньше?',
  'Где я переплачиваю?',
  'Как накопить на крупную покупку?',
  'Что можно сократить без ущерба для жизни?',
];

export default function AssistantPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://timeweb.cloud/api/v1/cloud-ai/agents/527552f9-53b4-46fc-b7e8-370934b4bcd4/embed.js?collapsed=false';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      script.remove();
      const container = document.querySelector('[data-timeweb-chat]');
      if (container) container.remove();
    };
  }, []);

  return (
    <div className="page-grid">
      <section className="hero-panel compact">
        <div className="hero-copy">
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Финансовый агент на основе ваших данных</h3>
          <p>Задайте вопрос о доходах, расходах или накоплениях — агент ответит с учётом вашей ситуации. Ваши данные передаются агенту для точного анализа.</p>
        </div>
      </section>

      {!loaded && (
        <section className="content-grid">
          <div className="card large" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12, opacity: 0.5 }}>💬</div>
            <h4 style={{ margin: 0 }}>Загрузка ассистента...</h4>
            <div className="chip-row" style={{ justifyContent: 'center', marginTop: 20 }}>
              {sampleQuestions.map(q => (
                <span key={q} className="chip" style={{ cursor: 'default', opacity: 0.6 }}>{q}</span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
