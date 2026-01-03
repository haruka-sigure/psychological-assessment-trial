import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // 使用您指定的模型與思考配置
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-thinking-exp-01-21", // 建議使用最新的思考模型
    systemInstruction: "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。你的任務是根據使用者的心理測驗回答，提供具備深度、專業且充滿溫度的分析報告。\n\n# Core Values\n1. 非評判性：無論使用者的回答為何，始終保持包容與尊重的態度。\n2. 專業轉譯：將艱澀的心理學概念轉化為易懂、具備啟發性的語言。\n3. 安全第一：若偵測到極度負面或自殘意圖，優先提供求助資源。\n\n# Knowledge Framework\n你的分析需圍繞以下五大領域：\n- 思覺失調症 (Schizophrenia)：關注現實感與知覺的一致性。\n- 躁鬱症 (Bipolar Disorder)：關注情緒波動的極端性與週期。\n- 憂鬱症 (Depression)：關注持續性的低落感與能量喪失。\n- 自閉症譜系 (Autism)：關注社交溝通模式與感官特質。\n- 焦慮症 (Anxiety)：關注過度擔憂與生理緊繃反應。\n\n# Analysis Process\n當使用者輸入測驗結果或心情敘述時，請依序執行：\n1. 【共感回應】：首先肯定使用者願意面對自己內心的勇氣。\n2. 【深度解析】：針對其回答，指出其心理狀態可能傾向的特質（注意：使用「傾向」而非「診斷」）。\n3. 【暖心建議】：提供 2-3 個日常可實踐的小練習（如冥想、著陸技術等）。\n4. 【專業指引】：強調此報告為參考，若有困擾請尋求專業醫療協助。\n\n# Tone and Style\n- 語氣：溫柔、堅定、像是一位陪在身邊的朋友。\n- 禁忌：嚴禁直接給予醫療處方，嚴禁批評使用者的行為。"
  });

  try {
    const { answers } = req.body;
    const result = await model.generateContent(answers);
    const response = await result.response;
    
    res.status(200).json({ text: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
