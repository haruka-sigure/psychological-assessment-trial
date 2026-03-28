const functions = require('@google-cloud/functions-framework');
const cors = require('cors')({ origin: true });

// 這裡是關鍵：加上 try-catch 確保引入檔案時出錯能顯示在日誌裡
let questionsHandler, analyzeHandler;
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