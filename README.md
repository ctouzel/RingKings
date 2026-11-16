# RingKings

Simulateur de promoteur de boxe : gère une ligue d'une cinquantaine de boxeurs,
organise des galas et regarde les combats en style rétro 8-bit.

## Démarrer

```bash
npm install
npm run dev     # serveur de développement
npm test        # tests unitaires
npm run build   # vérification des types + build de production
```

## Structure

- `src/model/` — modèle de données (types, libellés, fonctions utilitaires)
- `src/gen/` — générateur de ligue (noms, attributs, palmarès)
- `src/sim/` — moteur de combat, juges, commentaires
- `src/league/` — classement par points, carrières, galas, calendrier, matchmaking
- `src/viz/` — lecteur 8-bit : sprites, poses, décor, timeline, animation
- `dev/sprites.html` — galerie de sprites (ouvrir `/dev/sprites.html` avec `npm run dev`)
- `src/ui/` — styles et interface
- `tests/` — tests Vitest

## Feuille de route

1. ✅ Modèle de données
2. ✅ Générateur de ligue (75 boxeurs)
3. ✅ Moteur de simulation de combat
4. ✅ Classements et carrière
5. ✅ Interface de gestion
6. ✅ Visualisation des combats 8-bit
7. ✅ Cycle de saison (âge, progression, retraites, repêchage)
8. Finitions (sauvegarde, sons, éditeur de sprites)

## Sprites et animation

- **Têtes, coiffures, barbes, gants** : grilles de caractères dans `src/viz/heads.ts`
  (un caractère = un pixel : `S` peau, `H` cheveux, `E` œil…). Ajouter une coiffure =
  ajouter une grille à `HAIR_STYLES`.
- **Poses** : points du squelette dans `src/viz/poses.ts` (garde, jab, direct, crochet,
  uppercut, corps, touché, esquive, accrochage, genou à terre, au tapis, victoire, arbitre).
- **Couleurs** : `src/viz/palette.ts` (peaux, cheveux, ring, foule).
- **Rythme** : `TIMING` dans `src/viz/timeline.ts` (durée des coups, du compte,
  nombre d'échanges gardés par round en mode résumé).
- **En jeu** : bouton « Personnaliser » sur la fiche d'un boxeur (peau, coiffure,
  cheveux, barbe, carrure, couleurs du short et des gants) avec aperçu animé.
- **Sons** : chiptune généré en direct (`src/viz/audio.ts`, Web Audio API) — cloche,
  impacts, foule, compte, K.O., fanfare d'entrée, victoire. Bouton 🔊/🔇 dans le lecteur.
- Raccourcis du lecteur : espace = pause, ← / → = reculer / avancer de 5 s, Échap = fermer.

## Sauvegardes

Bouton **Partie** : 3 emplacements (IndexedDB, sauvegarde automatique après chaque
action), export / import d'un fichier `.json`, nouvelle ligue avec nom et seed.
Une ligue pèse environ 180 Ko par saison jouée. Les anciennes sauvegardes sont
migrées automatiquement.

## Règles de la ligue

- **Classement par points** : une victoire rapporte `(20 + valeur de l'adversaire)`
  × méthode (KO ×1,2, décision partagée ×0,85…) × titre (×1,25). Valeur de
  l'adversaire : champion 100, n°1 85 … n°14 20, non classé 15. Une défaite
  retire des points (davantage contre un moins bien classé, ×1,3 si arrêté).
  Les points comptent à 100 % pendant 6 mois puis s'effacent jusqu'à 2 ans.
- **Défense obligatoire** : le champion doit affronter l'aspirant n°1 dans
  l'année, sinon le titre devient vacant. Un titre vacant se dispute entre
  deux boxeurs du top 5.
- **Fin de saison** (passage du 31 décembre) : récompenses de l'année, progression
  des jeunes vers leur potentiel, déclin après l'âge de pic (le physique d'abord,
  l'expérience continue de monter), retraites (âge, usure, déclin, série de
  défaites, inactivité), puis **repêchage**.
- **Repêchage** : un choix par place libérée (au moins un par catégorie) parmi
  « choix + 3 » espoirs. Le potentiel affiché est une estimation du recruteur ;
  le vrai potentiel est caché. Les galas de la nouvelle année attendent le repêchage.
- **Repos médical** : 30 jours + selon les dégâts reçus ; +45 à 75 jours après
  une défaite avant la limite.

Équilibrage sur 10 saisons (niveau moyen ~68–70, âge moyen ~27–28, 60–70 % des
4 grands marchés, ~20 nationalités) :

```bash
SAISONS=10 SEED=314 npx vitest run scripts/longrun.test.ts
```

Aperçu d'une ligue après 3 ans de galas automatiques :

```bash
npx vitest run scripts/season.test.ts
```

## Calibration du moteur

Les réglages globaux sont dans `TUNING` (`src/sim/engine.ts`). Outils :

```bash
npm run calibrate                                   # stats sur ~4000 combats de ligue
TUNING_JSON='{"stunScale":0.8}' npm run calibrate   # tester un réglage sans modifier le code
npx vitest run scripts/attr-value.test.ts           # matrice des styles + valeur des attributs
WRITE=1 npx vitest run scripts/attr-value.test.ts   # recalcule les poids de la note globale
npx vitest run scripts/style-tuner.test.ts          # équilibre automatique des styles
```

Cibles actuelles : ~60 % d'arrêts (51 % chez les légers, 69 % chez les lourds),
~0,7 knockdown par combat, ~52 coups lancés par round, le favori gagne ~73 %.
