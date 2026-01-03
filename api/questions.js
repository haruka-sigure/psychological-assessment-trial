// api/questions.js
export default async function handler(req, res) {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwQ7ZM8VAKFVRoOU-l2wrTLwUn5cF1Z7Vwl-6aZe73gxrKlyW8M77iBDMymQMSB3QEVKA/exec";

  try {
    const response = await fetch(GAS_URL, {
        method: 'GET',
        redirect: 'follow'
    });
    
    // 如果 GAS 回傳的是 HTML 錯誤頁面，這裡會報錯
    const data = await response.json();
    
    // 將 GAS 抓到的題目回傳給前端
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ status: 'error', message: "無法從 GAS 抓取題目: " + error.message });
  }
}
