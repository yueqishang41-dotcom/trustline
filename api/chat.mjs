/**
 * Vercel Serverless Function — DeepSeek API 代理
 * 部署方式: 将 杯子/ 文件夹上传到 Vercel 即可
 *
 * 与本地 Netlify 版行为对齐（以本地为标准）：
 *  - 主动 24s 超时（AbortController）→ 返回 504，前端识别后自动重试一次
 *  - 上游 502/503 等错误状态透传给前端
 *  - config.maxDuration 60：避免 Vercel 默认 10s 把慢请求提前掐断（前端就收不到可识别的 504）
 */
export const config = { maxDuration: 60 };

const UPSTREAM_TIMEOUT_MS = 24000;

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    let response;
    try {
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
        signal: controller.signal,
      });
    } catch (e) {
      // 主动超时 → 返回 504，让前端可以识别并重试
      if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
        return res.status(504).json({ error: 'AI 服务响应超时，请稍后重试' });
      }
      return res.status(502).json({ error: `AI 服务连接失败：${(e && e.message) || 'network error'}` });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const errText = (await response.text().catch(() => '')).slice(0, 300);
      return res.status(response.status).json({ error: `AI 服务出错（${response.status}）：${errText}` });
    }

    const data = await response.json();
    res.json({ content: data.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
