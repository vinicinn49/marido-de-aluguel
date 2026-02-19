const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();

// --- AJUSTE PARA DEPLOY: CAMINHO DO BANCO ---
const dbPath = path.resolve(__dirname, 'database', 'database.db');
const db = new sqlite3.Database(dbPath);

// Configurações
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'chave-secreta-marido',
    resave: false,
    saveUninitialized: false
}));

// Inicialização do Banco de Dados
db.serialize(async () => {
    // Tabela de Pedidos
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL,
        problema TEXT NOT NULL,
        status TEXT DEFAULT 'Pendente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela Admin e Usuário Padrão
    db.run(`CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY, user TEXT, pass TEXT)`);
    
    const hash = await bcrypt.hash('admin123', 10);
    db.get("SELECT * FROM admin WHERE user = 'admin'", (err, row) => {
        if (!row) db.run("INSERT INTO admin (user, pass) VALUES (?, ?)", ['admin', hash]);
    });
});

// Middleware de Autenticação
const auth = (req, res, next) => {
    if (req.session.isLoggedIn) return next();
    res.redirect('/login');
};

// --- ROTAS CLIENTE ---
app.get('/', (req, res) => res.render('index', { success: req.query.success }));

app.post('/enviar-pedido', (req, res) => {
    const { nome, telefone, problema } = req.body;
    db.run("INSERT INTO pedidos (nome, telefone, problema) VALUES (?, ?, ?)", 
    [nome, telefone, problema], () => {
        res.redirect('/?success=1');
    });
});

// --- ROTAS ADMIN ---
app.get('/login', (req, res) => res.render('login', { error: req.query.error }));

app.post('/login', (req, res) => {
    const { user, pass } = req.body;
    db.get("SELECT * FROM admin WHERE user = ?", [user], async (err, row) => {
        if (row && await bcrypt.compare(pass, row.pass)) {
            req.session.isLoggedIn = true;
            res.redirect('/admin');
        } else {
            res.redirect('/login?error=1');
        }
    });
});

app.get('/admin', auth, (req, res) => {
    const filter = req.query.status || '%';
    db.all("SELECT * FROM pedidos WHERE status LIKE ? ORDER BY created_at DESC", [filter], (err, rows) => {
        res.render('admin', { pedidos: rows, filter });
    });
});

app.post('/admin/status', auth, (req, res) => {
    const { id, status } = req.body;
    db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], () => {
        res.redirect('/admin');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// --- AJUSTE PARA DEPLOY: PORTA DINÂMICA ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('------------------------------------------');
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log('🚀 Pronto para receber orçamentos!');
    console.log('------------------------------------------');
});