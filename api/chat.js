export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(501).json({
    error: 'REST API агента не включён. Используйте встроенный чат-виджет на странице /assistant.',
  });
}
