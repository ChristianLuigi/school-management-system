# UX7 — Validation avec le personnel scolaire

Statut : protocole prêt ; séances et approbation humaine en attente.

Ce protocole complète [UAT_CHECKLIST.md](UAT_CHECKLIST.md) et les contrôles détaillés de [UX_ROADMAP.md](UX_ROADMAP.md). Les tests automatisés ne prouvent pas qu’un utilisateur trouve le parcours intuitif.

## Préparer la séance

1. Identifier l’URL et la version effectivement testée. Les modifications UX1–UX6 locales ne sont pas encore commitées : ne pas supposer que la version en ligne les contient. Enregistrer les versions API/web séparément et la vérification des migrations.
2. Utiliser une école de test A et une école B avec des données distinctes. Vérifier les accès School Admin, Administrative Staff, enseignant affecté et agent financier autorisé à encaisser. Ne pas partager de mots de passe dans les comptes rendus.
3. Préparer une classe A avec cinq élèves fictifs, une classe non affectée à l’enseignant et une séance de présence non enregistrée à la date de test.
4. Préparer une facture émise de 100 HTG sans paiement, une facture USD et une caisse HTG. Réutiliser la même facture uniquement lorsque son solde attendu est connu. Tous les paiements restent des opérations de test.
5. Préparer un élève fictif à créer : `TEST UX7 <identifiant de séance>`, prénom `Camille`, date de naissance `2014-05-12`, sans classe initiale. Responsable fictif : `Responsable TEST UX7`, téléphone de test fourni par l’opérateur ; aucun courriel envoyé à une personne réelle.
6. Choisir les participants : au minimum une personne qui effectue réellement chaque tâche (administration, présences, encaissement). Si possible, inclure un débutant et un habitué. Une seule personne jouant tous les rôles donne une couverture limitée ; la noter.
7. Prévoir environ 30–45 minutes par participant, en français puis vérifier les libellés anglais avec un utilisateur compétent. Tester un ordinateur et un écran de 375 px, le clavier seul, et le zoom 200 %.

## Consignes du modérateur

Lire la tâche sans indiquer les boutons ni la succession d’écrans. Demander au participant de dire ce qu’il comprend et ce qu’il attend. Ne pas le guider immédiatement : noter l’hésitation, la mauvaise direction et les mots incompris. Toute aide donnée compte comme intervention.

Pour chaque tâche, relever le temps de début/fin, le résultat, le nombre d’interventions, l’erreur observée et une citation courte du participant. Si le temps dépasse cinq minutes sans progression, proposer une aide et enregistrer un résultat « avec aide » ; ce seuil sert à organiser la séance, pas à attribuer une note de maturité.

Ne pas enregistrer de session/token, de cookie, de mot de passe ou de donnée réelle d’élève dans les captures. Une capture ou un enregistrement nécessite l’accord du participant. Retester les défauts après correction avec la version indiquée.

## Tâches à lire au participant

| ID | Rôle | Consigne, sans indications de navigation |
| --- | --- | --- |
| E1 | School Admin | « Créez le dossier de Camille avec les renseignements fournis. La classe n’est pas encore décidée. Retrouvez le dossier créé et ajoutez son responsable. Dites-moi ce qu’il reste à compléter. » |
| E2 | Administrative Staff | « Créez le dossier d’un autre élève fictif, retrouvez-le et corrigez son lieu de naissance. Dites-moi comment vous demanderiez une affectation à une classe. » |
| A1 | Enseignant affecté | « Prenez les présences de la classe de test : trois élèves présents, un absent avec la note “Signalé par le responsable”, un en retard. Enregistrez et vérifiez le résultat. » |
| A2 | Enseignant affecté | « Corrigez une présence, puis consultez une autre séance. Gardez votre correction quand l’application vous propose de l’abandonner. Enregistrez-la ensuite. » |
| F1 | Agent financier autorisé | « L’élève doit 100 HTG et verse 25 HTG aujourd’hui. Enregistrez le paiement, vérifiez le solde restant et ouvrez son reçu. » |
| F2 | Agent financier autorisé | « Préparez un deuxième paiement par virement, avec la référence fournie. Vérifiez les détails, modifiez le montant avant confirmation, puis confirmez une seule fois. » |
| N1 | School Admin multi-école | « Depuis un dossier de l’école A, passez à l’école B. Identifiez l’école dans laquelle vous travaillez, puis revenez à l’école A. » |

## Vérifications du modérateur

- **E1** : un seul dossier créé ; statut/classe en attente cohérent ; responsable lié au bon élève ; aperçu et repères reflètent les données effectivement enregistrées. Les documents manquants ne sont pas présentés comme vérifiés.
- **E2** : seul le parcours d’identité est accessible. Aucun contrôle de placement, santé, documents privés ou gestion des responsables n’est ajouté au rôle. Les règles API continuent à refuser les actions non autorisées.
- **A1** : au départ les élèves sont non renseignés ; après saisie les totaux sont 3 présents, 1 absent, 1 retard. La note est conservée ; classe/date/session correspondent à la demande ; la confirmation reste visible.
- **A2** : Annuler l’abandon conserve les valeurs et le contexte. Après sauvegarde, le nouvel état est retrouvé. Tester également une classe non affectée et une séance verrouillée : refus API et aucune modification.
- **F1** : montant 25 HTG, solde restant 75 HTG, un paiement et un reçu dans le registre. Le reçu correspond au bon élève, à la facture et à la devise. Tester A4 et 80 mm lorsque l’imprimante est disponible ; sinon consigner « non testé ».
- **F2** : référence obligatoire pour le virement ; revue mise à jour après modification ; caisse/devise concordantes. Double clic et raccourci clavier ne produisent pas un second paiement pendant la requête.
- **N1** : école affichée correcte ; aucun identifiant de dossier/filtre d’année de A réutilisé dans B ; échec simulé du changement conserve A et annonce une erreur. Vérifier les raccourcis par rôle.

## Séance technique de récupération

Effectuer ces tests avec un modérateur technique, après les tâches sans assistance :

1. Activer Slow 3G dans DevTools. Vérifier indicateurs de chargement, absence de faux résultats vides et protection contre les anciennes réponses.
2. Bloquer une requête de lecture de liste/caisse, puis la débloquer. Vérifier le message, la possibilité de réessayer et le contexte conservé.
3. Bloquer une sauvegarde avant son envoi. Vérifier que les données restent dans le formulaire. Ce test **ne prouve pas** la récupération d’un paiement déjà enregistré dont la réponse est perdue.
4. Pour une vraie réponse de paiement perdue, utiliser une interception contrôlée dans un environnement jetable qui laisse l’API enregistrer le paiement puis supprime/remplace la réponse. Réessayer la confirmation exacte et comparer la clé d’idempotence uniquement localement, sans la publier. Vérifier un seul paiement/reçu et le solde attendu. Si cette interception n’est pas disponible, marquer le cas « bloqué/non testé ».
5. Ouvrir/fermer le menu mobile au clavier : Tab/Shift+Tab restent dans le menu, Escape ferme, focus revient au bouton, défilement est rétabli. Redimensionner vers ordinateur puis mobile.
6. Vérifier lecteur d’écran, focus visible, libellés et annonces à 200 % de zoom. Les tables peuvent défiler horizontalement ; la page entière ne doit pas imposer ce défilement.
7. Tester navigation normale, rechargement, Back/Forward et changement d’école avec des modifications non enregistrées ou un paiement incertain. Les deux derniers parcours ne sont pas universellement interceptés par les protections actuelles : noter toute perte réelle, son impact et sa décision de correction.

## Décision et retest

- **P0** : fuite/accès indu, corruption, paiement doublé ou mauvais élève/devise. Arrêter le scénario et bloquer l’approbation.
- **P1** : tâche principale impossible, perte de données non récupérable ou résultat financier trompeur. Corriger et retester avant approbation.
- **P2** : friction contournable, libellé ambigu ou traduction manquante. Attribuer un responsable et une échéance ; une dérogation doit être écrite et acceptée par le responsable scolaire.
- **P3** : ajustement visuel sans effet sur la tâche.

Pour approuver UX7 : chacune des trois tâches principales réussit sans coaching lors du retest final ; zéro P0/P1 ouvert ; les contrôles de récupération, rôle, mobile/clavier et reçus ont une preuve ou un blocage explicitement résolu. Les P2 acceptés ont un plan. L’école et le responsable technique signent [UX7_RESULTS.md](UX7_RESULTS.md). Une approbation UX ne remplace pas les critères de mise en production de RELEASE_CHECKLIST.md.
