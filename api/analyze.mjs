import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { inputData } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwQ7ZM8VAKFVRoOU-l2wrTLwUn5cF1Z7Vwl-6aZe73gxrKlyW8M77iBDMymQMSB3QEVKA/exec";

  try {
    // 1. 呼叫 GAS
    const gasResponse = await fetch(`${GAS_URL}?data=${encodeURIComponent(JSON.stringify(inputData))}`, {
      method: 'POST',
      redirect: 'follow'
    });
    const gasResult = await gasResponse.json();

    // 2. 呼叫 Gemini
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // 💥 嘗試改用 2.0 版本，這通常在 v1beta 下是支援的
    const model = genAI.getGenerativeModel({ 
      { model: "gemini-1.5-flash" }, 
      { apiVersion: 'v1' } // 💡 強制指定穩定版路徑,
      systemInstruction: "你是一位心理導師。請根據數據提供 100 字內簡短溫柔的分析建議。"
    });

    const aiPrompt = `使用者數據：${JSON.stringify(gasResult.results)}`;
    
    // 💡 增加一個簡單的延遲（例如 1 秒），避免觸發 429
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await model.generateContent(aiPrompt);
    const aiText = result.response.text();

    // 3. 回傳
    return res.status(200).json({
      status: 'success',
      scores: gasResult.results,
      aiAnalysis: aiText
    });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
