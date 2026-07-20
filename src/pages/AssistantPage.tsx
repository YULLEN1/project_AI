import { useEffect } from 'react';

export default function AssistantPage() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://timeweb.cloud/api/v1/cloud-ai/agents/527552f9-53b4-46fc-b7e8-370934b4bcd4/embed.js?collapsed=false';
    script.async = true;
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
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Интеллект, который понимает ваши финансы</h3>
          <p>Чат-агент отвечает на любые вопросы на основе ваших данных.</p>
        </div>
      </section>
    </div>
  );
}
