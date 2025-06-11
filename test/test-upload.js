const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_FILE = path.join(__dirname, 'testup.txt');
const TEST_CONTENT = 'Ceci est un test dupload';

let token;
let userId;

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

test('Connexion utilisateur valide avant upload', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'alice', password: 'password123' }
  });
  const data = JSON.parse(res.body);
  token = data.token;
  userId = token.split('|')[0];
  assert.ok(token, 'Token attendu après connexion');
});

test('Upload de fichier fonctionnel', async () => {
  fs.writeFileSync(TEST_FILE, TEST_CONTENT);
  const fileBuffer = fs.readFileSync(TEST_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: token,
      'X-Filename': encodeURIComponent('testup.txt'),
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 201, 'Réponse attendue: 201');

  const uploadedPath = path.join(__dirname, '../data', userId, 'testup.txt');
  assert.ok(fs.existsSync(uploadedPath), 'Le fichier doit exister côté serveur');

  const uploadedContent = fs.readFileSync(uploadedPath, 'utf-8');
  assert.strictEqual(uploadedContent, TEST_CONTENT, 'Le contenu du fichier doit correspondre');
});

test('Upload sans nom de fichier', async () => {
  const fileBuffer = fs.readFileSync(TEST_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: token,
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 400, 'Réponse attendue: 400 (pas de X-Filename)');
});

test('Upload sans token', async () => {
  const fileBuffer = fs.readFileSync(TEST_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      'X-Filename': encodeURIComponent('file.txt'),
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 401, 'Réponse attendue: 401 (pas de token)');
});

test('Nettoyage du fichier uploadé', () => {
  const uploadedPath = path.join(__dirname, '../data', userId, 'testup.txt');
  if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  if (fs.existsSync(TEST_FILE)) fs.unlinkSync(TEST_FILE);
});
