/**
 * POST /api/subscribe — Email lead capture for the "10% off" magnet.
 *
 * Stores each submission in a Cloudflare KV namespace bound to this Pages
 * project as `SUBSCRIBERS` (configure the binding in the Cloudflare dashboard:
 * Pages project → Settings → Functions → KV namespace bindings).
 *
 * Request body (JSON): { name: string, email: string }
 * Responses:
 *   200 { ok: true }            - stored (or already on the list)
 *   400 { ok: false, error }    - bad/missing input
 *   405                         - wrong method
 *   500 { ok: false, error }    - KV binding missing or write failed
 *
 * The frontend (script.js) degrades gracefully on any non-200, so a temporary
 * 500 (e.g. before the KV binding is added) never loses the visitor's goodwill.
 */

// Server-side email shape check (the client does a friendlier first pass).
function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // The KV binding must be named exactly SUBSCRIBERS in the Pages settings.
  if (!env || !env.SUBSCRIBERS) {
    return json(
      { ok: false, error: "Storage is not configured yet." },
      500
    );
  }

  // Parse and validate input.
  let data;
  try {
    data = await request.json();
  } catch (err) {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const name = (data && typeof data.name === "string" ? data.name : "").trim();
  const email = (data && typeof data.email === "string" ? data.email : "")
    .trim()
    .toLowerCase();

  if (!name) {
    return json({ ok: false, error: "Name is required." }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ ok: false, error: "A valid email is required." }, 400);
  }

  // Key by email so re-submits are idempotent (one record per address).
  const key = "lead:" + email;

  try {
    // Preserve the original signup time if this email already exists.
    const existingRaw = await env.SUBSCRIBERS.get(key);
    const nowIso = new Date().toISOString();
    let createdAt = nowIso;
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing && existing.createdAt) createdAt = existing.createdAt;
      } catch (e) {
        /* corrupt record — overwrite cleanly below */
      }
    }

    const record = {
      name: name,
      email: email,
      createdAt: createdAt,
      updatedAt: nowIso,
      source: "landing_page_10pct",
      // Light, non-PII context useful for later segmentation/dedupe.
      country: request.headers.get("cf-ipcountry") || null,
      referer: request.headers.get("referer") || null,
      userAgent: request.headers.get("user-agent") || null,
    };

    await env.SUBSCRIBERS.put(key, JSON.stringify(record));
    return json({ ok: true }, 200);
  } catch (err) {
    return json({ ok: false, error: "Could not store your details." }, 500);
  }
}

// Anything other than POST gets a clean 405.
export async function onRequest(context) {
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }
  return new Response("Method Not Allowed", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
