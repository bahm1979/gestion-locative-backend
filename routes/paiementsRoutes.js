const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
require("dotenv").config();

// Configurer Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Formatage des nombres (ex. 5 000 000 GNF)
const formatNumber = (value) => {
  return value.toLocaleString("fr-FR") + " GNF";
};

// Formatage des dates (ex. 30 avril 2025)
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// GET /paiements - Liste tous les paiements
router.get("/", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [paiements] = await db.query(`
      SELECT p.id, p.contrat_id, p.montant, p.date_paiement, p.est_paye,
             c.appartement_id, c.locataire_id, l.nom AS locataire_nom
      FROM paiements p
      LEFT JOIN contrats c ON p.contrat_id = c.id
      LEFT JOIN locataires l ON c.locataire_id = l.id
    `);
    console.log("Paiements renvoyés:", paiements);
    res.json(paiements);
  } catch (err) {
    console.error("Erreur dans GET /paiements:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des paiements" });
  }
});

// GET /paiements/impayes - Liste des impayés
router.get("/impayes", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [impayes] = await db.query(`
      SELECT p.id, p.contrat_id, p.montant, p.date_paiement, p.est_paye,
             c.appartement_id, c.locataire_id, l.nom AS locataire_nom
      FROM paiements p
      LEFT JOIN contrats c ON p.contrat_id = c.id
      LEFT JOIN locataires l ON c.locataire_id = l.id
      WHERE p.est_paye = FALSE
    `);
    console.log("Impayés renvoyés:", impayes);
    res.json(impayes);
  } catch (err) {
    console.error("Erreur dans GET /paiements/impayes:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des impayés" });
  }
});

// GET /paiements/stats - Statistiques mensuelles des paiements
router.get("/stats", async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [stats] = await db.query(`
      SELECT 
        DATE_FORMAT(date_paiement, '%Y-%m') AS mois,
        SUM(montant) AS total,
        COUNT(*) AS nombre_paiements,
        SUM(CASE WHEN est_paye = TRUE THEN montant ELSE 0 END) AS total_paye,
        SUM(CASE WHEN est_paye = FALSE THEN montant ELSE 0 END) AS total_impaye
      FROM paiements
      GROUP BY mois
      ORDER BY mois ASC
    `);
    const formattedStats = stats.map(row => ({
      mois: row.mois,
      total: Number(row.total),
      nombre_paiements: Number(row.nombre_paiements),
      total_paye: Number(row.total_paye),
      total_impaye: Number(row.total_impaye),
    }));
    console.log("Stats renvoyées:", formattedStats);
    res.json(formattedStats);
  } catch (err) {
    console.error("Erreur dans GET /paiements/stats:", err);
    res.status(500).json({ error: "Erreur serveur lors du chargement des statistiques" });
  }
});

// POST /paiements - Ajouter un paiement
router.post("/", async (req, res) => {
  const { contrat_id, montant, date_paiement, est_paye } = req.body;

  // Validation des champs requis
  if (!contrat_id || !montant || !date_paiement) {
    return res.status(400).json({ error: "contrat_id, montant et date_paiement sont obligatoires" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si le contrat existe
    const [contrats] = await db.query(
      `SELECT c.id, c.locataire_id, a.numero AS appartement_numero
       FROM contrats c
       JOIN appartements a ON c.appartement_id = a.id
       WHERE c.id = ?`,
      [contrat_id]
    );
    if (contrats.length === 0) {
      return res.status(400).json({ error: "Contrat invalide" });
    }

    // Vérifier le locataire
    const [locataires] = await db.query(
      "SELECT nom, email FROM locataires WHERE id = ?",
      [contrats[0].locataire_id]
    );
    if (locataires.length === 0) {
      return res.status(404).json({ error: "Locataire non trouvé" });
    }

    // Validation des types
    const parsedMontant = parseFloat(montant);
    if (isNaN(parsedMontant) || parsedMontant < 0) {
      return res.status(400).json({ error: "Le montant doit être un nombre positif" });
    }

    const [result] = await db.query(
      "INSERT INTO paiements (contrat_id, montant, date_paiement, est_paye) VALUES (?, ?, ?, ?)",
      [contrat_id, parsedMontant, date_paiement, est_paye ?? false]
    );

    const newPaiement = {
      id: result.insertId,
      contrat_id,
      montant: parsedMontant,
      date_paiement,
      est_paye: est_paye ?? false,
    };

    // Envoyer l'email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: locataires[0].email,
      subject: est_paye ? "Confirmation de paiement" : "Notification d'impayé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2e7d32;">${est_paye ? "Confirmation de paiement" : "Notification d'impayé"}</h2>
          <p>Bonjour ${locataires[0].nom},</p>
          <p>Nous vous informons que pour l'appartement <strong>${contrats[0].appartement_numero}</strong> :</p>
          <p><strong>Montant :</strong> ${formatNumber(parsedMontant)}</p>
          <p><strong>Date :</strong> ${formatDate(date_paiement)}</p>
          <p><strong>Statut :</strong> ${est_paye ? "Payé" : "Impayé"}</p>
          ${
            est_paye
              ? "<p>Merci pour votre règlement.</p>"
              : "<p>Veuillez régulariser votre situation au plus vite.</p>"
          }
          <p>Pour toute question, contactez-nous.</p>
          <p style="margin-top: 20px;">Cordialement,<br>L'équipe de gestion locative</p>
          <p><a href="mailto:bahmmouctar@gmail.com">bahmmouctar@gmail.com</a> | +32 492 18 39 44</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log("Paiement ajouté:", newPaiement);
    res.status(201).json(newPaiement);
  } catch (err) {
    console.error("Erreur dans POST /paiements:", err);
    res.status(500).json({ error: "Erreur serveur lors de l’ajout du paiement", details: err.message });
  }
});

// PUT /paiements/:id - Mettre à jour un paiement
router.put("/:id", async (req, res) => {
  const { contrat_id, montant, date_paiement, est_paye } = req.body;
  const { id } = req.params;

  // Validation des champs requis
  if (!contrat_id || !montant || !date_paiement) {
    return res.status(400).json({ error: "contrat_id, montant et date_paiement sont obligatoires" });
  }

  try {
    const db = req.app.locals.db;

    // Vérifier si le contrat existe
    const [contrats] = await db.query(
      `SELECT c.id, c.locataire_id, a.numero AS appartement_numero
       FROM contrats c
       JOIN appartements a ON c.appartement_id = a.id
       WHERE c.id = ?`,
      [contrat_id]
    );
    if (contrats.length === 0) {
      return res.status(400).json({ error: "Contrat invalide" });
    }

    // Vérifier le locataire
    const [locataires] = await db.query(
      "SELECT nom, email FROM locataires WHERE id = ?",
      [contrats[0].locataire_id]
    );
    if (locataires.length === 0) {
      return res.status(404).json({ error: "Locataire non trouvé" });
    }

    // Validation des types
    const parsedMontant = parseFloat(montant);
    if (isNaN(parsedMontant) || parsedMontant < 0) {
      return res.status(400).json({ error: "Le montant doit être un nombre positif" });
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    const [result] = await db.query(
      "UPDATE paiements SET contrat_id = ?, montant = ?, date_paiement = ?, est_paye = ? WHERE id = ?",
      [contrat_id, parsedMontant, date_paiement, est_paye ?? false, parsedId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Paiement non trouvé" });
    }

    const updatedPaiement = {
      id: parsedId,
      contrat_id,
      montant: parsedMontant,
      date_paiement,
      est_paye: est_paye ?? false,
    };

    // Envoyer l'email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: locataires[0].email,
      subject: est_paye ? "Confirmation de paiement" : "Notification d'impayé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2e7d32;">${est_paye ? "Confirmation de paiement" : "Notification d'impayé"}</h2>
          <p>Bonjour ${locataires[0].nom},</p>
          <p>Nous vous informons que pour l'appartement <strong>${contrats[0].appartement_numero}</strong> :</p>
          <p><strong>Montant :</strong> ${formatNumber(parsedMontant)}</p>
          <p><strong>Date :</strong> ${formatDate(date_paiement)}</p>
          <p><strong>Statut :</strong> ${est_paye ? "Payé" : "Impayé"}</p>
          ${
            est_paye
              ? "<p>Merci pour votre règlement.</p>"
              : "<p>Veuillez régulariser votre situation au plus vite.</p>"
          }
          <p>Pour toute question, contactez-nous.</p>
          <p style="margin-top: 20px;">Cordialement,<br>L'équipe de gestion locative</p>
          <p><a href="mailto:bahmmouctar@gmail.com">bahmmouctar@gmail.com</a> | +32 492 18 39 44</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log("Paiement mis à jour:", updatedPaiement);
    res.json(updatedPaiement);
  } catch (err) {
    console.error("Erreur dans PUT /paiements/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour du paiement", details: err.message });
  }
});

// DELETE /paiements/:id - Supprimer un paiement
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const db = req.app.locals.db;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: "ID invalide, doit être un nombre" });
    }

    const [result] = await db.query("DELETE FROM paiements WHERE id = ?", [parsedId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Paiement non trouvé" });
    }

    console.log(`Paiement ID ${parsedId} supprimé avec succès`);
    res.status(204).send();
  } catch (err) {
    console.error("Erreur dans DELETE /paiements/:id:", err);
    res.status(500).json({ error: "Erreur serveur lors de la suppression du paiement", details: err.message });
  }
});

module.exports = router;