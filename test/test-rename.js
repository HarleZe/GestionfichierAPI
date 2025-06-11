const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const ORIGINAL_NAME = 'testrename.txt';
const NEW_NAME = 'renametestvalide.txt';
const FILE_CONTENT = 'Contenu à renommer';
const TEMP_FILE = path.join(__dirname, ORIGINAL_NAME);

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

test('Connexion avant renommage', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/login',
    headers: { 'Content-Type': 'application/json' },
    body: { username: 'alice', password: 'password123' }
  });

  const data = JSON.parse(res.body);
  token = data.token;
  userId = token.split('|')[0];
  assert.ok(token);
});

test('Upload du fichier à renommer', async () => {
  fs.writeFileSync(TEMP_FILE, FILE_CONTENT);
  const fileBuffer = fs.readFileSync(TEMP_FILE);

  const res = await nativeRequest({
    method: 'POST',
    path: '/files',
    headers: {
      Authorization: token,
      'X-Filename': encodeURIComponent(ORIGINAL_NAME),
      'Content-Length': Buffer.byteLength(fileBuffer)
    },
    body: fileBuffer
  });

  assert.strictEqual(res.status, 201, 'Upload réussi');
});

test('Renommer le fichier', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/rename',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: { oldName: ORIGINAL_NAME, newName: NEW_NAME }
  });

  assert.strictEqual(res.status, 200, 'Renommage attendu');
  const newPath = path.join(__dirname, '../data', userId, NEW_NAME);
  assert.ok(fs.existsSync(newPath), 'Nouveau fichier existe');
});

test('Renommage avec un nom invalide', async () => {
  const res = await nativeRequest({
    method: 'POST',
    path: '/rename',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json'
    },
    body: { oldName: '', newName: 'truc.txt' }
  });

  assert.strictEqual(res.status, 400, 'Erreur attendue');
});

test('Nettoyage', () => {
  const pathOld = path.join(__dirname, '../data', userId, ORIGINAL_NAME);
  const pathNew = path.join(__dirname, '../data', userId, NEW_NAME);
  if (fs.existsSync(pathOld)) fs.unlinkSync(pathOld);
  if (fs.existsSync(pathNew)) fs.unlinkSync(pathNew);
  if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
});
