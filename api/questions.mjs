import mysql from 'mysql2/promise';

export default async function handler(req, res) {
    // 檢查環境變數是否讀取成功（用於偵錯）
    if (!process.env.TIDB_HOST) {
        return res.status(500).json({ status: 'error', message: 'Vercel 環境變數未設定' });
    }

    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DB,
        port: process.env.TIDB_PORT,
        // TiDB Serverless 必須使用 SSL
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    });

    try {
        // 執行查詢 (確保您的資料表名稱是 questions)
        const [rows] = await connection.execute('SELECT * FROM questions');
        
        // 回傳 JSON
        res.status(200).json(rows);
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        // 務必關閉連線，否則會佔用 TiDB 的連線數
        await connection.end();
    }
}
