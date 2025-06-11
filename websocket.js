const WebSocket = require('ws');
const { getUserIdFromToken } = require('./auth');

const clients = new Map();

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const token = req.url.split('?token=')[1];
    const userId = getUserIdFromToken(token);

    if (!userId) {
      ws.close();
      return;
    }

    console.log(`✅ Connexion WebSocket pour l'utilisateur ${userId}`);
    clients.set(userId, ws);

    ws.on('close', () => {
      clients.delete(userId);
      console.log(`❌ Déconnexion WebSocket utilisateur ${userId}`);
    });
  });
}

function notify(userId, message) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ message }));
  }
}

module.exports = { initWebSocket, notify };
