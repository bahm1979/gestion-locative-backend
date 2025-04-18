// backend/routes/facturesFournisseursRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');

// GET : Liste des factures fournisseurs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [results] = await db.query(`
      SELECT ff.*, f.nom AS fournisseur_nom, i.nom AS immeuble_nom
      FROM factures_fournisseurs ff
      JOIN fournisseurs f ON ff.fournisseur_id = f.id
      JOIN immeubles i ON ff.immeuble_id = i.id
    `);
    console.log('Factures renvoyées:', results);
    res.json(results);
  } catch (err) {
    console.error('Erreur dans GET /factures-fournisseurs:', err);
    res.status(500).json({ error: 'Erreur serveur lors du chargement des factures' });
  }
});

// POST : Ajouter une facture fournisseur
router.post('/', authMiddleware, async (req, res) => {
  const { fournisseur_id, immeuble_id, montant, date_emission, description } = req.body;

  if (!fournisseur_id || !immeuble_id || !montant || !date_emission) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  try {
    const db = req.app.locals.db;
    const [fournisseurs] = await db.query('SELECT id FROM fournisseurs WHERE id = ?', [fournisseur_id]);
    const [immeubles] = await db.query('SELECT id FROM immeubles WHERE id = ?', [immeuble_id]);
    if (fournisseurs.length === 0) return res.status(404).json({ error: 'Fournisseur non trouvé' });
    if (immeubles.length === 0) return res.status(404).json({ error: 'Immeuble non trouvé' });

    const [result] = await db.query(
      'INSERT INTO factures_fournisseurs (fournisseur_id, immeuble_id, montant, date_emission, description) VALUES (?, ?, ?, ?, ?)',
      [fournisseur_id, immeuble_id, montant, date_emission, description || null]
    );

    const newFacture = {
      id: result.insertId,
      fournisseur_id,
      immeuble_id,
      montant,
      date_emission,
      description: description || null,
      statut: 'non_payee',
    };
    console.log('Facture ajoutée:', newFacture);
    res.status(201).json(newFacture);
  } catch (err) {
    console.error('Erreur dans POST /factures-fournisseurs:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’ajout de la facture' });
  }
});

// PUT : Marquer une facture comme payée
router.put('/:id/payer', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { date_paiement } = req.body;

  if (!date_paiement) {
    return res.status(400).json({ error: 'Date de paiement requise' });
  }

  try {
    const db = req.app.locals.db;
    const [result] = await db.query(
      'UPDATE factures_fournisseurs SET statut = "payee", date_paiement = ? WHERE id = ?',
      [date_paiement, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Facture non trouvée' });
    }
    console.log(`Facture ${id} marquée comme payée`);
    res.json({ message: 'Facture marquée comme payée' });
  } catch (err) {
    console.error('Erreur dans PUT /factures-fournisseurs/:id/payer:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour de la facture' });
  }
});

// DELETE : Supprimer une facture
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    const [result] = await db.query('DELETE FROM factures_fournisseurs WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Facture non trouvée' });
    }
    console.log(`Facture ${id} supprimée`);
    res.status(204).send();
  } catch (err) {
    console.error('Erreur dans DELETE /factures-fournisseurs/:id:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de la facture' });
  }
});

module.exports = router;