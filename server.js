const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const biensRoutes = require('./routes/biensRoutes');
const locatairesRoutes = require('./routes/locatairesRoutes');
const paiementsRoutes = require('./routes/paiementsRoutes');
const contratsRoutes = require('./routes/contratsRoutes');
const villesRoutes = require('./routes/villesRoutes');
const etagesRoutes = require('./routes/etagesRoutes');
const appartementsRoutes = require('./routes/appartementsRoutes');
const fournisseurRoutes = require('./routes/fournisseursRoutes');
const facturesFournisseursRoutes = require('./routes/facturesFournisseursRoutes');
const { authMiddleware } = require('./middleware/authMiddleware');

// Initialisation d'Express
const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://gestion-locative-frontend.onrender.com'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir les fichiers statiques pour les avatars
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de Multer pour l’upload des avatars
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Uploads/avatars'); // Dossier où les avatars seront stockés
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Seules les images JPEG/PNG sont autorisées'));
  }
});

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestion_locative_v3'
};

async function connectDB() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Base de données connectée');
    app.locals.db = connection;
    return connection;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    process.exit(1);
  }
}

// Routes
app.use('/auth', authRoutes);
app.use('/biens', authMiddleware, biensRoutes);
app.use('/locataires', authMiddleware, locatairesRoutes);
app.use('/paiements', authMiddleware, paiementsRoutes);
app.use('/contrats', authMiddleware, contratsRoutes);
app.use('/villes', authMiddleware, villesRoutes);
app.use('/etages', authMiddleware, etagesRoutes);
app.use('/appartements', authMiddleware, appartementsRoutes);
app.use('/fournisseurs', authMiddleware, fournisseurRoutes);
app.use('/factures-fournisseurs', authMiddleware, facturesFournisseursRoutes);

// Routes pour la comptabilité
app.get('/comptabilite', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [revenus] = await db.query('SELECT SUM(montant) as total FROM paiements WHERE est_paye = 1');
    const [depenses] = await db.query('SELECT SUM(montant) as total FROM depenses WHERE statut = "payee"');
    const totalRevenus = revenus[0].total || 0;
    const totalDepenses = depenses[0].total || 0;
    const bilan = totalRevenus - totalDepenses;

    res.json({
      revenus: totalRevenus,
      depenses: totalDepenses,
      bilan
    });
  } catch (err) {
    console.error('Erreur lors du calcul du bilan:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/depenses', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(`
      SELECT d.*, f.nom as fournisseur_nom, i.nom as immeuble_nom
      FROM depenses d
      LEFT JOIN factures_fournisseurs ff ON d.facture_fournisseur_id = ff.id
      LEFT JOIN fournisseurs f ON ff.fournisseur_id = f.id
      LEFT JOIN immeubles i ON ff.immeuble_id = i.id
    `);
    const formattedRows = rows.map(row => ({
      ...row,
      montant: Number(row.montant)
    }));
    res.json(formattedRows);
  } catch (err) {
    console.error('Erreur lors de la récupération des dépenses:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/depenses', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { type, montant, date_emission, description, facture_fournisseur_id } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO depenses (type, montant, date_emission, description, facture_fournisseur_id) VALUES (?, ?, ?, ?, ?)',
      [type, montant, date_emission, description || null, facture_fournisseur_id || null]
    );
    res.status(201).json({ id: result.insertId, ...req.body, montant: Number(montant) });
  } catch (err) {
    console.error('Erreur lors de l’ajout de la dépense:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/depenses/:id/payer', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const { date_paiement } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE depenses SET statut = "payee", date_paiement = ? WHERE id = ?',
      [date_paiement, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }
    res.json({ message: 'Dépense marquée comme payée' });
  } catch (err) {
    console.error('Erreur lors du paiement de la dépense:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/depenses/:id', authMiddleware, async (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM depenses WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }
    res.json({ message: 'Dépense supprimée' });
  } catch (err) {
    console.error('Erreur lors de la suppression de la dépense:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mise à jour du profil
app.put('/auth/update-profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.user.id;
  const { nom, email } = req.body;
  let avatarUrl = req.user.avatar;

  try {
    if (req.file) {
      avatarUrl = `/uploads/avatars/${req.file.filename}`;
    }

    const [result] = await db.execute(
      'UPDATE users SET nom = ?, email = ?, avatar = ? WHERE id = ?',
      [nom || req.user.nom, email || req.user.email, avatarUrl || null, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const [rows] = await db.execute('SELECT id, nom, email, role, avatar FROM users WHERE id = ?', [userId]);
    const updatedUser = rows[0];

    console.log('Profil mis à jour:', updatedUser);
    res.json(updatedUser);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour' });
  }
});

// Health check pour Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Route d'accueil
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur l\'API de Gestion Locative v3' });
});

// Middleware pour les routes non trouvées
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  if (err.message === 'Seules les images JPEG/PNG sont autorisées') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  });
}

startServer();