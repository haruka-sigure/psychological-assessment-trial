import OpenAI from "openai";

// 初始化 OpenAI 客戶端，但指向 Groq 的伺服器
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", // 這行最重要，它讓請求轉向 Groq
});

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { inputData } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      // 推薦使用 llama-3.3-70b-versatile，速度快且分析能力強
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "你是一位暖心的心理諮商導師。請根據使用者提供的測驗選項數據，計算其心理狀態傾向，並給予一段約 150 字、溫柔且具鼓勵性的建議。"
        },
        {
          role: "user",
          content: `使用者測驗數據如下：${JSON.stringify(inputData)}`
        }
      ],
      temperature: 0.7, // 讓 AI 的回答更具人性化，不會太死板
    });

    const aiText = completion.choices[0].message.content;

    return res.status(200).json({
      status: 'success',
      aiAnalysis: aiText
    });

  } catch (error) {
    console.error("Groq API Error:", error);
    return res.status(500).json({ 
      status: 'error', 
      message: "分析暫時無法執行：" + error.message 
    });
  }
}
