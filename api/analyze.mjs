import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('只支援 POST');

  const GAS_URL = process.env.GAS_WEB_APP_URL;
  const { inputData } = req.body; // 這是前端傳來的 JSON 答案

  try {
    // 1. 轉發給 GAS 算分與存檔
    // 注意：GAS 的 e.parameter.data 期待的是字串化後的 JSON
    const gasResponse = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: JSON.stringify(inputData) })
    });

    const gasResult = await gasResponse.json();

    if (gasResult.status === 'error') throw new Error(gasResult.message);

    // 2. 只有主問卷（有 results 且不是詳細評量）才呼叫 AI
    let aiText = "";
    if (gasResult.results && !inputData.assessmentType) {
      const completion = await openai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "你是一位暖心的心理諮商師。請根據分數結果給予 150 字內的建議，語氣要溫柔。" },
          { role: "user", content: `分數結果：${JSON.stringify(gasResult.results)}` }
        ],
      });
      aiText = completion.choices[0].message.content;
    }

    // 3. 統一回傳給前端
    // 💥 這裡做了一個關鍵映射：將 GAS 的 results 映射到前端期待的 scores 欄位
    return res.status(200).json({
      ...gasResult,
      scores: gasResult.results, // 適配您 survey.html 中的 data.scores
      aiAnalysis: aiText
    });

  } catch (error) {
    console.error("API 錯誤:", error);
    res.status(500).json({ status: 'error', message: error.message });
  }
}
