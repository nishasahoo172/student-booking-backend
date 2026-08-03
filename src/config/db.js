import mysql from "mysql2/promise";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  // ✅ critical for timezone correctness
  timezone: "Z",
  // timezone: "+05:30",
  // ✅ return DATETIME as string so we can parse safely
  dateStrings: true,

  connectionLimit: 10,
});

export default db;
