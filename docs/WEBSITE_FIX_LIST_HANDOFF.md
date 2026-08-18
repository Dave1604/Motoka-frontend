# Motoka Website Fix List — Working Handoff

**Last updated:** 2026-08-18
**Source:** `Motokaapp_Website_Fix_List.docx` (compiled Aug 2026) + verification against the codebase
**Purpose:** let a fresh session pick this up without re-deriving anything.

---

## 0. Read this first — the one recommendation that changes the plan

The source document names **"migrate to SSR (Next.js/Nuxt/Remix)"** as *"the highest-leverage fix on this entire list."*

**Do not start there.** The evidence points elsewhere.

The site wasn't being indexed because **`robots.txt` and `sitemap.xml` did not exist**. `vercel.json` rewrote every path to `index.html`, so both returned `200 OK` with the app shell as their body:

```
curl https://www.motokaapp.ng/robots.txt
→ <!doctype html><html lang="en">…
```

An auditor sees `200` and ticks the box. Google fetches robots.txt, receives HTML, discards it — then has no sitemap either. That is a complete crawl failure, and it is fixed in **PR #274** (below) without touching the rendering model.

Google has rendered JavaScript for years. A client-rendered SPA is a *disadvantage*, not a blocker. Migrating this app to Next.js is a multi-week rewrite of every route, the auth flow, the payment callbacks and the service worker.

**Correct sequence:**
1. Merge PR #274 → deploy → submit the sitemap in Google Search Console
2. **Wait 2–4 weeks** and watch actual indexation
3. Only if pages still fail to index, reach for prerendering (Prerender.io, or `vite-plugin-ssg` for the landing page alone) — both far cheaper than a framework migration
4. Treat full SSR as a last resort with evidence behind it

Rewriting the app on a hypothesis, when the measured cause was two missing static files, would be the most expensive possible response to this list.

---

## 1. What I'd actually do first — and it isn't SEO

Two items in the source list are **legal/privacy exposure**, cheap to fix, and buried under "Critical 1.4" and "High 2.2". They should lead.

### 1.4 — Real government documents used as decoration
The landing page uses what appear to be **real Nigerian government documents** (driver's licence, vehicle licence, ownership certificate) with plate numbers and personal details partially visible, purely as decorative imagery.

- Asset found: `src/assets/images/license-sample.png` (927 KB)
- ⚠️ **Unverified:** whether the details are genuinely real/legible. **Needs a human or a browser pass.** The filename says "sample", the audit says otherwise.
- If real: this is someone's actual licence number on a public marketing site — a privacy problem regardless of SEO, and acutely bad for a brand selling document-fraud protection.
- **Fix:** replace with clearly fictional documents (watermarked SAMPLE, fictional names/plates) or illustrations.

### 2.2 — Government crests implying endorsement
VIS, Nigeria Police and a third crest appear under "Compliance & Security" with no caption, which reads as an official partnership.

- Located in `src/Landing/components/Categories.jsx` and `src/Landing/components/Whyus.jsx`
- **Fix:** caption the actual relationship ("We help you stay compliant with VIS and FRSC requirements") or remove the logos if no formal partnership exists.

Both are hours of work, not weeks, and carry more downside than a slow-ranking blog.

---

## 2. Current state

### Already shipped / in flight

| Item | Status |
|---|---|
| `robots.txt`, `sitemap.xml`, `vercel.json` rewrite fix | **PR #274** → `staging` (open) |
| Canonical URL, title, meta description, OG/Twitter tags | in PR #274 |
| Referral system DB migration (`/referral` was 500ing) | **applied to live DB**; renumber in backend **PR #36** |
| Renewals admin screen, PWA, gateway health panel | merged to frontend `staging` |
| Admin auth consolidation, duplicate-charge guard, digest emails | merged to backend `main` + `staging` |

Frontend `staging → master` is **PR #272** (open, mergeable) — that is what carries everything above to production.

### Environment

- Backend dev: `npm run dev` in `motoka-backend` → **:3000**
- Frontend dev: `npm run dev -- --port 5173` → **:5173** (must be 5173; it's the only origin in the backend's `ALLOWED_ORIGINS`)
- Supabase project: `ucvnkouowpghnffvxrnb` (CLI is linked)
- Production frontend → `https://motoka-backend.onrender.com/api` (set in `vercel.json`)

---

## 3. Verified against the code

I checked the source document's specific claims rather than trusting them.

**Confirmed present:**

| Claim | Location |
|---|---|
| "Shedule Now" | `src/Landing/components/Categories.jsx` |
| "Guranteed" | `src/Landing/components/Whyus.jsx` |
| "What Client says" | `src/Landing/components/Testimonials.jsx` |
| "Signup Now" | `src/Landing/components/Cta.jsx` |
| "how do i create account" | `src/Landing/components/FAQs.jsx` |
| App-store contradiction | "Coming soon" in `Mobile.jsx` vs "download the Motoka app" in `FAQs.jsx` |

**Corrections to the source document:**

- **"We've Got Your Back::"** — the code has a *single* colon (`Whyus.jsx`). Either it renders doubled from a template, or the audit misread it. Check visually before "fixing".
- **"Fix the carousel at the shared component level"** — *there is no shared carousel component.* The cutoff appears independently in `Categories.jsx` and `Blogs.jsx`, each with its own overflow markup. Budget for two fixes, or genuinely extract a shared component first.
- **Services / FAQs / Testimonials "not indexed"** — these are **anchor sections on the landing page, not routes**. There is no URL to index. They were deliberately left out of `sitemap.xml`; listing them would submit 404s to Google. Making them real routes (§4) is the actual fix.

---

## 4. Recommended order of work

Sequenced by (risk × cheapness), not by the source document's severity labels.

### Now — hours, high downside if ignored
1. **Replace the government-document imagery** (§1.4) — needs a visual check first
2. **Caption or remove the agency crests** (§2.2)
3. **Resolve the app-store contradiction** — decide whether the app exists, then align `Mobile.jsx` and `FAQs.jsx`
4. **Typo pass** — 5 confirmed strings above; trivial, and they're on the most-viewed page

### Next — days, unblocks measurement
5. **Merge PR #274, deploy, submit sitemap to Search Console** — nothing about indexation can be judged until this is live
6. **Set up the 301 redirects in the Vercel dashboard.** `motoka.ng`, `www.motoka.ng`, `motokaapp.ng`, `www.motokaapp.ng` all serve **byte-identical HTML** (verified by md5). The canonical tag in PR #274 helps; only redirects fix it. **This cannot be done from code.**
   - ⚠️ **Open decision:** canonical is currently set to `www.motokaapp.ng` (the verified Resend email domain, and what the audit measured). But the backend references `app.motoka.ng` **9 times**. This is a brand decision. If it flips, it's a one-line change in `index.html`, `robots.txt`, `sitemap.xml`.
7. **Give key sections real URLs** (`/services`, `/faqs`) — the cheap two-thirds of the "indexation" problem, no SSR required
8. **Per-route titles/descriptions with `react-helmet`** — already a dependency (`^6.1.0`) and already imported. Wiring, not new infrastructure. This is item 4 of the earlier SEO plan and is **not yet built.**

### Then — measurable, lower urgency
9. Single primary CTA (demote Register/Login to secondary)
10. Carousel cutoff — **two** places, not one
11. FAQ expansion + publish the five drafted articles
12. Testimonial authenticity
13. Label the `₦234,098` figure in the app mockup
14. Footer partner logos, stock imagery, "Drive Assured" repetition

### Only with evidence
15. **Prerendering / SSR** — revisit *after* step 5 has had 2–4 weeks in Search Console. See §0.

---

## 5. Not yet done: the link audit

The source document flags this as outstanding (browser access was unavailable when it was written). **Still outstanding.**

Every nav item, CTA, footer link and blog "Read more" needs click-testing for dead destinations and broken anchors. Options:
- Claude in Chrome extension (was disconnected during recent sessions — needs reconnecting)
- A crawler (Screaming Frog / Ahrefs) against the live site — better at redirect chains and orphaned pages than manual clicking

---

## 6. Traps — read before touching infrastructure

- **Never run `supabase db push --include-all` on this project.** Nine duplicate-numbered migrations remain (064–073); their twins already applied, so they're redundant, but three are catalog cleanup/reseed scripts carrying **15 `DELETE`/`TRUNCATE`/`DROP` statements** between them. That flag replays them against the live 1,187-row Ladipo catalog. Migrations must be renumbered and reviewed individually first.
- **A service worker is live** (PWA, in `staging`). Once deployed it is sticky — removing it later needs a kill-switch worker, not just reverting code.
- **`index.css` has an unlayered `img { width: 100% }`.** Tailwind v4 utilities live in `@layer utilities`, and unlayered CSS beats layered regardless of specificity — so `w-10` on an `<img>` silently loses. Use inline styles, or move that rule into `@layer base`. This has already caused one layout bug.
- **41 MB of images** ship in the build (a 14 MB PNG, a 10 MB JPG, two 5 MB GIFs) and the JS is a single 2.8 MB chunk. Compressing these would likely do more for real-world performance than anything on the fix list.
- **WhatsApp reminders send nothing** — both Twilio senders are `OFFLINE`. Fixed in the Twilio/Meta console, not in code.
- **Delivery reporting is blind on both channels.** Code logs success when Twilio/Resend *accept* a request, not when it's delivered. No Twilio status callback, no Resend webhook. This is why a five-month WhatsApp outage went unnoticed.
