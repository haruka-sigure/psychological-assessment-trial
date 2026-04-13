const functions = require('@google-cloud/functions-framework');
const cors = require('cors')({ origin: true });

// 將引入邏輯放入 Handler 內，或者確保匯出格式正確
const questions = require('./questions');
const analyze = require('./analyze');

functions.http('mainHandler', async (req, res) => {
    // 1. 強制處理 CORS
    return cors(req, res, async () => {
        const path = req.path;
        console.log(`Processing request: ${req.method} ${path}`);

        try {
            // 2. 根據路徑分流，並確保呼叫的是函式
            // 如果你的 questions.js 是 module.exports = async function...
            // 那麼引入後的變數本身就是 function
            
            if (path === '/questions' || path === '/api/questions') {
                const handler = questions.default || questions;
                if (typeof handler !== 'function') throw new Error("questionsHandler is not a function");
                await handler(req, res);
            } 
            else if (path === '/analyze' || path === '/api/analyze') {
                const handler = analyze.default || analyze;
                if (typeof handler !== 'function') throw new Error("analyzeHandler is not a function");
                await handler(req, res);
            } 
            else {
                res.status(200).send('API is running. Service: Online');
            }
        } catch (err) {
            console.error('Runtime Error:', err.stack); // 使用 .stack 可以看到更詳細的報錯行數
            res.status(500).json({ 
                error: "Internal Server Error",
                message: err.message 
            });
        }
    });
});