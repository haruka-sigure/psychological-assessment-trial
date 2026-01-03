import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  // 強制設定 JSON 回傳格式
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: '僅支援 POST' });
  }

  const { inputData } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // 💡 為什麼選這個？因為之前的紀錄顯示您的 Key 只有這條路是通的 (429 比 404 好)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash" 
    });

    // 準備 Prompt
    const prompt = `你是一位心理諮商師。以下是使用者的測驗選項數據：${JSON.stringify(inputData)}。請根據這些數據計算壓力傾向，並給予 150 字內暖心且專業的建議。`;

    // 執行生成
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return res.status(200).json({
      status: 'success',
      aiAnalysis: aiText
    });

  } catch (error) {
    console.error("Gemini Error:", error.message);
    
    // 處理 429 額度問題
    if (error.message.includes("429") || error.message.includes("quota")) {
      return res.status(429).json({ 
        status: 'error', 
        message: "目前使用人數較多，請等候 1 分鐘再按一次「送出評估」。" 
      });
    }

    return res.status(500).json({ 
      status: 'error', 
      message: "分析發生錯誤：" + error.message 
    });
  }
}
