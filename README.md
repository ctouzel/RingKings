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
- `src/ui/` — styles et interface
- `tests/` — tests Vitest

## Feuille de route

1. ✅ Modèle de données
2. ✅ Générateur de ligue (75 boxeurs)
3. ✅ Moteur de simulation de combat
4. Classements et carrière
5. Interface de gestion
6. Visualisation des combats 8-bit
7. Cycle de saison (âge, progression, retraites)
8. Finitions (sauvegarde, sons, éditeur de sprites)

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
