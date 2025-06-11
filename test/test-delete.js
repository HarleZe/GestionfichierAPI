const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_FILE = path.join(__dirname, 'testsup.txt');
const TEST_CONTENT = 'Contenu à supprimer';

let token;

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
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

test('Connexion avant suppression', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'alice', password: 'password123' }
  });

  const data = JSON.parse(res.body);
  token = data.token;
  assert.ok(token, 'Token attendu');
  userId = token.split('|')[0];
});

test('Upload fichier à supprimer', async () => {
  fs.writeFileSync(TEST_FILE, TEST_CONTENT);
  const fileBuffer = fs.readFileSync(TEST_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: token,
      'X-Filename': encodeURIComponent('testsup.txt'),
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 201, 'Fichier uploadé pour test suppression');
});

test('Suppression fichier valide', async () => {
  const res = await nativeRequest({
    method: 'DELETE',
    path: `/files/${encodeURIComponent('testsup.txt')}`,
    headers: { Authorization: token }
  });

  assert.strictEqual(res.status, 200, 'Suppression réussie');
});

test('Suppression sans token rejetée', async () => {
  const res = await nativeRequest({
    method: 'DELETE',
    path: `/files/${encodeURIComponent('testsup.txt')}`
  });

  assert.strictEqual(res.status, 401, 'Suppression refusée sans token');
});

test('Suppression de fichier inexistant', async () => {
  const res = await nativeRequest({
    method: 'DELETE',
    path: '/files/inexistant.txt',
    headers: { Authorization: token }
  });

  assert.strictEqual(res.status, 404, 'Fichier inexistant détecté');
});

test('Nettoyage du fichier local', () => {
  if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});
