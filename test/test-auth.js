const test = require('node:test');
const assert = require('assert');
const { authenticate, getUserIdFromToken } = require('../auth');

test('Authentification réussie avec identifiants valides', () => {
  const token = authenticate('alice', 'password123');
  assert.ok(token, 'Le token ne doit pas être null');
  assert.strictEqual(getUserIdFromToken(token), 'user-001');
});

test('Authentification échouée avec mauvais mot de passe', () => {
  const token = authenticate('user-001', 'mauvaismdp');
  assert.strictEqual(token, null);
});

test('Authentification échouée avec utilisateur inconnu', () => {
  const token = authenticate('inconnu', 'inconnu');
  assert.strictEqual(token, null);
});