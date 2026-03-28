const functions = require('@google-cloud/functions-framework');
const cors = require('cors')({ origin: true });

// 這裡是關鍵：加上 try-catch 確保引入檔案時出錯能顯示在日誌裡
// 在 index.js 裡修改引入方式
let questionsHandlerRaw = require('./questions');
let analyzeHandlerRaw = require('./analyze');

// 如果抓到的是物件且裡面有 default，就取用 default
const questionsHandler = questionsHandlerRaw.default || questionsHandlerRaw;
const analyzeHandler = analyzeHandlerRaw.default || analyzeHandlerRaw;
try {
    questionsHandler = require('./questions'); 
    analyzeHandler = require('./analyze');
} catch (e) {
    console.error("Critical Error: Failed to load handlers!", e);
}

functions.http('mainHandler', async (req, res) => {
    return cors(req, res, async () => {
        const path = req.path;
        console.log(`Processing request: ${req.method} ${path}`);

        try {
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