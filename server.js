// Serveur HTTP simple 
const http = require('http');
const fs = require('fs');
const url = require('url');
const { authenticate, getUserIdFromToken } = require('./auth');
const path = require('path');
const { initWebSocket, notify } = require('./websocket');
const { spawn } = require('child_process');
const os = require('os');


//Installer les repertoires user automatiquement (/data/user-001/ par exemple)
function initUserDirs() {
  const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'users.json'), 'utf-8'));
  const dataDir = path.join(__dirname, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  users.forEach(user => {
    const userDir = path.join(dataDir, user.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir);
      console.log(`✅ Dossier créé : ${userDir}`);
    }
  });
}


//Page principale
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Erreur serveur');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  }
    
  //Envoi la feuille de style au serveur
  else if (req.method === 'GET' && req.url === '/styles.css') {
    const cssPath = path.join(__dirname, 'public', 'styles.css');
    fs.readFile(cssPath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Fichier CSS non trouvé');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end(content);
      }
    });
  }

  //Connexion utilisateur post /login
  else if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const { username, password } = JSON.parse(body);
      const token = authenticate(username, password);
      if (token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token }));
      } else {
        res.writeHead(401);
        res.end('Unauthorized');
      }
    });
  }

  //Liste des fichiers visibles par l'utilisateur (perso et partages)
  else if (req.method === 'GET' && req.url === '/files') {
    const token = req.headers['authorization'];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    const userDir = path.join(__dirname, 'data', String(userId)); //chemin repertoire user
    const sharedPath = path.join(__dirname, 'shared.json'); //chemin vers shared.json
    let sharedList = [];

    if (fs.existsSync(sharedPath)) {
      sharedList = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
    }

    //recup les repertoires accessibles par l'user
    const visibleDirs = [userId];
    //pour chaque entrée de partage on vérifie si l'user est destinataire
    for (const entry of sharedList) {
      if (entry.sharedWith.includes(userId)) {
        visibleDirs.push(entry.ownerId); //ajoute l'id du proprietaire du repertoire partage
      }
    }

    //pour chaque repertoire visible (perso ou partage) liste les fichiers
    let allFiles = [];
    for (const id of visibleDirs) {
      const dir = path.join(__dirname, 'data', String(id));
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(f => allFiles.push(`[user ${id}] ${f}`)); //ajoute prefixe pour identifier le proprietaire du fichier
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ files: allFiles }));
  }

  //Upload d'un fichier
  else if (req.method === 'POST' && req.url === '/files') {
    const token = req.headers['authorization'];
    const filename = req.headers['x-filename'];

    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    if (!filename) {
      res.writeHead(400);
      res.end('Missing X-Filename header');
      return;
    }

    const userDir = path.join(__dirname, 'data', String(userId));
    const filePath = path.join(userDir, filename);

    //sauvegarde le fichier reçu
    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    req.on('end', () => {
      res.writeHead(201);
      res.end('Fichier uploadé avec succès');
    });

    notify(userId, `📤 Fichier "${filename}" uploadé`);


    req.on('error', () => {
      res.writeHead(500);
      res.end("Erreur lors de l'écriture du fichier");
    });
  }

  //Suppression d'un fichier
  else if (req.method === 'DELETE' && req.url.startsWith('/files/')) {
    const token = req.headers['authorization'];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    //Extraction nom du fichier à partir de l'url
    const filename = decodeURIComponent(req.url.split('/files/')[1]);
    if (!filename) {
      res.writeHead(400);
      res.end('Missing filename');
      return;
    }

    const userDir = path.join(__dirname, 'data', String(userId));
    const filePath = path.join(userDir, filename);

    //supprime avec fs.unlink
    fs.unlink(filePath, err => {
      if (err) {
        res.writeHead(404);
        res.end('File not found or error deleting');
        return;
      }

      res.writeHead(200);
      res.end('Fichier supprimé avec succès');
      notify(userId, `🗑️ Fichier "${filename}" supprimé`);
    });
  }

  //Partage de son repertoire avec un autre user
  else if (req.method === 'POST' && req.url === '/share') {
    const token = req.headers['authorization'];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    //requete json pour recuperer les infos de l'user 
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const { targetUserId } = JSON.parse(body);
        if (!targetUserId || typeof targetUserId !== 'string') {
          res.writeHead(400);
          res.end('Invalid targetUserId');
          return;
        }

        const sharedPath = path.join(__dirname, 'shared.json');
        let sharedList = [];
        if (fs.existsSync(sharedPath)) {
          sharedList = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
        }

        //Recherche d’un partage existant de l'utilisateur courant, si pas on en créer un
        let entry = sharedList.find(s => s.ownerId === userId);
        if (!entry) {
          entry = { ownerId: userId, sharedWith: [] };
          sharedList.push(entry);
        }

        //Ajoute l'utilisateur cible à la liste des partages
        if (!entry.sharedWith.includes(targetUserId)) {
          entry.sharedWith.push(targetUserId);
        }

        //Sauvegarde la nouvelle version de la liste des partages
        fs.writeFileSync(sharedPath, JSON.stringify(sharedList, null, 2));

        notify(targetUserId, `📁 ${userId} a partagé son dossier avec vous`);
        notify(userId, `✅ Dossier partagé avec ${targetUserId}`);

        res.writeHead(200);
        res.end('Partage enregistré');
      } catch (e) {
        res.writeHead(500);
        res.end('Erreur serveur');
      }
    });
  }

  //Compression d'un ou plusieurs ficheirs
  else if (req.method === 'POST' && req.url === '/compress') {
    
    //verifie l'OS, si c'est autre que windows, alors une erreur apparait
    if (os.platform() !== 'win32') {
      res.writeHead(501);
      res.end('Compression non supportée sur ce système (Windows requis)');
      return;
    }

    const token = req.headers['authorization'];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    //Recup le corps JSON de la requete contenant la liste des fichiers
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { files } = JSON.parse(body); //extrait noms fichiers

        //Verifie que la liste est bien un tableau non vide
        if (!Array.isArray(files) || files.length === 0) {
          res.writeHead(400);
          res.end('No files provided');
          return;
        }

        //Genere chemin pour creer archive
        const userDir = path.join(__dirname, 'data', userId); //dossier perso user
        const timestamp = Date.now(); //creer nom fichier unique
        const zipName = `archive-${timestamp}.zip`; //nom fichier zip
        const zipPath = path.join(userDir, zipName); //chemin complet de sortie
 
        //Nettoie et decode chaque nom fichier
        const decodedFiles = files.map(file => {
          const clean = decodeURIComponent(file);
          const fullPath = path.join(userDir, clean);

          if (!fs.existsSync(fullPath)) {
            console.error("❌ Fichier introuvable :", fullPath);
          } else {
            console.log("✅ Fichier OK :", fullPath);
          }
          return fullPath;
        });

        //Preparation de la commande PowerShell Compress-Archive
        const zipPathQuoted = `"${zipPath}"`;
        const fileArgsQuoted = decodedFiles.map(f => `"${f}"`).join(', ');
        const powershellCommand = `Compress-Archive -Path ${fileArgsQuoted} -DestinationPath ${zipPathQuoted} -Force`;

        //Lance la compression avec spawn (commande PowerShell)
        const compress = spawn('powershell.exe', ['-Command', powershellCommand]);

        compress.stdout.on('data', data => {
          console.log(`📤 stdout: ${data}`);
        });

        compress.stderr.on('data', data => {
          console.error(`⚠️ stderr: ${data}`);
        });

        compress.on('close', (code) => {
          console.log(`✅ zip terminé avec code ${code}`);
          if (code === 0) {
            notify(userId, `🗜️ Compression terminée : ${zipName}`);
            res.writeHead(200);
            res.end(`Compression réussie : ${zipName}`);
          } else {
            res.writeHead(500);
            res.end('Erreur lors de la compression');
          }
        });

      } catch (err) {
        console.error("❌ Erreur JSON ou système :", err);
        res.writeHead(500);
        res.end('Erreur serveur');
      }
    });
  }
  
  //Renommer un fichier
  else if (req.method === 'POST' && req.url === '/rename') {
    const token = req.headers['authorization'];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { oldName, newName } = JSON.parse(body); //parsing du json pour extraire l'ancien et le nouveau nom
        if (!oldName || !newName) { //validation des champs (les deux noms doivent exister)
          res.writeHead(400);
          res.end('Invalid names');
          return;
        }

        const userDir = path.join(__dirname, 'data', userId);
        const oldPath = path.join(userDir, decodeURIComponent(oldName));
        const newPath = path.join(userDir, decodeURIComponent(newName));

        //verifie que le fichier d'origine existe
        if (!fs.existsSync(oldPath)) {
          res.writeHead(404);
          res.end('Fichier introuvable');
          return;
        }

        //renommage effectif du fichie
        fs.renameSync(oldPath, newPath);

        notify(userId, `✏️ Fichier renommé : "${oldName}" → "${newName}"`);

        res.writeHead(200);
        res.end('Fichier renommé');
      } catch (err) {
        res.writeHead(500);
        res.end('Erreur serveur');
      }
    });
  }

  //Route inconnue
  else {
    res.writeHead(404);
    res.end('Route non trouvée');
  }
});

initUserDirs();
initWebSocket(server);

server.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
