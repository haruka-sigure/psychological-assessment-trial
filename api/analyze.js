import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // 使用您指定的模型與思考配置
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-thinking-exp-01-21", // 建議使用最新的思考模型
    systemInstruction: "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」...\n(這裡請貼入您完整的專家指令文案)"
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
