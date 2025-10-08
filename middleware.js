const jwt = require('jsonwebtoken');

const SECRET_KEY = 'regardepasjesuistimide';

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    // Vérifie la présence de l’en-tête Authorization: Bearer <token>
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant ou mal formaté' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Vérifie et décode le JWT
        const decoded = jwt.verify(token, SECRET_KEY);

        // On attache l’ID utilisateur (ou username) à la requête
        req.userId = decoded.id;
        req.username = decoded.username;

        // Passe au middleware suivant
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

module.exports = { authMiddleware, SECRET_KEY };