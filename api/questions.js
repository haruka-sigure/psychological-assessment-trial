const mysql = require('mysql2/promise');

module.exports = async function(req, res) {
　// 建議使用 Pool 模式，並確認前綴
　const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  // 注意：TiDB 的 User 通常長這樣：'xxxxxx.root'
  user: process.env.TIDB_USER, 
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DB_NAME,
  port: 4000,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true // GCP 環境建議開啟安全檢查
  }
});

// 修正匯出方式，確保它是一個非同步函式
module.exports = async function(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM questions');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).send('Internal Server Error');
  }
};

    try {
        const { type, dim } = req.query; 

        let sql = 'SELECT * FROM questions';
        let params = [];

        if (type && dim) {
            sql += ' WHERE subassessment = ? AND dimension = ?';
            params.push(type, dim);
        } else if (type) {
            sql += ' WHERE subassessment = ?';
            params.push(type);
        } else if (dim) {
            sql += ' WHERE dimension = ?';
            params.push(dim);
        }

        sql += ' ORDER BY qid ASC';

        const [rows] = await connection.execute(sql, params);
        res.status(200).json(rows);

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    } finally {
        await connection.end();
    }
};