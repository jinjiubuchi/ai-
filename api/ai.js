// 文件路径: api/ai.js

// 使用标准的 ESM 语法导入模块
import { GoogleGenerativeAI } from '@google/generative-ai';

// 获取 Vercel 环境变量中配置的 API Key
// Vercel 会自动将环境变量注入到 process.env 对象中
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// 初始化 Google Generative AI 客户端
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}
const ai = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = "gemini-2.5-flash"; // 选用快速的模型

/**
 * Vercel Serverless Function 主函数
 * @param {object} req - 请求对象
 * @param {object} res - 响应对象
 */
// 使用标准的 ESM 导出
export default async function handler(req, res) {
    // 设置 CORS 头部，允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理 OPTIONS 预检请求 (解决常见的 405 错误)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        // 如果不是 POST 请求，返回 405 错误
        res.status(405).json({ error: 'Method Not Allowed. Only POST requests are accepted.' });
        return;
    }

    // 检查 AI 客户端是否初始化成功 (即检查 API Key 是否存在)
    if (!ai) {
        res.status(500).json({ error: 'AI Client Initialization Failed. GEMINI_API_KEY is missing or invalid.' });
        return;
    }

    try {
        // Vercel 会自动解析 JSON body
        const { prompt } = req.body;
        
        if (!prompt) {
            res.status(400).json({ error: 'Missing prompt in request body.' });
            return;
        }

        // 调用 Gemini API 进行内容生成
        const response = await ai.getGenerativeModel({ model }).generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                // 设置温度控制 AI 的创意性
                temperature: 0.7, 
            },
        });

        // 提取 AI 的回答文本
        const aiText = response.text;

        // 返回 AI 的回答给前端
        res.status(200).json({ text: aiText });

    } catch (error) {
        console.error("Gemini API Error:", error);
        // 返回 500 错误和详细信息
        res.status(500).json({ error: `AI Processing Error: ${error.message}. Please check Vercel Logs.` });
    }
}
