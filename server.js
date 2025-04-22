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

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'Uploads/avatars'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.fieldname}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const valid = filetypes.test(path.extname(file.originalname).toLowerCase()) && filetypes.test(file.mimetype);
    valid ? cb(null, true) : cb(new Error('Seules les images JPEG/PNG sont autorisées'));
  }
});

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

// … + toutes tes autres routes telles que `/depenses`, `/comptabilite`, `/auth/update-profile`, etc. (déjà bien posées dans ton code)

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => res.json({ message: 'Bienvenue sur l\'API de Gestion Locative v3' }));

app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  if (err.message === 'Seules les images JPEG/PNG sont autorisées') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
}

startServer();
