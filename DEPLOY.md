# Make the portfolio live on Cloudflare (free) from GitHub

This guide takes the project from a GitHub repository to a live website on Cloudflare,
with automatic updates every time you push to GitHub. No credit card is needed.

**Time needed:** about 15 minutes. **You need:** a GitHub account with this project in a repository.

The finished site will look like `https://my-portfolio.<your-account>.workers.dev`
and will have an admin panel at `/admin/` to edit everything.

---

## Before you start: check the repository

Make sure these files are in your GitHub repository (they should be, if you uploaded the whole folder):

| File / folder | Why it's needed |
| --- | --- |
| `wrangler.jsonc` | Cloudflare settings |
| `src/worker.js`, `src/seo.mjs` | The website's backend |
| `public/` | The website itself (pages, styles, admin) |
| `data/content.json` | All the portfolio text — shown until the first save in the admin |
| `package.json`, `package-lock.json` | Tells Cloudflare what to install |

These must **not** be in the repository: `node_modules/`, `data/auth.json`, `.dev.vars`
(the included `.gitignore` already keeps them out).

> **Tip: consider a Private repository.** Recommended if you keep personal data or snapshots in it; Cloudflare can deploy private repos too.
> GitHub → your repo → **Settings → General → Danger Zone → Change visibility → Private**.
> Cloudflare can still deploy private repositories.

---

## Step 1 — Create a free Cloudflare account

1. Go to <https://dash.cloudflare.com/sign-up>.
2. Sign up with your email and verify it.
3. You land on the Cloudflare dashboard.

---

## Step 2 — Choose your workers.dev subdomain (first time only)

Every account gets a free address ending in `.workers.dev`.

1. In the left menu click **Compute (Workers)** → **Workers & Pages**
   (on some accounts it is just **Workers & Pages**).
2. On the right side you will see **Subdomain** (for example `yourname.workers.dev`).
   If it asks you to set one up, choose a name — e.g. `yourname` — and confirm.

Your site address will be: `https://my-portfolio.<subdomain>.workers.dev`

---

## Step 3 — Create the storage (KV namespace) and paste its ID

The site saves admin edits, photos and the login in Cloudflare's free storage called **KV**.

1. In the left menu click **Storage & Databases** → **KV**
   (older dashboards: **Workers & Pages → KV**).
2. Click **Create** (or **Create a namespace**).
3. Name it `my-portfolio` and click **Add / Create**.
4. You now see the namespace in a list with an **ID** — a long code like
   `0123456789abcdef0123456789abcdef`. Click the copy icon next to it.
5. Open your GitHub repository in the browser and open the file **`wrangler.jsonc`**.
6. Click the ✏️ **pencil (Edit this file)** icon.
7. Find this line:
   ```
   "id": "PASTE_YOUR_KV_NAMESPACE_ID_HERE"
   ```
   and replace the text between the quotes with your ID, for example:
   ```
   "id": "0123456789abcdef0123456789abcdef"
   ```
8. Click **Commit changes…** → **Commit changes**.

> Do not change `"binding": "PORTFOLIO"` — the code uses that name.

---

## Step 4 — Connect GitHub and deploy

1. In Cloudflare, go to **Workers & Pages** and click **Create** (or **Create application**).
2. Choose **Import a repository** (under the *Workers* tab — not *Pages*).
3. Click **Connect GitHub** / **GitHub**. A GitHub window opens:
   - Click **Install & Authorize**.
   - Choose **Only select repositories**, pick your portfolio repository, and confirm.
4. Back in Cloudflare, select your repository and click **Next / Begin setup**.
5. Fill in the settings **exactly**:

   | Setting | Value |
   | --- | --- |
   | **Project name** | `my-portfolio` ← must match `"name"` in `wrangler.jsonc` |
   | **Production branch** | `main` (or whatever your branch is called) |
   | **Build command** | *(leave empty)* |
   | **Deploy command** | `npx wrangler deploy` |
   | **Root directory / Path** | `/` (leave as is) |

6. Click **Create and deploy** (or **Save and Deploy**).
7. Wait 1–2 minutes. When it says **Success**, the site is live.
   Click the link shown (e.g. `https://my-portfolio.<subdomain>.workers.dev`).

> If you used a different project name, edit `"name"` in `wrangler.jsonc` on GitHub to the same value,
> otherwise the deploy fails with a "name mismatch" error.

---

## Step 5 — Set the admin login (email + password)

The admin panel stays locked until you add a login.

1. Go to **Workers & Pages** → click **my-portfolio**.
2. Open the **Settings** tab → **Variables and Secrets** → click **+ Add**.
3. Add the first one:
   - **Type:** `Secret`
   - **Variable name:** `ADMIN_EMAIL`
   - **Value:** the email you will sign in with
4. Click **+ Add** again and add the second one:
   - **Type:** `Secret`
   - **Variable name:** `ADMIN_PASSWORD`
   - **Value:** a strong password (at least 10 characters)
5. Click **Deploy** / **Save** (this publishes a new version with the secrets).

Now open `https://my-portfolio.<subdomain>.workers.dev/admin/` and sign in.

> Spelling matters: `ADMIN_EMAIL` and `ADMIN_PASSWORD`, all capitals.
> After the first sign-in, you can change the email/password inside the admin under **Security**.

---

## Step 6 — First edits in the admin

1. **Profile & About → Profile photo → Upload**, then click **Save changes** (top right).
2. **Connection Links** → add LinkedIn / GitHub if you have them → **Save changes**.
3. Check every page of the admin; anything can be edited, hidden (eye icon) or reordered.

Every **Save changes** is stored in Cloudflare KV and is live immediately
(it can take up to a minute to appear everywhere).

---

## Done — how updates work from now on

| You want to… | Do this |
| --- | --- |
| Change text, photos, skills, jobs… | Use the **admin panel** — no GitHub needed |
| Change the design or code | Edit files and **push to GitHub** → Cloudflare redeploys automatically (watch **Workers & Pages → my-portfolio → Deployments**) |

Code deploys **never** overwrite what you saved in the admin.

---

## Optional — use your own domain

If you own a domain (e.g. `yourname.com`) and it is added to the same Cloudflare account:
**Workers & Pages → my-portfolio → Settings → Domains & Routes → + Add → Custom domain**,
type the domain and confirm. HTTPS is set up automatically.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Deploy fails: **name mismatch / Worker name** | The project name in Cloudflare and `"name"` in `wrangler.jsonc` must be identical. |
| Deploy fails: **KV namespace … not found / invalid id** | Step 3: paste the exact KV ID into `wrangler.jsonc` and commit. |
| Admin says **"Admin login is not configured yet"** | Step 5: add both secrets `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then Deploy. |
| **"Incorrect email or password"** | Check spelling. If you changed the secrets *after* the first sign-in, the old login is kept — sign in with the original one, or delete the key `auth` in **Storage & Databases → KV → my-portfolio** to fall back to the secrets. |
| **"Too many attempts"** | Wait 10 minutes (protection against password guessing). |
| A change doesn't show | Wait ~1 minute and refresh. KV takes up to 60 seconds to update everywhere. |
| Site shows the old text after a code push | Content comes from the admin once you've saved there; edit it in the admin. |

---

## Free plan limits (more than enough for a portfolio)

- ~100,000 visits per day
- ~1,000 admin saves / uploads per day
- 1 GB of storage
