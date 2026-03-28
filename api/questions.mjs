const mysql = require('mysql2/promise');

module.exports = async function handler(req, res) {
    // 建立連線
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DB,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

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