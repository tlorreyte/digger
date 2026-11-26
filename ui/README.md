# Digger UI

TanStack Start app. Users sign in through [Dex](https://dexidp.io) (OpenID Connect) with the Dex GitHub connector. Organizations are the user's GitHub organizations, read from the `groups` claim.

- [TanStack Router Docs](https://tanstack.com/router)

## Running locally

1. Run Dex with a GitHub connector and a static client for this app. See `self-hosting/dex/config.yaml` and `docs/self-hosting/dex-setup.mdx`. The client's redirect URI must be `http://localhost:3030/api/auth/callback`.

2. Copy `.env.example` to `.env` and fill in:

   ```bash
   DEX_ISSUER_URL=http://localhost:5556/dex
   DEX_CLIENT_ID=digger-ui
   DEX_CLIENT_SECRET=<static client secret>
   DEX_REDIRECT_URI=http://localhost:3030/api/auth/callback
   SESSION_COOKIE_PASSWORD=<at least 32 characters>
   ```

   `SESSION_COOKIE_PASSWORD` encrypts the session cookie. Generate one with:

   ```bash
   openssl rand -base64 32
   ```

   Optional: `SESSION_COOKIE_NAME` (default `digger-session`) and `SESSION_COOKIE_DOMAIN`.

3. Run `npm run dev` and open [http://localhost:3030](http://localhost:3030).
