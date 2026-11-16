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
7. Cycle de saison (âge, progression, retraites)
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
- Raccourcis du lecteur : espace = pause, ← / → = reculer / avancer de 5 s, Échap = fermer.

## Règles de la ligue

- **Classement par points** : une victoire rapporte `(20 + valeur de l'adversaire)`
  × méthode (KO ×1,2, décision partagée ×0,85…) × titre (×1,25). Valeur de
  l'adversaire : champion 100, n°1 85 … n°14 20, non classé 15. Une défaite
  retire des points (davantage contre un moins bien classé, ×1,3 si arrêté).
  Les points comptent à 100 % pendant 6 mois puis s'effacent jusqu'à 2 ans.
- **Défense obligatoire** : le champion doit affronter l'aspirant n°1 dans
  l'année, sinon le titre devient vacant. Un titre vacant se dispute entre
  deux boxeurs du top 5.
- **Repos médical** : 30 jours + selon les dégâts reçus ; +45 à 75 jours après
  une défaite avant la limite.

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
