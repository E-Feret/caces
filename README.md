# Révision CACES R489

App statique (HTML/CSS/JS). Aucun backend : les sessions sont enregistrées dans le navigateur (localStorage).
Installable sur téléphone (PWA) et utilisable hors ligne.

## Déploiement sur caces.feret-erwann.fr (Nginx)

1. DNS : ajouter un enregistrement `A` `caces` → IP du VPS.
2. Récupérer le dépôt sur le VPS :
   ```bash
   sudo git clone https://github.com/<ton-compte>/caces.git /var/www/caces
   ```
   Mises à jour ensuite : `cd /var/www/caces && sudo git pull`
3. `/etc/nginx/sites-available/caces.feret-erwann.fr` :
   ```nginx
   server {
       listen 80;
       server_name caces.feret-erwann.fr;
       root /var/www/caces;

       # ne pas exposer le dossier .git
       location ~ /\.git { deny all; }
       index index.html;

       location / { try_files $uri $uri/ /index.html; }
       location = /sw.js { add_header Cache-Control "no-cache"; }
       location ~* \.webmanifest$ { types { application/manifest+json webmanifest; } }
   }
   ```
4. Activer + HTTPS (obligatoire pour l'installation sur téléphone et le mode hors ligne) :
   ```bash
   sudo ln -s /etc/nginx/sites-available/caces.feret-erwann.fr /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d caces.feret-erwann.fr
   ```

## Installer sur le téléphone
- Android (Chrome) : menu ⋮ → « Ajouter à l'écran d'accueil ».
- iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil ».

## Mettre à jour
- Ajouter des questions **à la fin** du tableau dans `questions.js` (l'identifiant d'une question = sa position).
- Incrémenter `VERSION` dans `sw.js` pour forcer le rafraîchissement du cache.
