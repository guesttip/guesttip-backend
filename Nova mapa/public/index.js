
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    payment_method TEXT,
    payment_info TEXT,
    code TEXT UNIQUE,
    qr_link TEXT
  )
`, err => {
  if (err) console.error("DB Init Error:", err);
});

app.post('/register', async (req, res) => {
  const { name, password, email, payment_method, payment_info } = req.body;
  const code = name.replace(/\s+/g, '').toLowerCase() + '_' + Math.floor(Math.random() * 1000000);
  const qr_link = `guesttip_tip.html?code=${code}`;
  try {
    await pool.query(
      'INSERT INTO users (name, password, email, payment_method, payment_info, code, qr_link) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [name, password, email, payment_method, payment_info, code, qr_link]
    );
    res.status(201).json({ message: "User registered", code, qr_link });
  } catch (err) {
    res.status(400).json({ error: "User exists or DB error", details: err.message });
  }
});

app.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1 AND password = $2', [name, password]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ message: "Login successful", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "DB error", details: err.message });
  }
});

app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    const users = {};
    result.rows.forEach(u => users[u.name] = u);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "DB error", details: err.message });
  }
});

app.get('/user/:code', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE code = $1', [req.params.code]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "DB error", details: err.message });
  }
});

app.delete('/user/:code', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE code = $1', [req.params.code]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete error", details: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ GuestTip PostgreSQL server running on http://localhost:${PORT}`));
