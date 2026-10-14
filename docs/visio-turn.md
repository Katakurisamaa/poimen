# Relais TURN pour les visioconférences

La vue Visio utilise STUN pour établir une connexion directe et consulte `/api/visio/turn-credentials` pour obtenir un relais TURN quand il est configuré. Ajoutez ces deux variables **côté serveur** dans `.env.local` et dans l'environnement d'hébergement :

```env
VISIO_TURN_URLS=turn:turn.example.org:3478?transport=udp,turns:turn.example.org:5349
VISIO_TURN_SHARED_SECRET=secret-statique-partagé-avec-coturn
```

Le serveur signe des justificatifs Coturn temporaires, valides une heure, et les renvoie au navigateur avec `Cache-Control: no-store`. Le serveur Coturn doit activer l'authentification REST (`use-auth-secret`) avec le même secret. Remplacez les exemples par les URLs et le secret fournis par votre service TURN.

L'endpoint renvoie ce format :

```json
{
  "iceServers": [
            { "urls": ["turn:turn.example.org:3478?transport=udp", "turns:turn.example.org:5349"], "username": "expiry:temporary-id", "credential": "signed-temporary-password" }
  ]
}
```

ou :

```json
{
  "urls": ["turn:turn.example.org:3478?transport=udp"],
  "username": "expiry:temporary-id",
  "credential": "signed-temporary-password"
}
```

Le secret partagé ne doit jamais être préfixé par `NEXT_PUBLIC_` ni envoyé au navigateur. En l'absence de cette configuration ou si l'endpoint échoue, l'appel continue avec STUN et l'interface le signale.

La salle d'attente et les actions d'animateur reposent pour le moment sur les événements Supabase Realtime utilisés par l'appel. Elles coordonnent les participants, mais ne remplacent pas une autorisation serveur pour empêcher un client modifié de contourner une admission ou une demande de coupure de micro.
