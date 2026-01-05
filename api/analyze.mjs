import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export default async function handler(req, res) {
  const GAS_URL = process.env.GAS_WEB_APP_URL;
  const { inputData } = req.body;

  try {
    // 1. 轉發給 GAS (包含 mainScore)
    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: JSON.stringify(inputData) })
    });
    const gasResult = await gasResponse.json();

    // 2. 根據類型決定 AI Prompt
    let systemPrompt = "";
    let userPrompt = "";

    if (inputData.assessmentType === 'detail') {
      // 深度評量的專屬 AI 建議
      systemPrompt = `你是一位資深的心理諮商專家，現在正在進行「${inputData.dimension}」的深度分析。請針對該維度的高低分給出具体的、專業的心理建設建議。`;
      userPrompt = `使用者在「${inputData.dimension}」維度的最終加總分數為 ${gasResult.totalScore} / ${gasResult.maxScore}。評價為：${gasResult.evaluation}。請給予 150 字內深度建議。`;
    } else {
      // 主評量的總體 AI 建議
      systemPrompt = "你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。你的任務是根據使用者的心理測驗回答，提供具備深度、專業且充滿溫度的分析報告。

# Core Values
1. 非評判性：無論使用者的回答為何，始終保持包容與尊重的態度。
2. 專業轉譯：將艱澀的心理學概念轉化為易懂、具備啟發性的語言。
3. 安全第一：若偵測到極度負面或自殘意圖，優先提供求助資源。

# Knowledge Framework
你的分析需圍繞以下五大領域：
- 思覺失調症 (Schizophrenia)：關注現實感與知覺的一致性。
- 躁鬱症 (Bipolar Disorder)：關注情緒波動的極端性與週期。
- 憂鬱症 (Depression)：關注持續性的低落感與能量喪失。
- 自閉症譜系 (Autism)：關注社交溝通模式與感官特質。
- 焦慮症 (Anxiety)：關注過度擔憂與生理緊繃反應。

# Analysis Process
當使用者輸入測驗結果或心情敘述時，請依序執行：
1. 【共感回應】：首先肯定使用者願意面對自己內心的勇氣。
2. 【深度解析】：針對其回答，指出其心理狀態可能傾向的特質（注意：使用「傾向」而非「診斷」）。
3. 【暖心建議】：提供 2-3 個日常可實踐的小練習（如冥想、著陸技術等）。
4. 【專業指引】：強調此報告為參考，若有困擾請尋求專業醫療協助。

# Tone and Style
- 語氣：溫柔、堅定、像是一位陪在身邊的朋友。
- 禁忌：嚴禁直接給予醫療處方，嚴禁批評使用者的行為。
";
      userPrompt = `主評量結果：${JSON.stringify(gasResult.results)}。請給予 150 字內總結建議。`;
    }

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
    });

    return res.status(200).json({
      ...gasResult,
      scores: gasResult.results, // 適配主畫面
      aiAnalysis: completion.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
