# Hosting the privacy policy at a public URL

Play Console requires a **live, publicly-accessible HTTPS URL** for the privacy
policy. You upload **`playstore/privacy.html`** (self-contained, no dependencies) so
that exact file serves as your policy page.

## Option A — GitHub Pages (free, no domain needed, recommended)

1. Create a **public** GitHub repo, e.g. `valam-legal` (Settings → … → make sure it's **Public**).
2. In the repo, upload `playstore/privacy.html` as **`index.html`** in the repo root.
3. Open repo **Settings → Pages**:
   - Source: *Deploy from a branch*
   - Branch: `main`, Folder: `/`
   - Save.
4. Within ~1 minute your policy is live at:
   `https://<your-github-username>.github.io/valam-legal/`
5. Paste that URL into the **Privacy Policy** field in Play Console.
6. Re-upload `index.html` whenever `privacy.html` changes.

> GitHub Pages serves at `https://` automatically — exactly what Play Console wants.

**Edge case:** GitHub also renders `PRIVACY_POLICY.md` nicely, but the HTML file is
the safer choice because it preserves our tables/styling identically.

## Option B — Netlify Drop (free, zero setup, ~30 seconds)

1. Go to https://app.netlify.com/drop
2. Drag a folder containing **only** `privacy.html` (renamed `index.html`) onto the page.
3. You get an `https://<random>.netlify.app/index.html` URL instantly.
4. Optionally map a custom domain later.

## Option C — your own domain (best long-term)

If you control `valam.in`, put the file at `https://valam.in/privacy.html` (any static
host behind it). A short memorable URL is nicer for farmers and looks more established
in review.

---

### Checklist before submitting the Play listing
- [ ] `privacy.html` reachable at a public `https://` URL from an incognito browser
- [ ] The URL matches exactly what you paste into Play Console (no `file://`, no localhost)
- [ ] The email in the policy (`privacy@valam.in`) is one you actually control
- [ ] You can answer "yes" that an account on your phone can be deleted by request

### Remember when the Flutter app changes
If the mobile team adds anything data-related (analytics SDK, ads, Firebase, app
crash reporting, contacts access, subscriptions), **the Data Safety form AND this
policy must be updated** — see `DATA_SAFETY_FORM.md` for the category mapping they'd
need to re-answer.