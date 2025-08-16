### Redis setup (local + Scaleway)

This app uses Redis only for resumable streaming via `resumable-stream` (AI SDK). Chats and messages are stored in Postgres. If Redis is not configured, streams still work but resumption is disabled and you will see this log:

```
> Resumable streams are disabled due to missing REDIS_URL
```

To enable resumable streams, configure a TLS Redis URL and the CA certificate.

---

### 1) Get values from Scaleway

From your Scaleway Redis instance page, collect:

- host and port
- username
- password
- TLS CA certificate file (`.pem`)

Scaleway requires TLS, so the URL scheme must be `rediss://` (not `redis://`).

---

### 2) Build a proper Redis URL

Format:

```
rediss://<ENCODED_USERNAME>:<ENCODED_PASSWORD>@<HOST>:<PORT>
```

If your username or password contains special characters, percent‑encode them. Quick helper:

```bash
node -p 'encodeURIComponent(process.argv[1])' 'YOUR_RAW_USERNAME'
node -p 'encodeURIComponent(process.argv[1])' 'YOUR_RAW_PASSWORD'
```

Common encodings: `! → %21`, `# → %23`, `? → %3F`, `$ → %24`, `@ → %40`, `: → %3A`, `/ → %2F`, `& → %26`, `+ → %2B`, `= → %3D`.

---

### 3) Local development

1. Save the downloaded Scaleway PEM somewhere outside the repo (e.g. `~/secrets/scaleway-redis-ca.pem`). Do not commit it.
2. Add to `.env.local`:

```
REDIS_URL=rediss://<ENCODED_USER>:<ENCODED_PASS>@<HOST>:<PORT>
NODE_EXTRA_CA_CERTS=/absolute/path/to/scaleway-redis-ca.pem
```

3. Test the connection:

```bash
node -e 'import("redis").then(async({createClient})=>{const c=createClient({url:process.env.REDIS_URL});c.on("error",e=>console.error("ERR",e.message));await c.connect();console.log("Connected",await c.ping());await c.quit();}).catch(e=>console.error(e.message))'
```

Restart `pnpm dev` after changing env vars.

---

### 4) Production on Scaleway (Serverless Containers)

Set the following in your container config:

- Environment variable `REDIS_URL` with the encoded `rediss://...` URL.
- Secret `REDIS_CA_PEM` containing the full PEM text (secrets allow large values; normal env vars are limited to 1000 chars).

This repository’s `start.sh` handles the CA automatically at startup in this order:

1. If `NODE_EXTRA_CA_CERTS` is set, use that file.
2. Else if `REDIS_CA_PEM` is set, write it to `/tmp/redis-ca.pem` and set `NODE_EXTRA_CA_CERTS` accordingly.
3. Else if `/app/certs/redis-ca.pem` exists (mounted or baked into the image), use it.

No application code changes are required; just redeploy after updating env/secrets.

To verify, check container logs for:

```
Writing REDIS_CA_PEM to /tmp/redis-ca.pem
```

---

### 5) Known Issues with Scaleway Redis

**Important:** As of December 2024, Scaleway's Managed Redis has certificate issues on private networks that prevent resumable streams from working properly:

- Scaleway uses self-signed certificates with CN that doesn't match private IPs
- The downloaded CA certificate doesn't validate their self-signed certificates
- Even with certificate validation disabled, the `resumable-stream` library causes UI updates to fail

**Current Recommendation:** Do not use Redis with this application on Scaleway until they fix their certificate infrastructure. The app works perfectly without Redis - you only lose the ability to resume interrupted streams, which is a minor feature.

### 6) General Troubleshooting

- Invalid URL: percent‑encode username/password; ensure `rediss://`.
- `self-signed certificate`: provide the PEM via one of the methods above.
- Connection refused or timeouts: confirm allowed IPs/networking and instance status.
- TLS handshake errors: wrong scheme (`redis://` instead of `rediss://`) or missing CA.
- Feature not active: missing `REDIS_URL` → resumable streams disabled by design.

---

### 7) Security notes

- Do not commit the PEM file. Use secrets or a runtime mount.
- Treat `REDIS_URL` like a secret; avoid logging it.


