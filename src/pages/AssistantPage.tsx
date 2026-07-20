import { useEffect, useState } from 'react';

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

function formatContext(data: ReturnType<typeof collectContext>): string {
  const lines: string[] = [];
  if (data.budget) lines.push(`Бюджет на месяц: ${data.budget.toLocaleString()} ₽`);
  if (data.savings) lines.push(`Накопления: ${data.savings.toLocaleString()} ₽`);
  if (data.salaryDays) lines.push(`Дней до зарплаты: ${data.salaryDays}`);
  if (data.suggestedItem) lines.push(`Цель для накопления: ${data.suggestedItem.item} — ${data.suggestedItem.price.toLocaleString()} ₽`);

  if (data.purchases.length > 0) {
    const total = data.purchases.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0);
    lines.push(`Всего покупок: ${data.purchases.length} на ${total.toLocaleString()} ₽`);
    const cats: Record<string, number> = {};
    data.purchases.forEach((p: { category?: string; amount: number }) => {
      const cat = p.category || 'Без категории';
      cats[cat] = (cats[cat] || 0) + (p.amount || 0);
    });
    lines.push('По категориям:');
    Object.entries(cats).forEach(([cat, amt]) => lines.push(`  ${cat}: ${amt.toLocaleString()} ₽`));
  }

  if (data.familyMembers && data.familyMembers.length > 0) {
    lines.push(`Членов семьи: ${data.familyMembers.length}`);
    data.familyMembers.forEach((m: { name: string; income?: number }) => {
      if (m.income) lines.push(`  ${m.name}: доход ${m.income.toLocaleString()} ₽`);
    });
  }

  if (data.familyGoals && data.familyGoals.length > 0) {
    data.familyGoals.forEach((g: { name: string; target?: number }) => {
      if (g.target) lines.push(`Цель: ${g.name} — ${g.target.toLocaleString()} ₽`);
    });
  }

  if (data.retirementAge) lines.push(`Пенсионный возраст: ${data.retirementAge} лет`);
  if (data.retirementIncome) lines.push(`Желаемый пенсионный доход: ${data.retirementIncome.toLocaleString()} ₽/мес`);

  return lines.join('\n');
}

function injectIntoWidget(text: string): boolean {
  const widget = document.querySelector('agent-chat-widget');
  if (!widget) return false;

  try {
    const root = (widget as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot;
    if (!root) {
      const chatButton = widget.querySelector('button') as HTMLElement;
      if (chatButton) { chatButton.click(); }
      return false;
    }

    const input = root.querySelector('textarea, input[type="text"], [contenteditable]') as HTMLElement;
    const button = root.querySelector('button[type="submit"], button:last-child') as HTMLElement;

    if (input && 'value' in input) {
      (input as HTMLInputElement).value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (button) {
        setTimeout(() => button.click(), 100);
      }
      return true;
    }

    if (input && input.isContentEditable) {
      input.textContent = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (button) {
        setTimeout(() => button.click(), 100);
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export default function AssistantPage() {
  const [status, setStatus] = useState<'idle' | 'injecting' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    setStatus('injecting');
    const data = collectContext();
    const formatted = formatContext(data);
    const message = `Мои финансовые данные из MoneyPilot:\n\n${formatted}\n\n---\nПроанализируй мои финансы. Что я могу улучшить?`;

    const injected = injectIntoWidget(message);
    if (injected) {
      setStatus('idle');
    } else {
      const copied = await copyToClipboard(message);
      setStatus(copied ? 'copied' : 'error');
    }
  };

  const handlePrompt = (text: string) => {
    const data = collectContext();
    const formatted = formatContext(data);
    const message = `Вот мои данные:\n${formatted}\n\nВопрос: ${text}`;

    const injected = injectIntoWidget(message);
    if (!injected) {
      copyToClipboard(message);
      setStatus('copied');
    }
  };

  useEffect(() => {
    if (document.querySelector('agent-chat-widget')) return;
    const existing = document.querySelector('script[src*="agent-chat-widget"]');
    if (existing) return;

    const config = {
      agentAccessId: '527552f9-53b4-46fc-b7e8-370934b4bcd4',
      wsurl: 'https://chat.timeweb.cloud',
      isCollapsed: false,
      name: 'Agent GPT',
      signature: 'ИИ Ассистент',
      welcomeMessage: 'Добрый день! Задайте мне свой вопрос.',
      primaryColor: '#7177F8',
      backgroundColor: '#17212b',
      headerFooterColor: '#242f3d',
      textColor: '#ffffff',
      showButton: true,
      showToolProcessing: true,
      iconUrl: 'https://st.timeweb.com/cloud-static/cloud-ai/agent-widget/agent_icons/1.svg',
      chatPosition: 'bottom_right',
    };

    const script = document.createElement('script');
    script.src = 'https://s3.twcstorage.ru/8f3135d2-f31a39da-bf84-440b-b768-c0589e415f20/agent-chat-widget.js';
    script.async = true;
    script.onload = () => {
      const widget = document.createElement('agent-chat-widget');
      widget.setAttribute('data-agent-access-id', config.agentAccessId);
      widget.setAttribute('data-wsurl', config.wsurl);
      widget.setAttribute('data-is-collapsed', String(config.isCollapsed));
      widget.setAttribute('data-name', config.name);
      widget.setAttribute('data-signature', config.signature);
      widget.setAttribute('data-welcome-message', config.welcomeMessage);
      widget.setAttribute('data-primary-color', config.primaryColor);
      widget.setAttribute('data-background-color', config.backgroundColor);
      widget.setAttribute('data-header-footer-color', config.headerFooterColor);
      widget.setAttribute('data-text-color', config.textColor);
      widget.setAttribute('data-show-button', String(config.showButton));
      widget.setAttribute('data-show-tool-processing', String(config.showToolProcessing));
      widget.setAttribute('data-icon-url', config.iconUrl);
      widget.setAttribute('data-chat-position', config.chatPosition);
      document.body.appendChild(widget);
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div className="page-grid assistant-page-layout">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">ИИ-консультант</p>
          <h3>Финансовый агент на основе ваших данных</h3>
          <p>Нажмите «Поделиться данными», чтобы агент узнал ваши доходы, расходы и цели.</p>
        </div>
      </section>

      <section className="content-grid">
        <div className="card assistant-panel">
          <div className="assistant-header">
            <div>
              <p className="eyebrow">Быстрые вопросы</p>
              <h4>Задать вопрос агенту</h4>
            </div>
            <span>AI</span>
          </div>

          <div className="chip-row">
            {prompts.map(item => (
              <button key={item} type="button" className="chip" onClick={() => handlePrompt(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="share-section">
            <button
              type="button"
              className="primary-button"
              onClick={handleShare}
              disabled={status === 'injecting'}
            >
              {status === 'injecting' ? 'Отправляю данные...' : 'Поделиться данными с агентом'}
            </button>

            {status === 'copied' && (
              <div className="assistant-answer-box filled" style={{ borderColor: '#4caf50' }}>
                <p style={{ color: '#4caf50' }}>
                  Данные скопированы. Откройте чат с агентом (иконка в правом нижнем углу) и вставьте их туда.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="assistant-answer-box filled" style={{ borderColor: '#ff6b6b' }}>
                <p style={{ color: '#ff6b6b' }}>
                  Не удалось отправить данные автоматически. Скопируйте их вручную:
                </p>
              </div>
            )}

            {status === 'error' && <DataPreview />}
          </div>
        </div>
      </section>
    </div>
  );
}

function DataPreview() {
  const data = collectContext();
  const formatted = formatContext(data);
  return (
    <div className="data-preview">
      <p className="data-preview-label">Ваши данные:</p>
      <pre>{formatted}</pre>
      <button
        type="button"
        className="ghost-button"
        onClick={() => copyToClipboard(formatted)}
      >
        Скопировать
      </button>
    </div>
  );
}
