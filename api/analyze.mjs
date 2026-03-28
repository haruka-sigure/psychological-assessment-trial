import OpenAI from "openai";
import mysql from 'mysql2/promise';

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { inputData } = req.body;
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
        // 1. 取得所有題目資料 (過濾當前問卷類型)
        const [questions] = await connection.execute(
            'SELECT qid, dimension FROM questions WHERE subassessment = ?',
            [currentSub]
        );

        // 2. 計算各維度總分
        // 假設前端傳來的資料格式為 { Q1: 3, Q2: 2, dimension: "情緒", ... }
        const dimensionScores = {};
        questions.forEach(q => {
            const val = inputData[q.qid];
            if (val !== undefined) {
                dimensionScores[q.dimension] = (dimensionScores[q.dimension] || 0) + parseInt(val);
            }
        });

        // 3. 取得評分標準 (過濾當前問卷類型)
        const [criteria] = await connection.execute(
            'SELECT * FROM assessment_criteria WHERE subassessment = ?',
            [currentSub]
        );

        // 4. 判定等級 (Evaluation) 與 組裝結果
        // 如果是詳細問卷，我們只關心該維度；如果是主問卷，則跑遍所有維度
        let finalResults = [];
        
        if (isDetail) {
            const dim = inputData.dimension;
            const score = dimensionScores[dim] || 0;
            // 這裡加入主問卷傳過來的分數 (mainScore) 如果有的話
            const totalScore = score + (parseInt(inputData.mainScore) || 0);
            
            const match = criteria.find(c => 
                c.dimension === dim && totalScore >= c.minscore && totalScore <= c.maxscore
            );
            // 💥 修正：找出該維度的「绝对最大值」而不是「區間上限」
            const absoluteMax = Math.max(...criteria.filter(c => c.dimension === dim).map(c => c.maxscore));

            finalResults.push({
                dimension: dim,
                score: totalScore,
                evaluation: match ? match.evaluation : "未知",
                maxScore: absoluteMax // 使用該維度的最高分 (例如 24)
            });
        } else {
            // 主問卷：處理所有出現在題目中的維度
            finalResults = Object.keys(dimensionScores).map(dim => {
                const score = dimensionScores[dim];
                const match = criteria.find(c => 
                    c.dimension === dim && score >= c.minscore && score <= c.maxscore
                );
                // 💥 修正：找出該維度在主問卷中的「绝对最大值」 (例如 12)
                const absoluteMax = Math.max(...criteria.filter(c => c.dimension === dim).map(c => c.maxscore));
                return {
                    dimension: dim,
                    score: score,
                    evaluation: match ? match.evaluation : "未知",
                    maxScore: absoluteMax 
                };
            });
        }

        // 💥 新增：生成按鈕邏輯 (主問卷時才需要)
        let buttons = [];
        if (!isDetail) {
            buttons = finalResults
                .filter(r => r.evaluation.includes('高') || r.evaluation.includes('中') || r.evaluation.includes('需關注'))
                .map(r => ({
                    label: `深度了解「${r.dimension}」`,
                    dimension: r.dimension
                }));
        }

        let systemPrompt = "";
        let userPrompt = "";

        if (isDetail) {
            // 💥 修正：改用 finalResults[0] 而不是不存在的 res
            const currentRes = finalResults[0];
            systemPrompt = `你是一位資深的心理諮商專家，現在正在進行「${currentRes.dimension}」的深度分析。請針對該維度的高低分給出具体的、專業的心理建設建議。`;
            userPrompt = `使用者在「${currentRes.dimension}」維度的最終加總分數為 ${currentRes.score} / ${currentRes.maxScore}。評價為：${currentRes.evaluation}。請給予 150 字內深度建議。`;
        } else {
            systemPrompt = "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。你的任務是根據使用者的心理測驗回答，提供具備深度、專業且充滿溫度的分析報告。\n\n# Core Values\n1. 非評判性：無論使用者的回答為何，始終保持包容與尊重的態度。\n2. 專業轉譯：將艱澀的心理學概念轉化為易懂、具備啟發性的語言。\n3. 安全第一：若偵測到極度負面或自殘意圖，優先提供求助資源。\n\n# Knowledge Framework\n你的分析需圍繞以下五大領域：\n- 思覺失調症 (Schizophrenia)：關注現實感與知覺的一致性。\n- 躁鬱症 (Bipolar Disorder)：關注情緒波動的極端性與週期。\n- 憂鬱症 (Depression)：關注持續性的低落感與能量喪失。\n- 自閉症譜系 (Autism)：關注社交溝通模式與感官特質。\n- 焦慮症 (Anxiety)：關注過度擔憂與生理緊繃反應。\n\n# Analysis Process\n當使用者輸入測驗結果或心情敘述時，請依序執行：\n1. 【共感回應】：首先肯定使用者願意面對自己內心的勇氣。\n2. 【深度解析】：針對其回答，指出其心理狀態可能傾向的特質（注意：使用「傾向」而非「診斷」）。\n3. 【暖心建議】：提供 2-3 個日常可實踐的小練習（如冥想、著陸技術等）。\n4. 【專業指引】：強調此報告為參考，若有困擾請尋求專業醫療協助。\n\n# Tone and Style\n- 語氣：溫柔、堅定、像是一位陪在身邊的朋友。\n- 禁忌：嚴禁直接給予醫療處方，嚴禁批評使用者的行為。"; // 保持您的長 Prompt
            // 💥 修正：將物件轉為文字，AI 閱讀更準確
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

        // 💥 新增：準備存入資料庫的分數文字
        let logScoreDisplay = "";
        if (isDetail) {
            // 詳細問卷：直接存數字字串
            logScoreDisplay = finalResults[0].score.toString();
        } else {
            // 主問卷：彙整成「類別: 分數」格式，方便直接檢視
            // 範例結果：憂鬱: 5, 焦慮: 3, 思覺失調: 2 ...
            logScoreDisplay = finalResults
                .map(r => `${r.dimension}: ${r.score}`)
                .join(', ');
        }
        
        // 6. 寫入 assessment_logs
        try {
            await connection.execute(
                'INSERT INTO assessment_logs (assessment_type, dimension, total_score, evaluation, ai_advice) VALUES (?, ?, ?, ?, ?)',
                [
                    currentSub, 
                    isDetail ? inputData.dimension : 'All', 
                    logScoreDisplay, // 💥 這裡存入剛才格式化好的文字
                    isDetail ? finalResults[0].evaluation : 'Multi', // 主問卷存 Multi 或綜合評價
                    aiAnalysis
                ]
            );
        } catch (dbErr) {
            console.error("資料庫紀錄失敗:", dbErr);
        }

        // 7. 回傳結果 (確保包含 buttons)
        res.status(200).json({
            status: isDetail ? 'detail_success' : 'success',
            results: finalResults, 
            scores: finalResults,  
            aiAnalysis: aiAnalysis,
            buttons: buttons, // 💥 補上這個前端才會出按鈕
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
}
