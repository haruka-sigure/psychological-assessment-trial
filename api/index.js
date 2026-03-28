const functions = require('@google-cloud/functions-framework');
const cors = require('cors')({ origin: true });

// 定義變數
let questionsHandler, analyzeHandler;

try {
    // 引入檔案
    const qRaw = require('./questions');
    const aRaw = require('./analyze');

    // 格式相容性處理 (同時支援 module.exports = function 和 export default)
    questionsHandler = qRaw.default || qRaw;
    analyzeHandler = aRaw.default || aRaw;

    console.log("Handlers loaded successfully.");
} catch (e) {
    // 如果引入失敗，這裡會噴出詳細原因
    console.error("Critical Error: Failed to load handlers!", e);
}

functions.http('mainHandler', async (req, res) => {
    return cors(req, res, async () => {
        const path = req.path;
        console.log(`Processing request: ${req.method} ${path}`);

        try {
            // 檢查 Handler 是否成功載入
            if (!questionsHandler || !analyzeHandler) {
                throw new Error("Handlers not initialized properly.");
            }

            if (path === '/questions' || path === '/api/questions') {
                await questionsHandler(req, res);
            } else if (path === '/analyze' || path === '/api/analyze') {
                await analyzeHandler(req, res);
            } else {
                res.status(200).send('API is running. Path: ' + path);
            }
        } catch (err) {
            console.error('Runtime Error:', err);
            res.status(500).json({ error: err.message });
        }
    });
});