# Gestionnaire de fichiers multi-utilisateur – Node.js

## Objectif

Ce projet est une application Node.js native (sans framework HTTP) permettant à plusieurs utilisateurs prédéfinis :
- de se connecter avec un identifiant et mot de passe
- de gérer leurs fichiers (upload, suppression, renommage)
- de partager leur répertoire avec d'autres utilisateurs
- de recevoir des notifications en temps réel via WebSocket
- de compresser leurs fichiers via des commandes système

## Lancer le projet

1. **Cloner le dépôt :**

git clone https://github.com/HarleZe/GestionfichierAPI

cd GestionfichierAPI

2. **Installer les dépendances :**

   npm install 

3. **Lancer le serveur :**

   node server.js


3. **Accéder à l’interface :**

   Ouvrir [http://localhost:3000](http://localhost:3000) dans un navigateur.

## Technologies utilisées

- Node.js (modules natifs uniquement)
- WebSocket avec la bibliothèque `ws`
- Aucune base de données (tout est stocké dans le système de fichiers)
- `child_process.spawn` pour exécuter les commandes système

## Structure du projet

```
├── auth.js               # Authentification des utilisateurs
├── server.js             # Serveur HTTP principal
├── websocket.js          # Gestion du WebSocket
├── users.json            # Liste des utilisateurs autorisés
├── shared.json           # Gestion des dossiers partagés
├── /data                 # Contient les fichiers des utilisateurs
├── /public
│   ├── index.html        # Interface Web
│   └── styles.css        # Styles de l’interface
├── /test                 # Tests unitaires de l’authentification
│   └── ...               
└── README.md             # Documentation du projet
```

## Utilisateurs

Les utilisateurs sont définis dans `users.json` :

Aucune inscription n’est possible.

## Lancer les tests unitaires

node nom-du-test.js 

Les tests nécessitent d'avoir le serveur de démarré.

## Fonctionnalités disponibles

- **Connexion :** via `/login`
- **Voir ses fichiers :** `GET /files`
- **Uploader :** `POST /files` avec header `X-Filename`
- **Supprimer :** `DELETE /files/:filename`
- **Partager :** `POST /share` avec `targetUserId`
- **Compresser :** `POST /compress` avec un tableau de noms de fichiers
- **Renommer :** `POST /rename` avec `oldName` et `newName`
- **Notifications temps réel :** via WebSocket

Tout les fonctionnalités sont accessibles depuis la page principale avec une petite interface graphique : http://localhost:3000/

## Notifications WebSocket

Chaque utilisateur reçoit des notifications :
- Quand un fichier est uploadé ou supprimé
- Quand un dossier est partagé avec lui
- Quand une compression est terminée

## Exemple de compression

POST /compress
{
  "files": ["fichier1.txt", "fichier2.md"]
}
```
Cela crée un fichier `archive-<timestamp>.zip` dans le dossier de l’utilisateur via PowerShell.

Les noms de fichiers avec des **espaces** ne sont pas supportés pour la compression.

## Contraintes respectées

- Aucun framework HTTP
- Aucune base de données
- Authentification 100% fichier
- WebSocket pour les notifications
- `child_process.spawn` utilisé pour la compression

## Auteur

Projet réalisé par Louis CONSTANT et Icham DURET
