import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const { inputData } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  // 這裡確保 GAS URL 只有一個且正確
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwQ7ZM8VAKFVRoOU-l2wrTLwUn5cF1Z7Vwl-6aZe73gxrKlyW8M77iBDMymQMSB3QEVKA/exec"; 

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // 💥 回到 v1beta，因為這是你的 Key 目前能通的路徑
    // 💡 改用 gemini-1.5-flash，因為它的免費配額通常比 2.0 寬裕
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" } // 不手動指定版本，讓 SDK 預設走 v1beta
    );

    // 準備傳送給 AI 的內容
    const prompt = "你是心理導師。請根據數據給予100字內暖心建議：" + JSON.stringify(inputData);
    
    // 執行生成
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return res.status(200).json({
      status: 'success',
      aiAnalysis: aiText
    });
  } catch (error) {
    console.error("Gemini Error:", error.message);
    // 💥 如果還是 429，至少讓前端知道要稍等
    const isRateLimit = error.message.includes("429") || error.message.includes("quota");
    return res.status(500).json({ 
      status: 'error', 
      message: isRateLimit ? "分析太頻繁了，請等 1 分鐘再試一次" : error.message 
    });
  }
}
