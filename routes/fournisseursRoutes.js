// backend/routes/fournisseursRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');

// GET : Liste des fournisseurs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [fournisseurs] = await db.query('SELECT * FROM fournisseurs');
    console.log('Fournisseurs renvoyés:', fournisseurs);
    res.json(fournisseurs);
  } catch (err) {
    console.error('Erreur dans GET /fournisseurs:', err);
    res.status(500).json({ error: 'Erreur serveur lors du chargement des fournisseurs' });
  }
});

// POST : Ajouter un fournisseur
router.post('/', authMiddleware, async (req, res) => {
  const { nom, contact, type_service } = req.body;

  if (!nom || !type_service) {
    return res.status(400).json({ error: 'Le nom et le type de service sont obligatoires' });
  }

  try {
    const db = req.app.locals.db;
    const [result] = await db.query(
      'INSERT INTO fournisseurs (nom, contact, type_service) VALUES (?, ?, ?)',
      [nom, contact || null, type_service]
    );

    const newFournisseur = {
      id: result.insertId,
      nom,
      contact: contact || null,
      type_service,
    };
    console.log('Fournisseur ajouté:', newFournisseur);
    res.status(201).json(newFournisseur);
  } catch (err) {
    console.error('Erreur dans POST /fournisseurs:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’ajout du fournisseur' });
  }
});

// PUT : Modifier un fournisseur
router.put('/:id', authMiddleware, async (req, res) => {
  const { nom, contact, type_service } = req.body;
  const { id } = req.params;

  if (!nom || !type_service) {
    return res.status(400).json({ error: 'Le nom et le type de service sont obligatoires' });
  }

  try {
    const db = req.app.locals.db;
    const [result] = await db.query(
      'UPDATE fournisseurs SET nom = ?, contact = ?, type_service = ? WHERE id = ?',
      [nom, contact || null, type_service, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    console.log(`Fournisseur ${id} mis à jour`);
    res.json({ message: 'Fournisseur mis à jour' });
  } catch (err) {
    console.error('Erreur dans PUT /fournisseurs/:id:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du fournisseur' });
  }
});

// DELETE : Supprimer un fournisseur
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    const [result] = await db.query('DELETE FROM fournisseurs WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    console.log(`Fournisseur ${id} supprimé`);
    res.status(204).send();
  } catch (err) {
    console.error('Erreur dans DELETE /fournisseurs/:id:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression du fournisseur' });
  }
});

module.exports = router;