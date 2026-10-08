# SSO client in Authentik

The client is a blueprint in the NixOS repository, as are the other
applications: `modules/hosts/server/identity/authentik-blueprints/pilze.yaml`.
The Authentik worker makes the client when the server switches. It also keeps
the client in agreement with the blueprint. Do not change the client by hand.

## Objects of the blueprint

| Object | Value |
| --- | --- |
| Provider `pilze` | Public client, authorization code with PKCE, refresh token |
| Client ID | `pilze` |
| Signing key | The self-signed certificate of the instance |
| Access token | 1 hour |
| Refresh token | 30 days |
| Scopes | `openid`, `email`, `profile`, `offline_access` |
| Redirect URIs | `https://pilze.beimgraben.net/anmeldung`, `…/anmeldung/still`, and `http://localhost:4200/…` for development |
| Application `pilze` | Name Kinoko, launch URL `https://pilze.beimgraben.net/` |
| Group `app_pilze` | The persons who can save. Add the members in the admin interface |

`/anmeldung/still` is the silent renewal in an iframe. The client has no
client secret.

## Duration of the session

The app keeps no token across a restart. After each reload, it gets the
session again without a prompt (`prompt=none` to Authentik). This works only
while the session at Authentik is valid.

The client blueprint does not set the duration of that session. The stage
`default-authentication-login` of the login flow sets it. The default value
`seconds=0` ends the session when the browser closes. On a phone, the app
thus signs out at each restart.

## Result

| Item | Value |
| --- | --- |
| Issuer | `https://sso.beimgraben.net/application/o/pilze/` |
| Discovery | `https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration` |
| JWKS | `https://sso.beimgraben.net/application/o/pilze/jwks/` |
| Client ID | `pilze` |

The NixOS module `services.kinoko` gives the issuer and the client ID to the
service. The options are `oidc.issuer` and `oidc.clientId`. The variables are
`PILZE_OIDC_ISSUER` and `PILZE_OIDC_CLIENT_ID`. The frontend reads them from
`GET /api/config`.

A person in the group of `oidc.adminGroup` (default `pilze-admins`) has each
permission.

## Check

```
curl -s https://sso.beimgraben.net/application/o/pilze/.well-known/openid-configuration | jq .issuer
```

The expected result is `"https://sso.beimgraben.net/application/o/pilze/"`.
If the result is 404, the worker did not apply the blueprint. Then read
`journalctl -u authentik-worker` on the server.
