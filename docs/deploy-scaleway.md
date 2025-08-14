### Deploy to Scaleway Serverless Containers

This project supports deployment to Scaleway Serverless Containers via manual Docker pushes or GitHub Actions.

#### Prerequisites

1. Scaleway account and project
2. Postgres database (Scaleway or other)
3. Container Registry namespace

#### Secrets and environment variables

Set these in your container settings:

```env
# Required
POSTGRES_URL=postgresql://user:password@host:5432/database
AUTH_SECRET=your-auth-secret
NEXT_PUBLIC_APP_URL=https://<container>.functions.fnc.<region>.scw.cloud

# Optional providers
XAI_API_KEY=...
OPENAI_API_KEY=...
BERGET_AI_API_KEY=...

# Object Storage (optional)
SCALEWAY_OS_ACCESS_KEY_ID=...
SCALEWAY_OS_SECRET_ACCESS_KEY=...
SCALEWAY_OS_BUCKET_NAME=...
SCALEWAY_OS_REGION=nl-ams
SCALEWAY_OS_ENDPOINT=https://s3.nl-ams.scw.cloud

# Redis resumable streams (optional but recommended)
REDIS_URL=rediss://<ENC_USER>:<ENC_PASS>@<host>:6379
REDIS_CA_PEM=<paste full PEM as secret>
```

Notes:
- Normal env vars are limited to 1000 chars. Use the Secrets section for long values like `REDIS_CA_PEM`.
- The image runs `./start.sh`, which auto-loads the Redis CA from `NODE_EXTRA_CA_CERTS`, `REDIS_CA_PEM`, or `/app/certs/redis-ca.pem`.

#### Build and deploy (manual)

```bash
docker build --platform linux/amd64 -t your-app .
docker login rg.nl-ams.scw.cloud -u nologin -p $SCW_SECRET_KEY
docker tag your-app rg.nl-ams.scw.cloud/<namespace>/your-app:latest
docker push rg.nl-ams.scw.cloud/<namespace>/your-app:latest
```

Create a Serverless Container pointing to the pushed image and configure env/secrets. Use port `8080`, protocol HTTP/1.1, and health check path `/api/health`.

#### Deploy via GitHub Actions

If you use the included workflow, add repository secrets:

```
SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_ORGANIZATION_ID, SCW_PROJECT_ID, SCW_REGISTRY_NAMESPACE
```

Push to `main` to trigger build and update the container.

#### Post-deploy

Run database migrations as needed, e.g. with Scaleway CLI:

```bash
scw container container exec <container-id> -- pnpm db:migrate
```

#### Troubleshooting

- 502: ensure HTTP/1.1 and correct port.
- DB errors: verify `POSTGRES_URL` and network access.
- Redis TLS errors: ensure `REDIS_URL` uses `rediss://` and provide the CA via `REDIS_CA_PEM` secret.


