const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEMP_FILE = path.join(__dirname, 'visible.txt');
const FILE_CONTENT = 'Fichier visible';

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
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }

    req.end();
  });
}

test('Connexion pour récupération de fichiers', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'alice', password: 'password123' }
  });

  const data = JSON.parse(res.body);
  token = data.token;
  userId = token.split('|')[0];
  assert.ok(token, 'Token doit exister');
});

test('Upload de fichier à lister', async () => {
  fs.writeFileSync(TEMP_FILE, FILE_CONTENT);
  const fileBuffer = fs.readFileSync(TEMP_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: token,
      'X-Filename': encodeURIComponent('visible.txt'),
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 201, 'Upload fichier visible');
});

test('Récupération de la liste des fichiers', async () => {
  const res = await nativeRequest({
    method: 'GET',
    path: '/files',
    headers: { Authorization: token }
  });

  assert.strictEqual(res.status, 200, 'Statut HTTP OK');

  const data = JSON.parse(res.body);
  assert.ok(Array.isArray(data.files), 'Liste attendue');

  const match = data.files.find(name => name.includes('visible.txt'));
  assert.ok(match, 'Fichier visible.txt présent dans la liste');
});

test('Récupération sans token doit échouer', async () => {
  const res = await nativeRequest({
    method: 'GET',
    path: '/files'
  });

  assert.strictEqual(res.status, 401, 'Accès non autorisé sans token');
});

test('Nettoyage des fichiers', () => {
  const filePath = path.join(__dirname, '../data', userId, 'visible.txt');
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
});
