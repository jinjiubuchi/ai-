// Vercel Serverless Function: api/ai.js
// 这是一个 Node.js 函数，用于安全地调用 Google Gemini API，并将密钥隐藏在环境变量中。

const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
// 从 Vercel 环境变量中获取 API 密钥
const API_KEY = process.env.GEMINI_API_KEY; 
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Vercel 推荐的 Serverless Function 处理函数
export default async function handler(req, res) {
    // 1. 密钥检查 (确保密钥已在 Vercel 后台设置)
    if (!API_KEY) {
        res.status(500).json({ error: "GEMINI_API_KEY 环境变量未设置，请检查 Vercel 配置。" });
        return;
    }

    // 2. 仅接受 POST 请求
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
        return;
    }

    // 3. 解析用户提示词 (从前端 index.html 发送的请求体中获取)
    const { prompt } = req.body;
    if (!prompt) {
        res.status(400).json({ error: "请求体中缺少 'prompt' 字段。" });
        return;
    }

    // 4. 构建 Gemini API Payload
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };
    
    // 5. 调用 Gemini API
    const apiUrl = `${BASE_URL}${MODEL_NAME}:generateContent?key=${API_KEY}`;
    
    const MAX_RETRIES = 3;
    let geminiResponse;

    // 包含指数退避和重试的网络请求循环
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            geminiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (geminiResponse.ok) {
                break; // 成功响应，跳出循环
            }
            
            // 遇到 429 (限速) 或 5xx (服务器错误)，进行重试
            if (geminiResponse.status === 429 || geminiResponse.status >= 500) {
                const delay = 1000 * Math.pow(2, i) + Math.random() * 500;
                console.warn(`Attempt ${i + 1} failed with status ${geminiResponse.status}. Retrying in ${delay.toFixed(0)}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // 遇到非重试错误 (如 400 格式错误, 401 密钥无效)，直接抛出
                const errorBody = await geminiResponse.json();
                throw new Error(`Gemini API Error: ${geminiResponse.status} - ${errorBody.error?.message || JSON.stringify(errorBody)}`);
            }

        } catch (error) {
            console.error(`Fetch or Network Error (Attempt ${i + 1}):`, error);
            if (i === MAX_RETRIES - 1) {
                res.status(500).json({ error: `AI服务连接失败: ${error.message}` });
                return;
            }
        }
    }

    try {
        const result = await geminiResponse.json();
        // 提取生成的文本内容
        const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "抱歉，AI未能生成有效回复。请检查您的 API 密钥是否有效。";

        // 6. 返回结果给前端
        res.status(200).json({ text: generatedText });

    } catch (e) {
        console.error("Error parsing AI response or response structure is invalid:", e);
        res.status(500).json({ error: "AI服务响应格式错误或无效，请联系管理员。" });
    }
}
