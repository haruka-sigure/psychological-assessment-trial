export default async function handler(req, res) {
  const GAS_URL = process.env.GAS_WEB_APP_URL;
  try {
    // 呼叫 GAS 並告訴它我們要抓題目 (假設您的 GAS 有處理 action=getQuestions)
    const response = await fetch(`${GAS_URL}?action=getQuestions`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
