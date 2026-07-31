/**
 * Vercel Serverless Function — DeepSeek API 代理
 * 部署方式: 将 杯子/ 文件夹上传到 Vercel 即可
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured in Vercel env vars' });
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一位专业的职场AI助理。请根据用户的要求生成或修改工作文档。输出应专业、简洁、实用，使用中文。' },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `API error: ${response.status}` });
    }

    const data = await response.json();
    res.json({ content: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
