# Corrections locales de sécurité — 14 septembre 2026

## État

Ce lot est une réduction des risques, pas une certification de sécurité.
Aucune migration, création de compte ou modification de mot de passe n'a été effectuée sur Supabase pendant les tests.
Les tests des actions utilisent des clients simulés et ne valident pas les règles RLS réelles.

## Modifications du code

- Les listes privilégiées nécessitent une session vérifiée. La liste familiale utilise désormais le client soumis aux règles RLS.
- Les modifications d'équipe vérifient ensemble l'église, l'utilisateur et le contexte ciblé.
- Ajouter un compte existant à une équipe ne réinitialise plus son mot de passe. Les identifiants globaux ne sont plus modifiables depuis l'éditeur d'équipe.
- Les accès désactivés ou rétrogradés prennent priorité sur un ancien profil pour les actions de gestion d'équipe. Une erreur de lecture des droits refuse l'accès.
- Le rôle familial est déduit du membre actif en base, pas des paramètres envoyés par le navigateur. Une personne ne peut pas créer le contexte d'une autre.
- La création anonyme par code partagé est bloquée. Un premier compte doit désormais être provisionné par un responsable autorisé. La gestion d'équipe existante couvre l'intégration ; un parcours sécurisé de provisionnement familial reste à réaliser.
- Le mot de passe familial n'est plus enregistré ni prérempli depuis `poimen_saved_info`. Les anciennes valeurs sont retirées au prochain chargement du tableau de bord.
- Zoom autorisé, champs de connexion associés à leurs libellés, bouton de visibilité nommé ; lien `/forgot` inexistant remplacé par une consigne de contact (aucun parcours de récupération par e-mail ajouté).
- En-têtes anti-framing, anti-MIME-sniffing et réduction des informations de référence. La CSP est minimale, pas une protection complète contre les injections de scripts.

## Migration préparée, NON appliquée

Fichier : `supabase/patch_v4.8_security_hardening.sql`.

Sur une copie de préproduction avec les correctifs précédents jusqu'à v4.7 :

1. Sauvegarder le schéma, les politiques et les données ; identifier les divergences avec les SQL locaux.
2. Examiner les fonctions `SECURITY DEFINER` et les triggers existants : ils peuvent agir avec d'autres privilèges que le navigateur.
3. Appliquer le fichier transactionnel. Il retire les écritures directes sur les contextes, protège les champs d'autorité des profils et limite les rapports de culte aux responsables/seconds de l'église et à l'administrateur central.
4. Tester avec des comptes dédiés : anonyme, conseiller, responsable A, responsable B, compte révoqué et administrateur. Vérifier les accès directs via l'API Supabase, pas seulement l'interface.
5. Adapter les anciens écrans qui créent/modifient directement des profils ou des contextes : ces opérations seront refusées. Vérifier spécialement le provisionnement familial, l'administration et les rapports de culte.

Ne pas rejouer les anciennes migrations de permissions après ce correctif.
Ce SQL n'a pas été exécuté sur un moteur PostgreSQL pendant cette intervention.

## Risques importants encore ouverts

- Les anciennes politiques publiques de `churches` et `bergeries` peuvent exposer les codes d'accès. Les codes doivent sortir des lectures publiques ; il faut remplacer les parcours qui en dépendent, puis les renouveler.
- Les invitations publiques, l'insertion des invités, les autres tables et fonctions SQL doivent être revues pour l'isolation entre églises et familles.
- Les écrans historiques utilisent encore des données de rôle et de contexte dans localStorage. Ce stockage n'est jamais une preuve d'autorisation ; les RLS doivent rester la barrière réelle.
- Un profil déjà altéré avant le correctif n'est pas réparé automatiquement. Vérifier les rôles et appartenances existants avant mise en production.
- Le provisionnement par un responsable utilise encore un mot de passe initial avec e-mail confirmé administrativement. Remplacer ce parcours par une invitation nominative à usage unique avec preuve de possession de l'adresse.
- La gestion des sessions SSR, les mots de passe oubliés, la limitation de débit et les parcours complets multi-comptes restent à vérifier/compléter.
- La mise à jour des dépendances n'est pas réalisée. L'audit npm a rencontré une erreur de certificat ; ne pas désactiver la vérification TLS pour la contourner.
- Le lint global contient des erreurs antérieures à ce lot. Aucun déploiement de production ne doit être considéré comme validé par les seuls tests unitaires et le build.

## Vérifications reproductibles

```text
npm test
npm run build
npm run lint
```

La suite teste les refus anonymes, les accès révoqués, la conservation du mot de passe d'un compte existant, le ciblage inter-église, l'identité familiale, la validation des rôles, l'identité administrateur réservée et le refus en cas d'indisponibilité des droits.
