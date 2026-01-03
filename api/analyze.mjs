import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const { inputData } = req.body;

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel(
      { model: "gemini-1.5-flash" },
      { apiVersion: 'v1' }
    );

    const prompt = "請簡短分析這組數據：" + JSON.stringify(inputData);
    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    return res.status(200).json({
      status: 'success',
      aiAnalysis: aiText
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
