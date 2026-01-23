import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DB,
    port: process.env.TIDB_PORT,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true 
         rejectUnauthorized: true,
    // 如果報錯，嘗試移除 rejectUnauthorized 或使用特定 CA
    }
  });

  try {
    const [rows] = await connection.execute('SELECT * FROM questions ORDER BY sort_order ASC');
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  } finally {
    await connection.end();
  }
}
