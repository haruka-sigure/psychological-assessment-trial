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

            finalResults.push({
                dimension: dim,
                score: totalScore,
                evaluation: match ? match.evaluation : "未知",
                maxScore: match ? match.maxscore : 20 // 根據資料庫設定或給預設
            });
        } else {
            // 主問卷：處理所有出現在題目中的維度
            finalResults = Object.keys(dimensionScores).map(dim => {
                const score = dimensionScores[dim];
                const match = criteria.find(c => 
                    c.dimension === dim && score >= c.minscore && score <= c.maxscore
                );
                return {
                    dimension: dim,
                    score: score,
                    evaluation: match ? match.evaluation : "未知",
                    maxScore: match ? match.maxscore : 12
                };
            });
        }

        let systemPrompt = "";
        let userPrompt = "";
    if (inputData.assessmentType === 'detail') {
      // 深度評量的專屬 AI 建議
      systemPrompt = `你是一位資深的心理諮商專家，現在正在進行「${res.dimension}」的深度分析。請針對該維度的高低分給出具体的、專業的心理建設建議。`;
      userPrompt = `使用者在「${res.dimension}」維度的最終加總分數為 ${res.score} / ${res.maxScore}。評價為：${res.evaluation}。請給予 150 字內深度建議。`;
    } else {
      // 主評量的總體 AI 建議
      systemPrompt = "# Role\n你是一位具備臨床心理學背景與共感能力的「暖心心理諮詢導師」。你的任務是根據使用者的心理測驗回答，提供具備深度、專業且充滿溫度的分析報告。\n\n# Core Values\n1. 非評判性：無論使用者的回答為何，始終保持包容與尊重的態度。\n2. 專業轉譯：將艱澀的心理學概念轉化為易懂、具備啟發性的語言。\n3. 安全第一：若偵測到極度負面或自殘意圖，優先提供求助資源。\n\n# Knowledge Framework\n你的分析需圍繞以下五大領域：\n- 思覺失調症 (Schizophrenia)：關注現實感與知覺的一致性。\n- 躁鬱症 (Bipolar Disorder)：關注情緒波動的極端性與週期。\n- 憂鬱症 (Depression)：關注持續性的低落感與能量喪失。\n- 自閉症譜系 (Autism)：關注社交溝通模式與感官特質。\n- 焦慮症 (Anxiety)：關注過度擔憂與生理緊繃反應。\n\n# Analysis Process\n當使用者輸入測驗結果或心情敘述時，請依序執行：\n1. 【共感回應】：首先肯定使用者願意面對自己內心的勇氣。\n2. 【深度解析】：針對其回答，指出其心理狀態可能傾向的特質（注意：使用「傾向」而非「診斷」）。\n3. 【暖心建議】：提供 2-3 個日常可實踐的小練習（如冥想、著陸技術等）。\n4. 【專業指引】：強調此報告為參考，若有困擾請尋求專業醫療協助。\n\n# Tone and Style\n- 語氣：溫柔、堅定、像是一位陪在身邊的朋友。\n- 禁忌：嚴禁直接給予醫療處方，嚴禁批評使用者的行為。";
      userPrompt = `主評量結果：${JSON.stringify(finalResults)}。請給予 150 字內總結建議。`;
    }

    const completion = await openai.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
        });

        const aiAnalysis = completion.choices[0].message.content;

        // 6. 寫入 assessment_logs (存檔)
        await connection.execute(
            'INSERT INTO assessment_logs (assessment_type, dimension, total_score, evaluation, ai_advice) VALUES (?, ?, ?, ?, ?)',
            [
                currentSub, 
                isDetail ? inputData.dimension : 'All', 
                isDetail ? finalResults[0].score : 0, 
                isDetail ? finalResults[0].evaluation : 'N/A', 
                aiAnalysis
            ]
        );

        // 7. 回傳結果 (對應您的前端期待)
        res.status(200).json({
            status: isDetail ? 'detail_success' : 'success',
            results: finalResults, // 對應主畫面的 scores
            scores: finalResults,  // 多存一個 key 確保前端相容
            aiAnalysis: aiAnalysis,
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
