# UX7 — Registre de validation

Statut : **NON APPROUVÉ — séances utilisateurs en attente**.

## Version et participants

| Champ | Valeur |
| --- | --- |
| URL/environnement testé | À renseigner |
| Version web/API déployée | À vérifier séparément |
| Base Git locale au démarrage | `ebbb19f` + modifications UX1–UX6 non commitées |
| Migrations vérifiées | En attente pour l’environnement de test |
| Date et fuseau de séance | À renseigner ; America/Port-au-Prince |
| Participants et rôles | En attente ; pas de secrets |
| Navigateurs/appareils/langues | À renseigner |
| Modérateur / responsable des défauts | À désigner |

## Baseline technique locale

Vérification du 12 octobre 2026. Ces résultats concernent le code local, pas une version distante.

| Contrôle | Résultat constaté |
| --- | --- |
| `node --experimental-strip-types --test tests/*.test.mjs` depuis apps/web | PASS — 16 tests |
| `node node_modules/jest/bin/jest.js --runInBand attendance-session-lock.spec.ts attendance-dashboard-query.spec.ts` depuis apps/api | PASS — 5 tests |
| Lint ciblé et build web après UX6 | PASS lors du batch UX6 ; pas relancés pour ces seuls documents |
| Tests humains / mobile / lecteur d’écran / récupération après commit d’un paiement | NON TESTÉS |

Le warning Node MODULE_TYPELESS_PACKAGE_JSON des tests TS n’a pas empêché leur exécution. Les tests de verrouillage API utilisent une transaction simulée ; ils ne remplacent pas une vérification en base réelle.

## Résultats des séances

États : non testé / bloqué / réussi sans aide / réussi avec aide / échec. Ajouter une ligne par participant et par retest ; ne pas remplacer la première observation.

| Cas | Participant/rôle | Version | État | Durée | Aides | Preuve / observation / défaut |
| --- | --- | --- | --- | --- | --- | --- |
| E1 — création et responsable | — | — | Non testé | — | — | — |
| E2 — identité administrative | — | — | Non testé | — | — | — |
| A1 — présences | — | — | Non testé | — | — | — |
| A2 — correction/récupération | — | — | Non testé | — | — | — |
| F1 — paiement partiel/reçu | — | — | Non testé | — | — | — |
| F2 — revue/virement | — | — | Non testé | — | — | — |
| N1 — changement d’école | — | — | Non testé | — | — | — |
| R1 — réponse de paiement perdue après enregistrement | — | — | Non testé | — | — | — |
| K1 — mobile/clavier/zoom/lecteur d’écran | — | — | Non testé | — | — | — |

## Points connus à vérifier

| Point | État / décision attendue |
| --- | --- |
| Les modifications locales ne sont pas encore sur une release identifiée | Vérifier la version avant la séance |
| Back/Forward et changement d’école peuvent contourner certains avertissements de brouillon/paiement incertain | Tester et classer selon l’impact ; aucune dérogation implicite |
| Clé de paiement conservée en mémoire uniquement | Après rechargement d’un paiement incertain, vérifier le registre avant toute nouvelle saisie |
| Libellés anglais restants dans responsables et clôture/supervision de caisse | Relever les libellés bloquants et les corriger ; acceptation explicite des autres |
| Sélection d’année scolaire par module | Vérifier la compréhension ; aucun sélecteur global annoncé |

## Défauts et retests

| ID | Cas/version | Reproduction et attendu | Gravité | Responsable | Correction/version | Retest/preuve | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- |
| À remplir lors des observations | — | — | — | — | — | — | — |

## Approbation

- [ ] Trois tâches principales réussies sans aide au retest final.
- [ ] Zéro P0/P1 ouvert ; contrôles de sécurité/récupération effectivement vérifiés.
- [ ] Mobile/clavier et formats de reçus vérifiés ou limitation résolue.
- [ ] P2 restants explicitement acceptés avec responsable et échéance.
- [ ] Version testée identifiée et preuves conservées sans données sensibles.

Responsable scolaire : **en attente**. Responsable technique : **en attente**.

Décision / date / restrictions acceptées : **en attente**.
