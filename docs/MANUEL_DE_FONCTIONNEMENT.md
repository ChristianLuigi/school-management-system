# Manuel de fonctionnement de la plateforme ALMAC

**Version documentaire :** 1.0

**Révision :** 12 septembre 2026 — code local; disponibilité à confirmer sur la version déployée

**Périmètre :** environnement pilote contrôlé

**Public :** direction scolaire, responsables administratifs, équipe de support et responsables ALMAC

## 1. Objet du manuel

Ce document explique comment la plateforme fonctionne dans son ensemble : responsabilités, enchaînement des opérations, contrôles et règles de sécurité. Il sert de référence commune entre l’école et l’équipe technique.

Deux guides complémentaires décrivent les procédures détaillées :

- [Manuel utilisateur final](./MANUEL_UTILISATEUR.md)
- [Manuel technique et maintenance](./MANUEL_TECHNIQUE_MAINTENANCE.md)

Les procédures de déploiement, de sauvegarde et d’incident restent détaillées dans les runbooks techniques liés à la fin de ce manuel.

## 2. Principes fondamentaux

### 2.1 Séparation entre rôle et périmètre

Le rôle détermine les modules accessibles. L’affectation opérationnelle détermine les données accessibles dans ces modules.

- Un enseignant accède aux présences et au cahier de notes uniquement pour ses sections et matières actives.
- Un parent accède uniquement aux élèves reliés à son dossier de responsable.
- Un responsable financier accède uniquement aux fonctions financières qui lui ont été accordées.
- Un administrateur scolaire agit uniquement dans son école.
- Un Super Admin agit au niveau de la plateforme et peut entrer dans le contexte d’une école selon la politique ALMAC.

Le masquage d’un bouton n’est jamais considéré comme une protection suffisante. Le serveur vérifie chaque opération sensible.

### 2.2 Identité et emploi sont distincts

Un membre du personnel peut exister sans compte de connexion. Le dossier d’emploi est créé en premier; l’accès numérique peut être accordé plus tard par invitation.

- **Dossier personnel :** identité professionnelle, emploi, documents, congés, paie et affectations.
- **Compte utilisateur :** authentification, rôle, permissions et sessions.
- **Lien de compte :** association contrôlée entre le dossier personnel et le compte.

### 2.3 Aucun libre-service d’inscription publique

La page de connexion ne crée pas de compte. La chaîne normale est :

1. ALMAC crée le premier Super Admin par la procédure sécurisée de démarrage.
2. Le Super Admin crée l’école et son premier administrateur scolaire.
3. L’administrateur scolaire crée les dossiers du personnel et envoie les invitations autorisées.
4. Le destinataire active son compte avec le lien reçu et définit son mot de passe lorsque le workflow le demande.

### 2.4 Traçabilité et conservation

Les opérations financières, changements d’accès, modifications de périmètre et décisions importantes sont journalisés. Les écritures financières confirmées ne doivent pas être supprimées ou modifiées directement en base de données.

## 3. Rôles et responsabilités

| Rôle | Responsabilités principales | Limites essentielles |
|---|---|---|
| Super Admin ALMAC | Écoles, gouvernance de plateforme, premiers administrateurs, support global | Ne remplace pas les procédures opérationnelles de l’école |
| Administrateur scolaire | Configuration, élèves, personnel, utilisateurs, affectations, supervision financière | Une seule école; ne peut pas suspendre son propre dernier accès administratif |
| Enseignant | Présences, évaluations et notes | Sections et matières explicitement affectées |
| Responsable financier | Facturation, encaissements, rapprochement et fonctions accordées | Permissions explicites; paie non accordée par défaut |
| Parent / responsable | Consultation des informations autorisées sur ses élèves | Élèves reliés par les liens responsables actifs |

## 4. Cycle de mise en service d’une école

### Étape 1 — Création de l’école

Le Super Admin crée l’établissement, vérifie son identité et accorde l’accès au premier administrateur scolaire. Ce dernier doit avoir une adhésion scolaire active.

### Étape 2 — Configuration initiale

L’administrateur configure au minimum :

1. les informations de l’école;
2. l’année académique;
3. les divisions, classes et sections;
4. les matières et coefficients;
5. les périodes d’évaluation;
6. les paramètres financiers, devises et méthodes de paiement nécessaires.

Les opérations quotidiennes ne doivent pas commencer avant la validation de cette structure.

### Étape 3 — Personnel et accès

1. Créer ou importer les dossiers du personnel.
2. Vérifier l’identité, le type d’emploi, le département et le statut.
3. Ajouter les informations d’adresse et les données médicales strictement nécessaires.
4. Accorder un accès par invitation uniquement aux personnes qui doivent utiliser l’application.
5. Affecter les enseignants aux sections et matières.
6. Accorder séparément les permissions financières.

### Étape 4 — Admissions et élèves

1. Enregistrer et traiter les demandes d’admission.
2. Consigner la décision et, si applicable, les frais d’inscription.
3. Convertir le dossier admis en dossier élève sans recréer manuellement l’identité.
4. Affecter l’élève à une section active.
5. Ajouter les responsables, documents et informations de santé nécessaires.

Les élèves peuvent aussi être importés par CSV après une prévisualisation et une validation ligne par ligne.

### Étape 5 — Démarrage des opérations

Une fois la structure validée :

- les enseignants prennent les présences;
- les enseignants créent les évaluations et saisissent les notes;
- l’administration suit les élèves et les dossiers incomplets;
- la finance émet les factures et enregistre les paiements;
- la direction contrôle les exceptions, approbations et clôtures.

## 5. Fonctionnement par domaine

### 5.1 Admissions

Le dossier d’admission suit son cycle sans être confondu avec un élève actif. Une décision favorable permet la conversion contrôlée en dossier élève. Les reçus d’inscription et lettres de décision doivent être générés depuis le dossier concerné afin de conserver la traçabilité.

### 5.2 Répertoire des élèves

Le dossier élève constitue la source opérationnelle pour l’inscription, les responsables, les documents, la santé, les présences, les résultats et la finance.

Règles principales :

- rechercher avant de créer afin d’éviter les doublons;
- vérifier la classe avant d’activer un élève;
- ne pas réutiliser le dossier d’un ancien élève pour une autre personne;
- utiliser les changements de statut au lieu de supprimer l’historique;
- prévisualiser tout import CSV avant confirmation.

### 5.3 Structure académique

L’année académique contient les niveaux, sections, matières et périodes. Les affectations pédagogiques relient le personnel enseignant à cette structure.

Une affectation active exige :

- un dossier de personnel enseignant actif;
- une année, une section et une matière de la même école;
- un compte utilisateur lié pour accéder aux modules enseignant.

Une modification d’affectation révoque les anciennes sessions afin que le nouveau périmètre soit appliqué à la prochaine connexion.

### 5.4 Présences

Le flux normal est : section, date, session, liste des élèves, vérification, soumission. Les statuts sont enregistrés dans une séance de présence. Un enseignant ne peut pas soumettre une section non affectée.

Une présence déjà soumise doit être corrigée par le workflow autorisé; aucune correction directe en base ne doit être utilisée comme raccourci opérationnel.

### 5.5 Cahier de notes et bulletins

Les évaluations sont rattachées à une matière, une section et une période. Les notes doivent respecter le barème configuré. La publication et les bulletins utilisent les données validées du cahier de notes.

Avant publication :

1. vérifier la période et la matière;
2. vérifier les élèves inscrits;
3. contrôler les notes manquantes ou hors barème;
4. obtenir la validation prévue par l’école;
5. générer le bulletin depuis le dossier ou le module de rapports.

### 5.6 Personnel

Le dossier du personnel reste la référence même si la personne ne possède aucun compte. Son cycle peut inclure : actif, en congé, suspendu, terminé et archivé.

Les opérations sensibles doivent entraîner les effets attendus :

- suspension ou fin d’emploi : retrait des accès actifs concernés;
- modification d’affectation : révocation des sessions;
- retrait d’un lien utilisateur : refus si des responsabilités protégées ou historiques seraient cassées;
- documents privés : accès limité, fichiers contrôlés et aucune URL publique permanente.

### 5.7 Utilisateurs et invitations

L’administrateur scolaire peut inviter les rôles autorisés, renvoyer ou révoquer une invitation et suspendre une adhésion à son école.

Il ne peut pas :

- inviter un Super Admin;
- gérer une autre école en modifiant un identifiant;
- suspendre son propre accès actif;
- suspendre le dernier administrateur scolaire actif;
- voir un mot de passe, un jeton ou une donnée d’authentification interne.

### 5.8 Finance — facturation et encaissement

Le registre canonique est constitué des factures, paiements et événements de correction. Les montants confirmés sont conservés; une erreur se corrige par un événement compensatoire.

#### Facturation contrôlée

1. Créer un plan pour une année académique.
2. Définir la portée, la devise, le montant et le code de période.
3. Prévisualiser les élèves éligibles et les doublons.
4. Sélectionner les élèves à facturer.
5. Confirmer une seule fois.
6. Contrôler le résultat et les factures produites.

L’identité école + élève + plan + année + période empêche la double facturation.

#### Encaissement en caisse

1. Rechercher l’élève.
2. Choisir une facture émise avec solde.
3. Ouvrir la session de caisse dans la bonne devise.
4. Vérifier le montant, la méthode et la référence.
5. Confirmer le paiement une seule fois.
6. Imprimer le reçu numéroté.
7. En fin de poste, compter les espèces et fermer la session.

La date opérationnelle dépend du fuseau horaire de l’école, y compris lorsque l’administrateur travaille depuis l’étranger. Les caisses HTG et USD restent séparées.

#### Corrections

Les paiements ne sont pas effacés. Une annulation, un remboursement ou une note de crédit suit une demande, une approbation par une autre personne autorisée et, si nécessaire, un traitement final. Le demandeur ne peut pas approuver sa propre demande.

#### Rapprochement et clôture

Une session fermée peut être incluse dans un dépôt. Une autre personne autorisée rapproche ou rejette le dépôt. Une période ne peut pas être clôturée tant que les caisses, dépôts ou corrections présentent des blocages. Une période clôturée bloque les nouvelles écritures datées dans cette période.

### 5.9 Paie

La paie s’appuie sur le dossier du personnel, pas sur l’existence d’un compte utilisateur. Les données salariales utilisées dans un traitement sont prises en instantané afin que l’historique ne change pas après une modification future.

Cycle des nouveaux traitements :

`Brouillon → En révision → En attente d’approbation → Approuvé → En traitement → Payé → Clôturé`

L’approbation et la clôture exigent un administrateur scolaire actif. Les contrôles de séparation des responsabilités s’appliquent à la révision et à l’approbation; une dérogation de petite équipe exige l’autorisation du serveur et une justification. Un traitement clôturé est verrouillé. Les contrepassations disponibles concernent les paiements des traitements encore en traitement ou payés; après clôture, faire examiner la correction par le responsable habilité sans modifier directement l’historique.

La rémunération applicable est celle effective au début de la période. Les versions déjà utilisées sont conservées. Le calcul horaire ou journalier n’est pas disponible dans le parcours actuel de paie salariale.

### 5.10 Rapports et accès parent

Les API parent de finance et de bulletins limitent l’accès aux élèves reliés au compte par les liens de responsables autorisés. Toute tentative d’utiliser l’identifiant d’un autre élève doit être rejetée par le serveur.

Une page dédiée de portail parent n’a pas été identifiée dans les routes web examinées. Ne pas annoncer un parcours parent complet tant que l’interface déployée et sa recette ne sont pas confirmées.

## 6. Rythme opérationnel recommandé

### Chaque jour

- vérifier la disponibilité de l’application;
- traiter admissions et changements élèves;
- prendre les présences;
- enregistrer les paiements avec reçus;
- fermer et compter les sessions de caisse;
- examiner les erreurs de livraison des courriels.

### Chaque semaine

- revoir les élèves sans classe et les affectations manquantes;
- contrôler les factures en retard;
- rapprocher les dépôts;
- vérifier les invitations en attente;
- examiner les documents ou contrats proches de l’expiration.

### Chaque mois ou période

- résoudre les corrections financières en attente;
- clôturer la période financière lorsque tous les contrôles sont satisfaits;
- préparer, réviser et approuver la paie;
- vérifier les sauvegardes et le dernier test de restauration;
- produire les rapports de direction.

### Chaque année académique

- créer la nouvelle année et ses périodes;
- vérifier les niveaux, sections et matières;
- renouveler les affectations du personnel;
- inscrire ou promouvoir les élèves avec conservation de l’historique;
- réviser les plans de facturation et les permissions.

## 7. Gestion des anomalies

1. Noter l’heure, le rôle, l’école, la page et l’action effectuée.
2. Copier uniquement l’identifiant de requête affiché; ne jamais transmettre mot de passe, cookie ou jeton.
3. Réessayer une seule fois si l’état de l’opération peut être vérifié.
4. Pour un paiement ou une génération de factures, vérifier d’abord le résultat avant de relancer.
5. Signaler l’incident au support avec une capture sans données sensibles.
6. Ne jamais corriger une opération financière confirmée directement en base.

## 8. Références opérationnelles

- [Déploiement](./DEPLOYMENT.md)
- [Runbook d’exploitation](./OPERATIONS_RUNBOOK.md)
- [Sauvegarde et reprise](./BACKUP_AND_RECOVERY.md)
- [Checklist UAT](./UAT_CHECKLIST.md)
- [Checklist de mise en production](./RELEASE_CHECKLIST.md)
- [Workflow de caisse](./FINANCE_CASHIER_WORKFLOW.md)
- [Facturation par lots](./FINANCE_BILLING_RUNS.md)
- [Corrections financières](./FINANCE_CONTROLLED_CORRECTIONS.md)
- [Rapprochement et clôture](./FINANCE_RECONCILIATION_AND_PERIOD_CLOSE.md)
- [Cycle de vie du personnel](./STAFF_MANAGEMENT_LIFECYCLE.md)

## 9. Glossaire

- **Adhésion scolaire :** association d’un utilisateur à une école avec rôle et statut.
- **Affectation :** périmètre opérationnel attribué à un enseignant.
- **Idempotence :** protection permettant de répéter une requête identique sans créer un doublon.
- **Session de caisse :** période de collecte d’un caissier, d’une date scolaire et d’une devise.
- **Rapprochement :** comparaison entre les encaissements attendus et le dépôt constaté.
- **Contrepassation :** opération qui corrige une écriture sans supprimer son historique.
- **Période clôturée :** intervalle financier verrouillé contre de nouvelles écritures datées.
- **Périmètre scolaire :** ensemble des données appartenant à une école précise.
