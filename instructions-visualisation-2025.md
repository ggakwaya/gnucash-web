# Contexte et instructions — Visualisation financière 2025

## Structure de l'entreprise

Gabriel Gakwaya exploite une **entreprise individuelle** au Québec avec deux activités :

- **Consultation** (WordPress, stratégie digitale, production de contenu) — moteur financier
- **SplitboardQC.ca** (location de splitboards, vente d'équipement usagé) — activité saisonnière

Une troisième entité, **9481-5180 QUÉBEC INC.** (EPIC Bike Store / MTBQC), est une corporation séparée. L'individuelle n'a aucun revenu lié à l'INC, mais de l'argent de l'INC transite par le compte chèques affaires (clients qui paient par Interac au même courriel). Ce transit est isolé dans les capitaux propres.

## Source des données

Fichier GnuCash SQLite (`splitboardqc.gnucash`). Exercice du 1er janvier au 31 décembre 2025. Devise : CAD. Comptabilité en partie double, base de caisse pour les revenus.

Tables pertinentes : `accounts` (comptes), `transactions`, `splits` (écritures). Chaque transaction a au minimum 2 splits qui s'équilibrent à zéro. Les comptes ont un `code` (ex. 4100) et un chemin hiérarchique (ex. `Revenus:Consultation`).

## Plan comptable — structure

| Plage | Type | Description |
|-------|------|-------------|
| 1000-1999 | Actifs | Banque, Stripe, créances |
| 2000-2999 | Passifs | Visa RBC, TPS/TVQ à remettre |
| 3000-3999 | Capitaux propres | Capital, apports (3 sous-comptes), prélèvements (3 sous-comptes) |
| 4000-4999 | Revenus | Consultation (4100), Location SBQC (4210), Vente usagés (4230), Autres (4300) |
| 5000-5099 | Charges communes | Internet, logiciels, fournitures, formation, frais bancaires |
| 5100-5199 | Charges consultation | Essence, véhicule, repas, frais Stripe |
| 5200-5299 | Charges SplitboardQC | Achats équipement, fournitures, atelier Sherbrooke, livraison, déplacements, marketing, frais Stripe |

## Données financières clés

### P&L 2025

```
Revenus totaux:               43 631,22 $
  Consultation:               25 877,71
  Location SBQC:              15 804,01
  Vente usagés SBQC:           1 558,98
  Autres revenus:                390,52

Charges totales:              23 138,64 $
  Charges SplitboardQC:       14 379,40
  Charges Consultation:        5 748,46
  Charges communes:            3 010,78

Résultat net:                 20 492,58 $
```

### P&L par activité

```
                          Consultation    SplitboardQC
Revenus                     26 268,23        17 362,99
Charges directes            (5 748,46)      (14 379,40)
Marge brute                 20 519,77         2 983,59
Charges communes (50/50)    (1 505,39)       (1 505,39)
Résultat par activité       19 014,38         1 478,20
```

Note : la répartition 50/50 des charges communes est une approximation. Certaines charges communes (TranslatePress, Beaver Builder) sont plutôt Consultation; d'autres (frais bancaires Stripe) sont déjà séparées par activité.

### Bilan au 31 décembre 2025

```
ACTIFS                          2 071,41 $
  Banque RBC:                   1 029,81
  Stripe (compensation):        1 041,60

PASSIFS                         6 295,15 $
  Visa RBC:                       717,00
  TPS à remettre:                1 908,54
  TVQ à remettre:                3 669,61

VALEUR NETTE:                  -4 223,74 $
```

### Capitaux propres — structure détaillée

Les apports et prélèvements sont ventilés en sous-comptes pour distinguer les flux personnels, les dépenses affaires avancées, et le transit INC.

```
Capital du propriétaire:                  2 548,74

Apports du propriétaire:                 66 380,63
  3111 Personnel:                        17 530,00  (marketplace, famille, remboursements)
  3112 Dépenses affaires avancées:       15 797,70  (cartes perso utilisées pour l'entreprise)
  3113 Transit INC:                      33 052,93  (clients INC qui paient via le compte affaires)

Prélèvements du propriétaire:            93 645,69
  3121 Personnel:                        42 044,45  (retraits pour vivre)
  3122 Investissement INC:               40 329,49  (transferts vers la corporation)
  3123 Paiements cartes perso:           11 271,75  (Visa TD payée depuis le compte affaires)
```

### Flux nets (la lecture importante)

```
Résultat net:                            20 492,58
Retiré par Gabriel (net):              (24 514,45)  = 42 044 − 17 530
Dépenses avancées non remboursées:        4 525,95  = 15 798 − 11 272 (l'entreprise doit à Gabriel)
Investissement INC (net):               (7 276,56)  = 40 329 − 33 053 (capital injecté dans la corp)
```

### Revenus mensuels

| Mois | Consultation | SplitboardQC | Autres | Total |
|------|------------:|-------------:|-------:|------:|
| Jan | 6 429 | 6 733 | 0 | 13 162 |
| Fév | 124 | 4 476 | 0 | 4 599 |
| Mar | 1 155 | 2 027 | 0 | 3 182 |
| Avr | 1 500 | 260 | 0 | 1 760 |
| Mai | 0 | 0 | 108 | 108 |
| Jun | 0 | 0 | 0 | 0 |
| Jul | 2 865 | 0 | 0 | 2 865 |
| Aoû | 1 575 | 0 | 155 | 1 730 |
| Sep | 595 | 0 | 0 | 595 |
| Oct | 7 506 | 900 | 0 | 8 406 |
| Nov | 414 | 960 | 127 | 1 501 |
| Déc | 3 715 | 2 008 | 0 | 5 723 |

SplitboardQC est saisonnière : forte activité janvier-mars (saison hiver), quasi-nulle mai-septembre, reprise octobre-décembre (début de saison). Consultation est irrégulière avec des pics en janvier et octobre (gros mandats).

### Revenus par trimestre

| Trimestre | Consultation | Location SBQC | Vente usagés | Autres | Total |
|-----------|------------:|-------------:|------------:|-------:|------:|
| Q1 | 7 708 | 12 177 | 1 059 | 0 | 20 944 |
| Q2 | 1 500 | 260 | 0 | 108 | 1 868 |
| Q3 | 5 035 | 0 | 0 | 155 | 5 190 |
| Q4 | 11 635 | 3 368 | 500 | 127 | 15 629 |

### Charges SplitboardQC — détail

| Poste | Montant | % des charges SBQC |
|-------|--------:|---:|
| Achats d'équipement | 7 121,49 | 49,5% |
| Frais de service Sherbrooke | 4 213,05 | 29,3% |
| Déplacements (incl. Revelstoke) | 1 770,52 | 12,3% |
| Frais Stripe | 618,74 | 4,3% |
| Fournitures et pièces | 416,56 | 2,9% |
| Livraison et expédition | 135,99 | 0,9% |
| Marketing / site web | 103,05 | 0,7% |
| **Total** | **14 379,40** | **100%** |

Note : le voyage Revelstoke (~1 770 $ en déplacements) était un investissement en création de contenu qui n'a pas donné les résultats escomptés (mauvaise météo). Sans ce poste, la marge SBQC serait plus proche de 25%.

### Charges Consultation — détail

| Poste | Montant |
|-------|--------:|
| Essence | 3 006,94 |
| Véhicule (entretien, réparations) | 2 334,10 |
| Frais Stripe | 368,56 |
| Repas et représentation | 38,86 |
| **Total** | **5 748,46** |

### TPS/TVQ

Taxes perçues mais pas encore remises : TPS 1 908,54 $ + TVQ 3 669,61 $ = **5 578,15 $**. Inclut les taxes SplitboardQC des Q1 et Q2 2025 qui n'avaient pas été déclarées (à rattraper au Q1 2026).

## Notes pour la visualisation

1. **Deux activités, un seul bilan** — Le P&L se divise naturellement par activité (Consultation vs SBQC). Le bilan est unifié mais les capitaux propres distinguent les flux personnels, professionnels et INC.

2. **Saisonnalité SBQC** — Saison hiver (nov-mars) vs hors-saison. La visualisation devrait mettre en évidence ce cycle.

3. **Transit INC** — 33 053 $ d'apports et 40 329 $ de prélèvements liés à l'INC ne sont pas de l'activité économique de l'individuelle. Ils doivent être visuellement séparés des vrais flux d'exploitation.

4. **Valeur nette négative** — Normal en contexte d'entreprise individuelle où les prélèvements dépassent le résultat. Ne pas présenter comme un signal d'alarme — l'entreprise est rentable (20 493 $), c'est le financement de l'INC qui tire le bilan vers le bas.

5. **Objectif 2026** — Isoler SplitboardQC pour le transférer vers l'INC. La visualisation devrait permettre de voir ce que le bilan de l'individuelle deviendrait sans SBQC.
