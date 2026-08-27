# Going live as a shared, multi-user tool

Everything below is done once. After it, Vigo Present is a real application:
one login per person, one shared library of decks and photography, and edits
that everyone sees.

**This changes how the site is deployed.** Until now the repository served a
single `index.html` — a static file with no server. A shared backend needs the
actual Next.js application running, so step 1 replaces the contents of the
repository.

Budget about twenty minutes.

---

## 1 · Put the application in the repository

The repo currently holds `index.html` plus an old `vigo-present 2/` folder.
Both need to go, replaced by this source.

1. Unzip `vigo-present-source.zip`.
2. Go to https://github.com/2NDNTR/vigo-present
3. Delete `index.html` and the `vigo-present 2` folder (open each → trash icon →
   **Commit changes**).
4. Click **Add file → Upload files**, then drag in the **contents** of the
   unzipped folder — `app`, `components`, `lib`, `public`, `scripts`,
   `standalone`, `package.json`, `tsconfig.json`, `next.config.mjs`,
   `README.md`, `SETUP.md`, `build-standalone.js`.
   Drag the contents, not the folder itself, so files land at the repo root.
5. **Commit changes.**

Vercel will try to build and may fail until step 3 is done. That is expected.

## 2 · Point Vercel at the app

In the Vercel project (`vigo-present-live`) → **Settings → General**:

- **Framework Preset:** Next.js
- **Root Directory:** leave empty (the repo root)

Save.

## 3 · Create the database and file storage

Vercel project → **Storage**:

1. **Create Database → Postgres.** Name it anything. Connect it to this project.
   Vercel sets `POSTGRES_URL` automatically.
2. **Create → Blob.** Connect it to this project. Vercel sets
   `BLOB_READ_WRITE_TOKEN` automatically.

Both have free tiers that comfortably cover ten people.

## 4 · Add two environment variables

Vercel project → **Settings → Environment Variables**. Add to *all*
environments:

| Name | Value |
|---|---|
| `AUTH_SECRET` | a long random string — 40+ characters, any mix. This signs the login cookie. Keep it private and do not change it later, or everyone gets signed out. |
| `ADMIN_EMAIL` | your email address. This becomes the first account. |

A quick way to generate the secret, in Terminal:

```
openssl rand -base64 48
```

## 5 · Redeploy

Vercel → **Deployments** → the latest one → **⋯ → Redeploy**.

Then visit `https://vigo-present-live.vercel.app/api/health`. You want:

```json
{ "backend": "postgres", "database": true, "blob": true, "secret": true, "missing": [] }
```

Anything in `missing` names the environment variable that is still absent.

## 6 · Sign in and add the team

1. Open the site. It now asks you to sign in.
2. Enter your `ADMIN_EMAIL` and **choose a password** — the first sign-in sets it.
3. Click **Team**, add each person by name and email.
4. Tell them to go to the site and sign in with that email and a password of
   their choosing. **No invitation email is sent** — their first sign-in sets
   their password. Say so when you tell them.

Ten people is well inside the free tiers.

---

## What changes for the people using it

- **Everyone sees the same decks.** Create one in Tampa, a rep opens it in
  Atlanta a second later.
- **Everyone shares one photography library.** Upload in the Assets panel and it
  is in the library for the whole team, filed by brand and category.
- **Published links work for anyone**, on any device, signed in or not.
- **Nobody overwrites anybody.** If two people edit the same deck, the second
  save is stopped and offered a choice: load the other person's version, or keep
  their own. Silent loss is not possible.
- **Locking still applies.** A finished deck can be locked read-only.

## Notes

- **Existing decks in your browser do not migrate.** They were saved in local
  storage before the backend existed. Once the backend is on, the dashboard
  starts fresh and shared. Rebuild anything worth keeping — which is a good use
  of the Publix rebuild that was planned anyway.
- **Sign-in only appears when the backend is configured.** Without it the app
  falls back to the open, browser-local mode, so a local copy still runs.
- **Passwords** are hashed with scrypt and never stored or logged in the clear.
  The session is a signed, http-only cookie.
- **To add a custom domain** — `present.vigoimportingco.com` or similar — Vercel
  project → Settings → Domains, then Anthony adds the DNS record Vercel shows.
