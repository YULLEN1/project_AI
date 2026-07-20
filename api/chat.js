const AGENT_ID = '527552f9-53b4-46fc-b7e8-370934b4bcd4';
const API_BASE = `https://agent.timeweb.cloud/api/v1/cloud-ai/agents`;

const AUTH_HEADERS = [
  { 'Authorization': `Bearer ${AGENT_ID}` },
  { 'Authorization': AGENT_ID },
  { 'x-api-key': AGENT_ID },
  { 'X-API-Key': AGENT_ID },
  {},
];

async function tryUrl(url, payload) {
  for (const headers of AUTH_HEADERS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });
      if (response.ok) return response;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const contextStr = JSON.stringify(context || {}, null, 2);
    const payload = {
      model: 'cloud-ai',
      messages: [
        { role: 'system', content: 'Ты — финансовый помощник на русском. Анализируй данные пользователя и давай конкретные советы.' },
        { role: 'user', content: `Данные из MoneyPilot:\n\`\`\`json\n${contextStr}\n\`\`\`\n\nВопрос: ${message}` },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    };

    const urls = [
      `${API_BASE}/${AGENT_ID}/v1/chat/completions`,
      `${API_BASE}/${AGENT_ID}/v1`,
      `${API_BASE}/${AGENT_ID}/v1?api_key=${AGENT_ID}`,
      `${API_BASE}/${AGENT_ID}/v1/chat/completions?api_key=${AGENT_ID}`,
      `${API_BASE}/${AGENT_ID}/v1?access_id=${AGENT_ID}`,
      `${API_BASE}/${AGENT_ID}/v1/chat/completions?access_id=${AGENT_ID}`,
    ];

    for (const url of urls) {
      const result = await tryUrl(url, payload);
      if (result) {
        const data = await result.json();
        return res.status(200).json(data);
      }
    }

    return res.status(502).json({
      error: 'Агент Timeweb не отвечает (все способы авторизации проверены). Возможно, REST API отключён для этого агента.',
      hint: 'Используйте встроенный чат-виджет на странице /assistant, он работает через WebSocket.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
