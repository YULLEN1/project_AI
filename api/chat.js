const API_URL = process.env.VITE_AI_API_URL;

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
    const body = JSON.stringify({
      model: 'cloud-ai',
      messages: [
        { role: 'user', content: `Данные пользователя из приложения MoneyPilot:\n${contextStr}\n\nВопрос: ${message}` },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
