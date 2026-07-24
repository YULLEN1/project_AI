const API_TOKEN = process.env.TIMEWEB_API_TOKEN;
const AGENT_ID = process.env.TIMEWEB_AGENT_ID || '527552f9-53b4-46fc-b7e8-370934b4bcd4';
const COMPLETIONS_URL = `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${AGENT_ID}/v1/chat/completions`;

function getErrorMessage(data, fallback) {
  const error = data?.error ?? data?.message ?? data?.detail;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = error.message ?? error.detail ?? error.error_description;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (!API_TOKEN) {
    return res.status(500).json({ error: 'Не настроен ключ ИИ-ассистента.' });
  }

  try {
    const contextStr = JSON.stringify(context || {}, null, 2);

    const body = {
      model: 'cloud-ai',
      messages: [
        {
          role: 'system',
          content: 'Ты — финансовый помощник приложения MoneyPilot. Все суммы в рублях (₽). Анализируй данные пользователя и отвечай на вопросы по делу, кратко, на русском. Данные пользователя передаются в каждом сообщении автоматически. Всегда указывай сумму с символом ₽.',
        },
        {
          role: 'user',
          content: `Данные из MoneyPilot:\n\`\`\`json\n${contextStr}\n\`\`\`\n\nВопрос: ${message}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    };

    const response = await fetch(COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(response.status).json({ error: getErrorMessage(data, `Сервис ассистента вернул ошибку ${response.status}.`) });
    }
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Не удалось связаться с сервисом ассистента.' });
  }
}
