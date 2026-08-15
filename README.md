# Ultra Auxerre Map

> Une carte communautaire dédiée aux sticks liés aux supporters de l'AJ Auxerre.

**Demo :** https://ultra-auxerre-map.vercel.app/

## Présentation

Ultra Auxerre Map est une application web communautaire permettant de localiser des sticks sur une carte, de les consulter, de signaler leur présence ou leur disparition, et de construire progressivement une communauté autour de ces contributions.

Le projet est pensé comme une base évolutive : gestion des comptes, profils publics, amis, classement des contributeurs, validation communautaire et outils de modération sont déjà intégrés au socle de l'application.

À terme, le projet a vocation à évoluer vers une expérience plus large autour des clubs, des territoires et de la compétition communautaire.

## Fonctionnalités actuelles

- Carte interactive basée sur **MapLibre GL**.
- Recherche d'adresses et de villes via un geocoder basé sur Nominatim.
- Ajout de sticks directement depuis la carte.
- Ajout d'une description et d'une photo à un stick.
- Affichage des sticks avec clustering lorsque la carte est dézoomée.
- Statut visuel des sticks selon leur état de modération et les dernières informations disponibles.
- Consultation détaillée d'un stick avec auteur, photo, description, coordonnées, confirmations et signalements.
- Confirmation communautaire de présence d'un stick.
- Signalement d'un stick disparu.
- Comptes utilisateurs avec profil et historique des contributions.
- Modification du pseudo.
- Profils publics.
- Système d'amis avec demandes, acceptation et refus.
- Recherche d'utilisateurs par adresse email.
- Classement des contributeurs.
- Validation communautaire des nouveaux sticks.
- Interface de modération pour les administrateurs.
- Suppression administrative des sticks.
- Déploiement continu via **Vercel**.

## Stack technique

### Frontend

- **React**
- **TypeScript**
- **Vite**
- **MapLibre GL**
- **@maplibre/maplibre-gl-geocoder**
- **CSS** personnalisé avec une identité visuelle inspirée de l'AJ Auxerre

### Backend / services

- **Supabase** pour l'authentification, la base de données et le stockage des photos.
- **Nominatim / OpenStreetMap** pour la recherche d'adresses.
- **Vercel** pour le déploiement et les analytics/performance.

## Architecture

Le projet a été structuré pour éviter de concentrer toute la logique dans `App.tsx`.

```text
src/
├── components/       # Composants d'interface
├── hooks/            # Logique React et état métier
│   ├── useFriends.ts
│   ├── useModeration.ts
│   ├── useSticks.ts
│   ├── useRanking.ts
│   ├── usePublicProfile.ts
│   └── useMap.ts
├── services/         # Accès Supabase et logique d'accès aux données
├── utils/            # Fonctions utilitaires et configuration de carte
├── types/            # Types TypeScript partagés
├── App.tsx           # Composition principale de l'application
└── ...
```

La logique spécifique à MapLibre est isolée dans `useMap.ts`, tandis que les fonctionnalités métiers importantes sont réparties dans des hooks dédiés.

## Gestion de la carte

La carte utilise :

- un worker MapLibre configuré via Vite ;
- une source GeoJSON pour les sticks ;
- le clustering natif de MapLibre ;
- des layers distincts pour les clusters et les points ;
- un geocoder personnalisé ;
- un mode d'ajout permettant de placer un marker sur la carte.

Les données des sticks sont transformées en GeoJSON via un utilitaire dédié et les couleurs de la carte sont centralisées dans `src/utils/mapColors.ts`.

## Déploiement

Le projet est déployé sur **Vercel** et utilise le build Vite pour produire la version de production.

URL de démonstration :

**https://ultra-auxerre-map.vercel.app/**

## Roadmap

Le projet est en évolution. Les prochaines fonctionnalités envisagées incluent notamment :

- Recherche d'amis par pseudo avec pseudo unique.
- Distinction entre un stick **vu** et un stick **collé**.
- Refonte du système de points et du classement selon les contributions.
- Classement des amis pleinement fonctionnel.
- Amélioration de la logique de statut après signalement d'un stick.
- Amélioration des différents modes de connexion.
- Amélioration visuelle de certaines interfaces, notamment les actions d'administration.
- Ajouter un écran de présentation au premier lancement pour expliquer le concept, le fonctionnement de la carte, les actions possibles et le système de contributions, avec une option « Ne plus afficher » mémorisée pour les visites suivantes.
- Préparation d'une version **PWA** installable sur mobile.
- À plus long terme, ouverture du concept à plusieurs clubs et création d'un système de **guerre de territoires** basé sur la présence de sticks par ville ou zone géographique.

## Vision à long terme

L'objectif n'est pas seulement de construire une carte de sticks, mais de faire évoluer le projet vers une plateforme communautaire liée aux supporters et à leur présence sur le territoire.

Une évolution possible serait de représenter les zones géographiques selon la densité de sticks attribués à différents clubs, afin de transformer la carte en véritable système de territoires et de compétition communautaire.

## Statut du projet

Projet personnel en développement continu.

Le prototype actuel est fonctionnel et déployé en ligne. L'architecture est volontairement conçue pour pouvoir évoluer progressivement vers une application mobile et vers un système multi-clubs.

---

### Auteur

Projet développé par **Lino Thebault**.
