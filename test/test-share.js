const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ALICE_FILE = 'testpartage.txt';
const CONTENT = 'Ceci est un fichier partagé';

let aliceToken = '';
let bobToken = '';

//NECESSITE D'AVOIR LE SERVEUR DÉMARRÉ POUR POUVOIR EFFECTUER CES TESTS

function nativeRequest({ method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);

    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

test('Connexion de alice et bob', async () => {
  const res1 = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'alice', password: 'password123' }
  });
  const res2 = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'bob', password: 'secret456' }
  });

  aliceToken = JSON.parse(res1.body).token;
  bobToken = JSON.parse(res2.body).token;

  assert.ok(aliceToken && bobToken, 'Les tokens doivent être valides');
});

test('alice envoie un fichier pour le partager', async () => {
  const userId = aliceToken.split('|')[0];
  const filePath = path.join(__dirname, '..', 'data', userId, ALICE_FILE);
  fs.writeFileSync(filePath, CONTENT);

  const stats = fs.statSync(filePath);
  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: aliceToken,
      'X-Filename': encodeURIComponent(ALICE_FILE),
      'Content-Length': stats.size
    },
    body: fs.readFileSync(filePath)
  });

  assert.strictEqual(res.status, 201, 'Fichier envoyé');
});

test('alice partage son dossier avec bob', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/share',
    headers: {
      'Content-Type': 'application/json',
      Authorization: aliceToken
    },
    body: { targetUserId: 'user-002' }
  });

  assert.strictEqual(res.status, 200, 'Partage réussi');
});

test('bob peut voir les fichiers partagés par alice', async () => {
  const res = await nativeRequest({
    method: 'GET',
    path: '/files',
    headers: { Authorization: bobToken }
  });

  const data = JSON.parse(res.body);
  const found = data.files.some(name => name.includes(ALICE_FILE));
  assert.strictEqual(found, true, 'Bob voit les fichiers d’Alice');
});

test('Nettoyage du fichier partagé', () => {
  const aliceDir = path.join(__dirname, '..', 'data', 'alice');
  const filePath = path.join(aliceDir, ALICE_FILE);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
});
