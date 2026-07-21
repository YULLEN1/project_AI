const API_TOKEN = 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjFrYnhacFJNQGJSI0tSbE1xS1lqIn0.eyJ1c2VyIjoicXAyNTQ1MTEiLCJ0eXBlIjoiYXBpX2tleSIsImFwaV9rZXlfaWQiOiI2ZTE0M2ZmYy0yZDM4LTQ3ZWUtOTkwZS1kMjNiMWI2YWRjMjYiLCJpYXQiOjE3ODQ1MzQ5OTl9.ThZGmGpG-JpfkssAEIs5BceympRLTyzSzmP4JUg_34rIAyjDj56bi0ZeU-ZVLxq5qCqTa-KhC4oZtAuAH-mNyxV4bKhnjAmMW0xY0NRBpqKYQgvKrOiZcI6YHl5QBLsgcPJJHySX8LPrjs3lRGPhi4tckOGFFowpc4SfWWCK7MJjFr1073GgFNOOcINCWigjjeJp6_pbWZpauoIyI7PcOur1Qdgq4Zi27eeV4mzH26uhDINSfGTduqdPwkyibLURkvCTY6ewDffowoU4uidVaqR7lVAdg9Sh3915gHozMojFPsKAnq866Wqd09t_F8X634VZ9pi9KEpuj6wgjOy4VgyLypa8vII8yx8JNXW5RhT79kz6rrKM-ch8sakKKNn8cbgEXmlQHQWpz1BTaciHNpe79aeO934sj4OWChzXQjwPYj528xRdBXYkFQSPFLntNdKqcE7DchErd1m3BIXJPppyMQAHVF5OZ2kmlvBed4zIBs6nJa9fTACiZHxKNt3-';
const AGENT_ID = '527552f9-53b4-46fc-b7e8-370934b4bcd4';
const COMPLETIONS_URL = `https://agent.timeweb.cloud/api/v1/cloud-ai/agents/${AGENT_ID}/v1/chat/completions`;

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

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
