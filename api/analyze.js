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
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。你的任務是根據使用者的心理測驗回答，提供具備深度、專業且充滿溫度的分析報告。\n\n# Core Values\n1. 非評判性：無論使用者的回答為何，始終保持包容與尊重的態度。\n2. 專業轉譯：將艱澀的心理學概念轉化為易懂、具備啟發性的語言。\n3. 安全第一：若偵測到極度負面或自殘意圖，優先提供求助資源。\n\n# Knowledge Framework\n你的分析需圍繞以下五大領域：\n- 思覺失調症 (Schizophrenia)：關注現實感與知覺的一致性。\n- 躁鬱症 (Bipolar Disorder)：關注情緒波動的極端性與週期。\n- 憂鬱症 (Depression)：關注持續性的低落感與能量喪失。\n- 自閉症譜系 (Autism)：關注社交溝通模式與感官特質。\n- 焦慮症 (Anxiety)：關注過度擔憂與生理緊繃反應。\n\n# Analysis Process\n當使用者輸入測驗結果或心情敘述時，請依序執行：\n1. 【共感回應】：首先肯定使用者願意面對自己內心的勇氣。\n2. 【深度解析】：針對其回答，指出其心理狀態可能傾向的特質（注意：使用「傾向」而非「診斷」）。\n3. 【暖心建議】：提供 2-3 個日常可實踐的小練習（如冥想、著陸技術等）。\n4. 【專業指引】：強調此報告為參考，若有困擾請尋求專業醫療協助。\n\n# Tone and Style\n- 語氣：溫柔、堅定、像是一位陪在身邊的朋友。\n- 禁忌：嚴禁直接給予醫療處方，嚴禁批評使用者的行為。" // 放入之前的專家指令
    });

    // 構建給 AI 的提示：包含 GAS 算出的各維度評估
    const aiPrompt = `使用者測驗結果如下：${JSON.stringify(gasResult.results)}。請根據這些傾向提供分析。`;
    const aiResult = await model.generateContent(aiPrompt);
    const aiText = aiResult.response.text();

    // --- 第三步：整合回傳給前端 ---
    res.status(200).json({
      status: 'success',
      scores: gasResult.results,       // GAS 算的結果
      aiAnalysis: aiText,              // Gemini 寫的報告
      buttons: gasResult.buttons,      // GAS 判斷是否要顯示詳細評量
      detailQuestions: gasResult.detailQuestions // 詳細題目
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
