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
      systemPrompt = "你是一位暖心的心理諮商師。請根據多個維度的篩檢結果給予整體的心理健康鼓勵。";
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
