const OpenAI = require("openai");

module.exports = async function handler(req, res) {
    // GCP Functions 建議手動處理簡單的 Method 過濾
　　const mysql = require('mysql2/promise');
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const openai = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
    });

    const { inputData } = req.body;
    if (!inputData) {
        return res.status(400).json({ status: 'error', message: 'Missing inputData' });
    }

    const isDetail = inputData.assessmentType === 'detail';
    const currentSub = isDetail ? 'Detail' : 'Main';

    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DB,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        // 1. 取得題目資料
        const [questions] = await connection.execute(
            'SELECT qid, dimension FROM questions WHERE subassessment = ?',
            [currentSub]
        );

        // 2. 計算各維度總分
        const dimensionScores = {};
        questions.forEach(q => {
            const val = inputData[q.qid];
            if (val !== undefined) {
                dimensionScores[q.dimension] = (dimensionScores[q.dimension] || 0) + parseInt(val);
            }
        });

        // 3. 取得評分標準
        const [criteria] = await connection.execute(
            'SELECT * FROM assessment_criteria WHERE subassessment = ?',
            [currentSub]
        );

        // 4. 判定等級與組裝結果
        let finalResults = [];
        
        if (isDetail) {
            const dim = inputData.dimension;
            const score = dimensionScores[dim] || 0;
            const totalScore = score + (parseInt(inputData.mainScore) || 0);
            
            const match = criteria.find(c => 
                c.dimension === dim && totalScore >= c.minscore && totalScore <= c.maxscore
            );
            const absoluteMax = Math.max(...criteria.filter(c => c.dimension === dim).map(c => c.maxscore));

            finalResults.push({
                dimension: dim,
                score: totalScore,
                evaluation: match ? match.evaluation : "未知",
                maxScore: absoluteMax
            });
        } else {
            finalResults = Object.keys(dimensionScores).map(dim => {
                const score = dimensionScores[dim];
                const match = criteria.find(c => 
                    c.dimension === dim && score >= c.minscore && score <= c.maxscore
                );
                const absoluteMax = Math.max(...criteria.filter(c => c.dimension === dim).map(c => c.maxscore));
                return {
                    dimension: dim,
                    score: score,
                    evaluation: match ? match.evaluation : "未知",
                    maxScore: absoluteMax 
                };
            });
        }

        // 5. 生成按鈕邏輯
        let buttons = [];
        if (!isDetail) {
            buttons = finalResults
                .filter(r => r.evaluation.includes('高') || r.evaluation.includes('中') || r.evaluation.includes('需關注'))
                .map(r => ({
                    label: `深度了解「${r.dimension}」`,
                    dimension: r.dimension
                }));
        }

        // 6. AI 建議生成
        let systemPrompt = "";
        let userPrompt = "";

        if (isDetail) {
            const currentRes = finalResults[0];
            systemPrompt = `你是一位資深的心理諮商專家，現在正在進行「${currentRes.dimension}」的深度分析。請針對該維度的高低分給出具体的、專業的心理建設建議。`;
            userPrompt = `使用者在「${currentRes.dimension}」維度的最終加總分數為 ${currentRes.score} / ${currentRes.maxScore}。評價為：${currentRes.evaluation}。請給予 150 字內深度建議。`;
        } else {
            systemPrompt = "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。..."; // 這裡保持你原本長長的 System Prompt
            const summary = finalResults.map(r => `${r.dimension}: ${r.score}分(${r.evaluation})`).join(', ');
            userPrompt = `主評量結果如下：${summary}。請針對這些維度的整體表現，提供 150 字內的暖心總結建議。`;
        }

        const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
        });

        const aiAnalysis = completion.choices[0].message.content;

        // 7. 準備存入資料庫
        let logScoreDisplay = isDetail 
            ? finalResults[0].score.toString() 
            : finalResults.map(r => `${r.dimension}: ${r.score}`).join(', ');
        
        try {
            await connection.execute(
                'INSERT INTO assessment_logs (assessment_type, dimension, total_score, evaluation, ai_advice) VALUES (?, ?, ?, ?, ?)',
                [
                    currentSub, 
                    isDetail ? inputData.dimension : 'All', 
                    logScoreDisplay,
                    isDetail ? finalResults[0].evaluation : 'Multi',
                    aiAnalysis
                ]
            );
        } catch (dbErr) {
            console.error("資料庫紀錄失敗:", dbErr);
        }

        // 8. 回傳
        res.status(200).json({
            status: isDetail ? 'detail_success' : 'success',
            results: finalResults, 
            scores: finalResults,  
            aiAnalysis: aiAnalysis,
            buttons: buttons,
            dimension: isDetail ? inputData.dimension : null,
            totalScore: isDetail ? finalResults[0].score : null,
            maxScore: isDetail ? finalResults[0].maxScore : null,
            evaluation: isDetail ? finalResults[0].evaluation : null
        });

    } catch (error) {
        console.error("Analyze API Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await connection.end();
    }
};