# Manuel utilisateur final — ALMAC School Management

**Version :** 1.0 — pilote contrôlé

**Révision :** 12 septembre 2026 — version déployée à confirmer auprès de l’école

**Public :** Super Admin, administrateurs scolaires, enseignants, responsables financiers et parents

## 1. Bien démarrer

### Connexion

1. Ouvrez l’adresse HTTPS communiquée par votre école.
2. Saisissez votre adresse électronique et votre mot de passe.
3. Sélectionnez **Se connecter**.
4. Vérifiez le nom de l’école et votre rôle avant de commencer.

Il n’existe pas d’inscription publique. Si vous n’avez pas de compte, contactez l’administrateur de votre école.

### Première activation par invitation

1. Ouvrez le courriel d’invitation le plus récent.
2. Vérifiez le nom de l’école et le rôle proposé.
3. Ouvrez le lien sécurisé avant son expiration.
4. Complétez l’activation et créez un mot de passe conforme aux indications. Si vous possédez déjà un compte ALMAC actif, suivez le parcours de connexion et d’acceptation proposé; un nouveau mot de passe n’est pas nécessairement demandé.
5. Revenez à la page de connexion.

Un lien accepté, révoqué ou expiré ne peut pas être réutilisé. Si le courriel n’arrive pas, vérifiez les courriers indésirables puis demandez un renvoi. Ne transférez pas le lien à une autre personne.

### Mot de passe oublié

1. Sélectionnez **Mot de passe oublié ?**.
2. Saisissez votre adresse électronique.
3. Ouvrez le courriel de récupération le plus récent.
4. Choisissez un nouveau mot de passe.
5. Reconnectez-vous sur vos appareils.

Pour protéger les comptes, le message de récupération reste volontairement général et ne confirme pas si une adresse existe.

### Déconnexion

Utilisez toujours la commande de déconnexion, particulièrement sur un ordinateur partagé. Fermer seulement l’onglet ne remplace pas la déconnexion.

## 2. Comprendre l’interface

- La navigation principale affiche uniquement les modules autorisés pour votre rôle.
- Les raccourcis avec icônes ouvrent les opérations les plus fréquentes.
- Le fil d’Ariane en haut permet de revenir au niveau précédent.
- Les pastilles colorées représentent les statuts.
- Les boutons avec une icône seule disposent d’une info-bulle; placez le pointeur dessus pour connaître l’action.
- Les données correspondent à l’école actuellement sélectionnée.

Couleurs habituelles :

- vert : terminé, actif ou conforme;
- bleu : information ou opération normale;
- orange : attention ou action en attente;
- rouge : blocage, retard, suspension ou erreur.

Ne changez jamais un identifiant dans l’adresse du navigateur ou dans les outils de développement. Le serveur refusera tout accès hors de votre école ou de votre périmètre.

## 3. Super Admin ALMAC

### Créer une école

1. Ouvrez l’espace **Plateforme** puis **Écoles**.
2. Sélectionnez la création d’une école.
3. Complétez les informations officielles et vérifiez-les.
4. Enregistrez l’école.
5. Créez ou invitez son premier administrateur scolaire par le workflow prévu.
6. Vérifiez que l’administrateur possède une adhésion scolaire **ACTIVE**.

### Entrer dans une école administrée

Depuis le dossier de l’école, ouvrez son espace scolaire. Le bouton de retour vers l’interface Super Admin permet de quitter ce contexte. Vérifiez toujours l’école active avant une modification.

### Gouvernance des comptes

La suspension globale d’un compte ALMAC est réservée au Super Admin. Une suspension scolaire effectuée par un administrateur d’école ne doit pas suspendre la personne dans ses autres écoles.

## 4. Administrateur scolaire

### Ordre recommandé de configuration

1. **École / Configuration** : identité, paramètres et fuseau horaire.
2. **Structure académique** : année, classes, sections, matières et périodes.
3. **Personnel** : dossiers d’emploi et affectations.
4. **Utilisateurs** : invitations et accès.
5. **Élèves** : admissions, dossiers, responsables et placement.
6. **Finance** : paramètres, plans, méthodes de paiement et autorisations.

### Gérer les utilisateurs

Dans **Utilisateurs** :

1. saisissez l’adresse électronique et le nom;
2. choisissez un rôle autorisé;
3. pour un parent, choisissez un responsable de la même école;
4. pour la finance, sélectionnez uniquement les permissions nécessaires;
5. envoyez l’invitation;
6. suivez son statut dans l’onglet des invitations.

Vous pouvez renvoyer une invitation en attente ou la révoquer. Vous ne pouvez pas inviter un Super Admin, suspendre votre propre accès actif ou suspendre le dernier administrateur scolaire actif.

### Créer un dossier personnel

1. Ouvrez **Personnel**.
2. Recherchez la personne avant toute création.
3. Sélectionnez **Ajouter** et complétez l’identité, l’emploi et les coordonnées.
4. Ajoutez seulement les données médicales nécessaires à la sécurité au travail.
5. Enregistrez le dossier.
6. Accordez un compte plus tard si l’employé doit utiliser l’application.

Un employé sans compte peut tout de même être affecté administrativement et être admissible à la paie.

### Importer le personnel par CSV

1. Téléchargez ou utilisez le modèle CSV fourni par l’écran d’import.
2. Conservez exactement les en-têtes attendus.
3. Enregistrez le fichier en UTF-8 CSV.
4. Téléversez le fichier et lancez la prévisualisation.
5. Corrigez toutes les lignes en erreur dans le fichier source.
6. Relancez la prévisualisation.
7. Confirmez uniquement lorsque le résumé correspond au fichier attendu.

N’utilisez pas Excel pour transformer automatiquement les codes, dates ou numéros. Vérifiez particulièrement les accents, zéros initiaux et formats de date.

La limite est de 500 lignes par import. Les dossiers importés sont créés en brouillon, sans compte ni invitation automatique. Vérifiez puis activez les dossiers par le cycle d’emploi prévu. L’import est transactionnel : une erreur bloquante empêche la création du lot.

### Cycle de vie du personnel

Utilisez les actions prévues pour congé, suspension, fin d’emploi ou archivage. Ne supprimez jamais un dossier afin de masquer une ancienne relation d’emploi. Une suspension ou une fin d’emploi peut révoquer l’accès et désactiver les responsabilités actives.

### Affecter un enseignant

1. Ouvrez le dossier du membre du personnel.
2. Vérifiez qu’il est actif et de type enseignant.
3. Sélectionnez l’année académique.
4. Ajoutez chaque combinaison section + matière.
5. Enregistrez et demandez à l’enseignant de se reconnecter.

### Gérer les élèves

Avant de créer, recherchez par nom, code et responsable.

Pour une création individuelle :

1. ouvrez **Élèves** puis **Nouvel élève**;
2. saisissez l’identité;
3. sélectionnez la section ou choisissez une affectation ultérieure;
4. vérifiez le résumé;
5. créez le dossier;
6. ajoutez responsables, documents et informations complémentaires depuis le profil.

Pour modifier le statut, utilisez l’action dédiée et indiquez un motif administratif. Un élève actif doit être correctement placé.

### Importer les élèves par CSV

1. Préparez le fichier selon le modèle affiché.
2. Utilisez l’encodage UTF-8.
3. Lancez la prévisualisation.
4. Contrôlez les doublons, noms, codes, dates, sexe et section.
5. Corrigez les erreurs avant confirmation.
6. Importez une seule fois puis vérifiez le nombre créé.

Le fichier `test-data/student-import-stress-600.csv` est réservé aux tests de charge sur un environnement jetable. Ne l’importez jamais dans une école réelle.

La limite est de 1 000 lignes par import. Le lot est transactionnel : ne supposez pas que les lignes valides ont été créées si la confirmation échoue. Consultez le résultat puis recherchez les élèves avant une nouvelle tentative.

### Structure académique

Dans **Académique**, vérifiez :

- l’année active;
- les classes et sections;
- les capacités;
- les matières configurées;
- les matières affectées à un enseignant;
- les élèves sans placement.

Corrigez les alertes de préparation avant le début des présences ou des notes.

## 5. Enseignant

### Prendre les présences

1. Ouvrez **Présences**.
2. Choisissez une section qui vous est affectée.
3. Vérifiez la date scolaire et la session matin/après-midi.
4. Marquez chaque élève : présent, absent, en retard ou excusé.
5. Ajoutez une note uniquement si nécessaire.
6. Relisez la liste puis soumettez.

Si une section attendue n’apparaît pas, contactez l’administrateur; n’essayez pas d’utiliser l’adresse d’une autre section.

### Saisir les notes

1. Ouvrez **Cahier de notes**.
2. Choisissez votre section et votre matière.
3. Vérifiez la période d’évaluation.
4. Créez ou ouvrez l’évaluation.
5. Saisissez les notes en respectant le maximum prévu.
6. Enregistrez et contrôlez les notes manquantes.

Vous ne pouvez pas saisir des notes pour une matière non affectée. Après un changement d’affectation, reconnectez-vous.

## 6. Responsable financier

Les menus visibles dépendent de vos permissions. Une page visible ne remplace pas l’autorisation du serveur.

### Lire le tableau de bord

Dans **Finances → Aperçu** :

- **Facturé** indique le total des factures;
- **Encaissé** indique les paiements confirmés;
- **À recevoir** indique le solde ouvert;
- les listes récentes permettent d’ouvrir une facture ou un reçu;
- chaque devise est présentée séparément.

### Enregistrer un paiement

1. Ouvrez **Finances → Caisse**.
2. Recherchez l’élève par nom ou code.
3. Sélectionnez une facture avec solde.
4. Ouvrez une session pour la date scolaire et la devise si nécessaire.
5. Saisissez montant, méthode, référence et note utile.
6. Vérifiez le résumé.
7. Confirmez une seule fois.
8. Imprimez le reçu.

Avant de réessayer après une interruption, vérifiez si le paiement existe déjà. La protection d’idempotence évite normalement le doublon, mais le contrôle visuel reste obligatoire.

### Fermer une session de caisse

1. Terminez les encaissements de la session.
2. Comptez les espèces physiques.
3. Comparez le montant compté au montant attendu.
4. Expliquez toute différence.
5. Fermez la session.

Les paiements non espèces figurent dans le résumé mais n’augmentent pas le montant physique attendu. Une session HTG ne doit jamais être mélangée à une session USD.

### Facturation par lots

1. Ouvrez **Finances → Facturation**.
2. Créez ou sélectionnez le plan.
3. Saisissez un code de période stable.
4. Prévisualisez les élèves admissibles et les doublons.
5. Sélectionnez les élèves à facturer.
6. Vérifiez le total et la devise.
7. Confirmez une seule fois.
8. Examinez le rapport du traitement.

Une opération est limitée à 500 élèves. Un élève déjà facturé pour la même identité de période est ignoré comme doublon.

### Demander une correction

1. Ouvrez la facture ou le reçu.
2. Choisissez l’action de correction.
3. Sélectionnez annulation, remboursement ou note de crédit selon le cas.
4. Entrez un motif précis d’au moins dix caractères.
5. Soumettez la demande.
6. Une autre personne autorisée doit l’approuver ou la rejeter.
7. Traitez ensuite l’opération approuvée si nécessaire.

Le paiement original demeure dans l’historique. Le demandeur ne peut pas approuver sa propre correction.

### Rapprocher un dépôt

1. Fermez les sessions de caisse concernées.
2. Ouvrez **Finances → Rapprochement**.
3. Sélectionnez la destination bancaire ou de caisse.
4. Sélectionnez les sessions admissibles.
5. Comparez le calcul attendu au bordereau.
6. Saisissez montant, référence, date et note.
7. Soumettez le dépôt.
8. Une autre personne autorisée le rapproche ou le rejette.

N’inscrivez jamais un numéro de compte complet, un PIN ou un identifiant bancaire dans le champ de référence.

### Clôturer une période

Avant la clôture, résolvez :

- sessions de caisse ouvertes;
- dépôts en attente;
- corrections en attente;
- sessions encaissées sans dépôt rapproché.

Après clôture, les écritures datées dans la période sont verrouillées. La réouverture est exceptionnelle, autorisée et accompagnée d’un motif détaillé.

### Paie

1. Vérifiez les profils et versions de rémunération.
2. Créez un traitement de paie en brouillon.
3. Contrôlez personnel, devise, indemnités et retenues.
4. Soumettez le traitement à révision.
5. Le réviseur termine la révision et transmet le traitement en attente d’approbation à l’administrateur scolaire actif.
6. Après approbation, commencez le traitement puis enregistrez les paiements.
7. Produisez le registre et les fiches de paie.
8. L’administrateur scolaire actif clôture lorsque toutes les vérifications sont terminées.

Un traitement clôturé est verrouillé. Les contrepassations de paiement sont proposées avant clôture, pour les traitements en cours ou payés. Après clôture, signalez l’erreur au responsable habilité; ne modifiez pas les données historiques.

La version de rémunération retenue est celle effective au début de la période. Un employé sans connexion peut être payé; le calcul horaire ou journalier n’est pas disponible dans ce parcours.

### Espace personnel de l’employé

Les employés autorisés, actifs ou en congé avec compte lié, peuvent ouvrir **Mon profil personnel** (`/my-staff-profile`) pour consulter leurs informations d’emploi et d’adresse, télécharger leurs documents standards permis et soumettre une demande de congé. Une demande encore en attente peut être retirée par son auteur. Les données médicales, salariales et documents restreints sont exclus. Pour corriger une information, contactez l’administrateur.

## 7. Parent ou responsable

Le serveur limite les consultations financières et les bulletins aux élèves reliés au compte. Cependant, une interface web dédiée au portail parent n’a pas été identifiée dans la version examinée. Demandez à l’école quel canal de consultation est effectivement disponible avant de suivre un parcours de connexion parent.

Si un enfant manque ou si un élève inconnu apparaît, déconnectez-vous immédiatement et contactez l’école. N’envoyez pas d’informations médicales ou scolaires sensibles par messagerie non sécurisée.

## 8. Impression et documents

- Vérifiez le nom, le numéro, la date et la devise avant impression.
- Utilisez le format standard pour un document complet et le format 80 mm pour une imprimante thermique.
- Une réimpression de reçu peut exiger un motif et être journalisée.
- Ne modifiez pas manuellement un reçu ou une facture exportée.
- Stockez les documents téléchargés dans un emplacement protégé.

## 9. Messages fréquents

| Message ou situation | Action recommandée |
|---|---|
| Adresse ou mot de passe incorrect | Vérifier l’adresse; utiliser la récupération plutôt que multiplier les essais |
| Request origin is not allowed | Utiliser l’adresse officielle de l’application; contacter le support si elle est correcte |
| Service temporairement indisponible | Attendre brièvement, réessayer une fois puis signaler avec l’heure |
| Accès administrateur actif requis | Vérifier que l’adhésion scolaire et le rôle sont actifs |
| Accès refusé / 403 | Vérifier l’école, le rôle, la permission ou l’affectation |
| Session expirée | Se reconnecter; ceci peut suivre une suspension ou un changement de périmètre |
| Invitation expirée ou révoquée | Demander une nouvelle invitation |
| Courriel non reçu | Vérifier les indésirables puis demander un renvoi autorisé |
| Import CSV refusé | Corriger les lignes signalées, l’encodage et les en-têtes |
| Période financière clôturée | Faire examiner une correction ou une réouverture autorisée; ne pas changer la date réelle pour contourner le verrouillage |

## 10. Bonnes pratiques de sécurité

- Utilisez un mot de passe unique et long.
- Ne partagez jamais compte, mot de passe, lien d’invitation ou lien de récupération.
- Ne transmettez pas de capture contenant des données sensibles inutiles.
- Déconnectez-vous des appareils partagés.
- Vérifiez l’école active avant toute écriture.
- Accordez seulement les permissions nécessaires.
- Signalez immédiatement un élève, une école ou une opération qui ne devrait pas être visible.
- Pour le support, transmettez l’identifiant de requête et non vos informations d’authentification.

## 11. Aide et escalade

Pour une question de données ou de rôle, contactez d’abord l’administrateur scolaire. Pour une indisponibilité, un problème de sécurité ou une erreur répétée, l’administrateur contacte le support ALMAC avec :

- date et heure;
- page concernée;
- action effectuée;
- rôle et école;
- message reçu;
- identifiant de requête, si affiché;
- capture expurgée des données sensibles.

Ne communiquez jamais le mot de passe, le cookie de session ou un lien contenant un jeton.
