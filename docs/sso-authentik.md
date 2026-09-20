# SSO-Client in Authentik

Der Client ist ein Blueprint im NixOS-Repo, wie die anderen Anwendungen:
`modules/hosts/server/identity/authentik-blueprints/pilze.yaml`. Der
Authentik-Worker legt ihn beim Switch des Servers an und gleicht ihn ab.
Nichts wird von Hand geklickt.

## Was der Blueprint anlegt

| Objekt | Wert |
| --- | --- |
| Provider `pilze` | Public Client, Authorization Code mit PKCE, Refresh Token |
| Client ID | `pilze` |
| Signing Key | das selbstsignierte Zertifikat der Instanz |
| Access Token | 1 Stunde |
| Refresh Token | 30 Tage |
| Scopes | `openid`, `email`, `profile`, `offline_access` |
| Redirect URIs | `https://pilze.beimgraben.net/anmeldung`, `…/anmeldung/still`, dazu `http://localhost:4200/…` für die Entwicklung |
| Anwendung `pilze` | Name Kinoko, Launch URL `https://pilze.beimgraben.net/` |
| Gruppe `app_pilze` | wer speichern darf. Mitglieder werden in der Admin-Oberfläche zugewiesen |

`/anmeldung/still` ist die stille Erneuerung im iframe. Es gibt kein
Client-Secret.

## Wie lange die Sitzung hält

Die App hält kein Token über einen Neustart. Nach jedem Neuladen holt sie die
Sitzung still zurück, mit `prompt=none` gegen Authentik. Das gelingt nur,
solange die Sitzung bei Authentik selbst steht. Deren Dauer steht nicht im
Blueprint des Clients, sondern an der Stufe `default-authentication-login` des
Anmeldeflusses. Der Vorgabewert `seconds=0` endet mit dem Browser. Am Telefon
heißt das: die App ist nach jedem Neustart abgemeldet.

## Ergebnis

| Was | Wert |
| --- | --- |
| Issuer | `https://sso.beimgraben.net/application/o/pilze/` |
| Discovery | `https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration` |
| JWKS | `https://sso.beimgraben.net/application/o/pilze/jwks/` |
| Client ID | `pilze` |

Das NixOS-Modul `homeserver-pilze-app` setzt Issuer und Client ID als
`PILZE_OIDC_ISSUER` und `PILZE_OIDC_CLIENT_ID`. Das Frontend liest sie aus
`GET /api/config`.

## Prüfen

```
curl -s https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration | jq .issuer
```

Erwartet: `"https://sso.beimgraben.net/application/o/pilze/"`. Bei 404 hat
der Worker den Blueprint nicht angewendet, siehe `journalctl -u
authentik-worker` auf dem Server.
