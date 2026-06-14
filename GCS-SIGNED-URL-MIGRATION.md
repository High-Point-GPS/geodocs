# GeoDocs — faster file loading from GCS (signed URLs) — migration runbook

This covers the **backend + GCP** side of serving document files directly from Google Cloud
Storage instead of streaming their bytes through the `readDocFile` Cloud Function. The
**frontend half is already shipped** and is **dual-mode**: it sends `responseMode:'url'` and
handles *both* a `{ url }` JSON response (new backend) and raw bytes (legacy backend), so
nothing breaks before you deploy — the speedup just turns on once the backend is updated.

Run everything in **Google Cloud Shell** (local `gcloud`/`firebase` deploy is blocked here).

---

## STOP — wire real auth before deploying the backend

The handler below ships with `validateSession()` as a **fail-closed stub that throws**. You
**must** replace it with the *real* Geotab session check the current `readDocFile` already uses,
and it must **confirm the user belongs to `database`** — not just echo the client's `database`
back. Otherwise a caller could submit `database:"victimco"` with their own valid session and get
a signed URL into another tenant's files. This sits on top of the known auth/tenant-isolation
gaps in these endpoints — do not regress it.

---

## Placeholders — set once per Cloud Shell session

```bash
export PROJECT_ID="<PROJECT_ID>"        # the endpoint host us-central1-geotabfiles... implies geotabfiles
export REGION="us-central1"
export BUCKET="<BUCKET>"                 # bucket name only, no gs://
export RUNTIME_SA="<RUNTIME_SA_EMAIL>"   # the function's RUNTIME service account (find it below)
gcloud config set project "$PROJECT_ID"
```

Find the runtime SA + generation (they decide the commands):

```bash
gcloud functions describe readDocFile --region="$REGION" --gen2 --format="value(serviceConfig.serviceAccountEmail)"
gcloud functions describe readDocFile --region="$REGION" --format="value(environment)"
```

If the SA is empty, the function uses the App Engine default: `${PROJECT_ID}@appspot.gserviceaccount.com`.

---

## Backend handler (`readDocFile`) — drop into your functions repo

Backward-compatible: returns `{ url }` **only** when the caller sends `responseMode:'url'`
(the new bundle does); otherwise it streams bytes exactly like today. The URL path signs with
**`attachment` disposition always** — harmless for inline `<img>`/pdf.js preview (they fetch as
subresources and ignore `Content-Disposition`) but the only thing that makes the cross-origin
Download button save with the right filename.

```js
const { Storage } = require('@google-cloud/storage');
const storage = new Storage(); // keyless: signs via IAM signBlob using ADC

const BUCKET = '<BUCKET>';
const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 min (well under V4's 7-day max)
const ALLOWED_ORIGINS = new Set([
  'https://nimble-frangipane-75305c.netlify.app',
  'https://my.geotab.com',
  'https://high-point-gps.github.io',
]);

function applyCors(req, res) {
  res.set('Vary', 'Origin'); // always, so shared caches do not serve the wrong ACAO
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.set('Access-Control-Max-Age', '3600');
}

// Failure shape the frontend expects: valid===false => session failure (client re-auths).
function fail(res, status, error, isAuthFailure) {
  const body = { error };
  if (isAuthFailure) body.valid = false;
  return res.status(status).json(body);
}

// Strip control chars (code < 32), double-quote (34) and backslash (92) from the header value.
function sanitizeFilename(name) {
  return Array.from(String(name || 'document'))
    .map((c) => {
      const code = c.charCodeAt(0);
      return code < 32 || code === 34 || code === 92 ? '_' : c;
    })
    .join('');
}

// Per-tenant prefix. CONFIRM this matches how uploads write objects today (case matters --
// GCS object names are case-sensitive; the project rule lowercases the Geotab DB name).
function tenantPrefix(database) {
  return String(database).toLowerCase() + '/';
}

function safeObjectName(database, filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) return null;
  let p;
  try { p = decodeURIComponent(filePath); } catch (e) { return null; }
  // Treat backslash (92) as a separator, then strip leading slashes -- no regex escapes.
  p = Array.from(p).map((c) => (c.charCodeAt(0) === 92 ? '/' : c)).join('');
  while (p.startsWith('/')) p = p.slice(1);
  // Reject control chars anywhere in the name.
  if (Array.from(p).some((c) => c.charCodeAt(0) < 32)) return null;
  // Reject traversal / empty / current-dir SEGMENTS (no blanket includes('..')).
  const segs = p.split('/');
  if (segs.some((s) => s === '' || s === '.' || s === '..')) return null;
  const prefix = tenantPrefix(database);
  const objectName = p.startsWith(prefix) ? p : prefix + p;
  if (!objectName.startsWith(prefix) || objectName.length <= prefix.length) return null;
  return objectName;
}

// !!! REPLACE with the real Geotab check. Must confirm the user belongs to `database`
//     and return the SERVER-CONFIRMED tenant. Throws if unwired => fails closed.
async function validateSession(session) {
  if (!session || !session.database || !session.sessionId || !session.userName || !session.server) {
    return { ok: false };
  }
  // const confirmedDb = await geotabValidate(session); // throws/false if bad
  // if (!confirmedDb) return { ok: false };
  // return { ok: true, database: confirmedDb };
  throw new Error('validateSession not implemented -- refusing to issue URLs');
}

async function streamLegacy(res, fileRef, fileName) {
  const [exists] = await fileRef.exists();
  if (!exists) return fail(res, 404, 'This file no longer exists.');
  const [meta] = await fileRef.getMetadata();
  res.set('Content-Type', meta.contentType || 'application/octet-stream');
  res.set('Content-Disposition', 'inline; filename="' + sanitizeFilename(fileName) + '"');
  return new Promise((resolve, reject) => {
    fileRef.createReadStream().on('error', reject).on('end', resolve).pipe(res);
  });
}

exports.readDocFile = async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { return fail(res, 400, 'Malformed request body.'); } }
  body = body || {};
  const { session, filePath, fileName } = body;

  let auth;
  try { auth = await validateSession(session); } catch (e) { auth = { ok: false }; }
  if (!auth || !auth.ok) return fail(res, 401, 'Your session is no longer valid. Please sign in again.', true);

  const objectName = safeObjectName(auth.database, filePath);
  if (!objectName) return fail(res, 400, 'Invalid file path.');

  const fileRef = storage.bucket(BUCKET).file(objectName);
  const wantUrl = body.responseMode === 'url' || req.query.mode === 'url';

  try {
    if (!wantUrl) return await streamLegacy(res, fileRef, fileName); // legacy bundle path

    const [exists] = await fileRef.exists();
    if (!exists) return fail(res, 404, 'This file no longer exists.');

    const safeName = sanitizeFilename(fileName || objectName.split('/').pop());
    const [url] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
      // attachment always: ignored by <img>/pdf.js (subresource fetch), but the only thing
      // that makes the cross-origin Download button save with the right name.
      responseDisposition: 'attachment; filename="' + safeName + '"',
    });
    return res.status(200).json({ url });
  } catch (err) {
    console.error('readDocFile error:', err && err.message ? err.message : err); // never log the URL
    if (!res.headersSent) return fail(res, 500, 'Unable to load this file.');
    return undefined;
  }
};
```

> Once the new bundle is everywhere, you can delete the `streamLegacy` branch and the `wantUrl` check.

---

## Cloud Shell runbook

### 1 — Warm instance (kills cold-start latency)

```bash
gcloud run services update readDocFile --region="$REGION" --min-instances=1
```

(Gen2 — tweaks the underlying Cloud Run service without redeploying code. Gen1: redeploy with
`gcloud functions deploy readDocFile --region="$REGION" --min-instances=1`.) The flag name is
`--min-instances` for **both** generations; the real per-gen difference is the `--gen2` flag
itself — always pass the one matching your function. Adds ~1 always-on small instance of idle
cost (about $3-10/mo); size memory small since it no longer buffers file bytes.

### 2 — Cache-Control on objects

```bash
gsutil -m setmeta -h "Cache-Control:private, max-age=3600" "gs://$BUCKET/**"
```

Use `private` (tenant data). Keep `max-age` at or below the signed-URL TTL. **Never** upload
PDFs/images with `gsutil cp -Z` — gzip-transcoding breaks HTTP Range (which pdf.js needs). Also
set this header at upload time in the uploader write path.

### 3 — Signing permission (the #1 gotcha)

```bash
gcloud services enable iamcredentials.googleapis.com
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --member="serviceAccount:$RUNTIME_SA" --role="roles/iam.serviceAccountTokenCreator"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$RUNTIME_SA" --role="roles/storage.objectViewer"
```

The Token Creator binding is the SA granting itself `signBlob` (member and resource are the same
identity — intentional). Without it you get a cryptic `signBlob` / `Cannot sign data without
client_email` error. IAM can take a minute to propagate.

### 4 — Bucket CORS (browser now fetches GCS directly; pdf.js needs Range)

```bash
cat > cors.json <<'EOF'
[
  {
    "origin": ["https://nimble-frangipane-75305c.netlify.app","https://my.geotab.com","https://high-point-gps.github.io"],
    "method": ["GET","HEAD"],
    "responseHeader": ["Content-Type","Content-Disposition","Content-Range","Accept-Ranges","Cache-Control","ETag","Last-Modified"],
    "maxAgeSeconds": 3600
  }
]
EOF
gcloud storage buckets update "gs://$BUCKET" --cors-file=cors.json
```

Origins must be exact (scheme+host, no trailing slash). Do not add `"OPTIONS"` (GCS answers
preflight automatically) or `"*"`. Exposing `Content-Range`/`Accept-Ranges` is what lets pdf.js
range-stream pages instead of downloading the whole PDF.

### 5 — Region + CDN

- **Region (do this):** keep `$BUCKET` in/near `us-central1` to co-locate with the function.
  A bucket's location can't be changed after creation — check it:
  `gcloud storage buckets describe "gs://$BUCKET" --format="value(location)"`.
- **CDN (careful):** **V4 signed URLs defeat Cloud CDN caching** — each has a unique signature in
  the query string, so every request is a fresh cache key (~100% misses); and stripping the query
  from the cache key would serve private docs to anyone. So the default here is **no CDN for
  documents** (steps 1-4 + region already capture most of the win). If you truly need edge caching
  of private files, switch wholesale to **Cloud CDN signed URLs/cookies** (a different signing
  scheme via an external HTTPS LB + backend bucket) — don't mix it with GCS V4 URLs.
  `--signed-url-cache-max-age` is a cache-TTL knob, **not** access control.

### Verify

```bash
SIGNED="<paste url from a responseMode:url call>"
curl -s -I "$SIGNED"
curl -s -H "Range: bytes=0-99" -o /dev/null -w "%{http_code}" "$SIGNED"
```

Expect a `200` with `Accept-Ranges: bytes` on the first, and `206` on the second.

---

## Deploy order (with the dual-mode frontend, order is forgiving)

The frontend is already dual-mode, so you can deploy the backend before or after the bundle —
nothing breaks either way; the speedup activates once the backend returns `{ url }`. Recommended
sequence: **3 → 4 → backend deploy → 1 → 2 → 5**, then preview a PDF and confirm the network
request goes to `storage.googleapis.com` with a `206` range response.
