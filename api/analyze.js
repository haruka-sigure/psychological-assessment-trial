import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { inputData } = req.body; // 來自前端的 JSON 數據
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwQ7ZM8VAKFVRoOU-l2wrTLwUn5cF1Z7Vwl-6aZe73gxrKlyW8M77iBDMymQMSB3QEVKA/exec";
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  try {
    // --- 第一步：將數據送到 GAS 進行算分與存檔 ---
    // 我們模擬瀏覽器發送 parameter.data 給 GAS
    const gasResponse = await fetch(`${GAS_URL}?data=${encodeURIComponent(JSON.stringify(inputData))}`, {
      method: 'POST'
    });
    const gasResult = await gasResponse.json();

    if (gasResult.status === 'error') throw new Error(gasResult.message);

    // --- 第二步：將算分結果交給 Gemini 進行暖心分析 ---
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // 在 api/analyze.js 找到這一段
    const model = genAI.getGenerativeModel({ 
    //model: "gemini-1.5-fl// 💥 試著改為下面的其中一個：
    model: "gemini-1.5-flash-latest", 
    // model: "gemini-2.0-flash",// (如果 1.5 持續 404)
    systemInstruction: "..." 
});

    // 構建給 AI 的提示：包含 GAS 算出的各維度評估
    const aiPrompt = `使用者測驗結果如下：${JSON.stringify(gasResult.results)}。請根據這些傾向提供分析。`;
    const aiResult = await model.generateContent(aiPrompt);
    // 💡 增加檢查：確保模型真的有生成內容
    const result = await model.generateContent(aiPrompt);
    const response = await result.response;
    const aiText = aiResult.response.text();

    if (!aiText) {
        throw new Error("Gemini 未能生成分析文字，請檢查輸入內容。");
    }

    // --- 第三步：整合回傳給前端 ---
    res.status(200).json({
      status: 'success',
      scores: gasResult.results,       // GAS 算的結果
      aiAnalysis: aiText,              // Gemini 寫的報告
      buttons: gasResult.buttons,      // GAS 判斷是否要顯示詳細評量
      detailQuestions: gasResult.detailQuestions // 詳細題目
    });

  } catch (error) {
    console.error("Gemini API Error Detail:", error);
    // 💥 這裡會回傳具體的錯誤訊息到前端，方便你直接看
    res.status(500).json({ status: 'error', message: "Gemini 服務錯誤: " + error.message });
}
}
