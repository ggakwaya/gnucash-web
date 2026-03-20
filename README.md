# GnuCash Web

Application Web de visualisation des données GnuCash — 100 % côté client, sans serveur backend.

Charge un fichier `.gnucash` (SQLite) directement dans le navigateur via **sql.js** (WebAssembly).

## Fonctionnalités

- **Dashboard** — KPI financiers + graphiques interactifs (revenus, dépenses, profit, répartition)
- **Plan comptable** — Arborescence hiérarchique des comptes avec soldes
- **Grand livre** — Grille filtrable avec colonnes Débit/Crédit et comptes séparés (Dt/Ct)
- **Drag-and-drop** — Glissez n'importe quel fichier `.gnucash` pour le visualiser

## Stack

| Outil | Rôle |
|---|---|
| [Vite](https://vite.dev) | Build & dev server |
| [sql.js](https://sql.js.org) | SQLite compilé en WASM |
| [ApexCharts](https://apexcharts.com) | Graphiques interactifs |
| [AG Grid Community](https://www.ag-grid.com) | Grille de données |

## Démarrage

```bash
npm install

# Copier le binaire WASM
cp node_modules/sql.js/dist/sql-wasm.wasm public/

# (Optionnel) Copier votre fichier GnuCash pour chargement auto
cp /chemin/vers/votre-fichier.gnucash public/2025-2271724025.gnucash

npm run dev
```

Ouvrez http://localhost:5173 — vous pouvez aussi glisser-déposer un fichier `.gnucash` directement dans la fenêtre.

## Licence

MIT
