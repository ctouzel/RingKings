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
- `src/ui/` — styles et interface
- `tests/` — tests Vitest

## Feuille de route

1. ✅ Modèle de données
2. Générateur de ligue (50 boxeurs)
3. Moteur de simulation de combat
4. Classements et carrière
5. Interface de gestion
6. Visualisation des combats 8-bit
7. Cycle de saison (âge, progression, retraites)
8. Finitions (sauvegarde, sons, éditeur de sprites)
