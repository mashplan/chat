Subject: Unable to connect Serverless Container to Managed Redis Database via Private Network

Hello Scaleway Support,

I'm experiencing persistent connection issues between a Serverless Container and a Managed Redis Database, both hosted on Scaleway in the AMS1 region and connected via the same Private Network.

**Setup:**
- Serverless Container: Running a Next.js application
- Redis Database: redis-mp-chat-prod (Redis 7.0.5, RED1-micro)
- Both resources are attached to Private Network: mp-chat-private (172.16.12.0/22)
- Using private endpoint: 172.16.12.6:6379

**Issue:**
When attempting to connect from the container to Redis using the redis npm client, I receive TLS certificate validation errors ("self-signed certificate"), despite providing the CA certificate downloaded from the Redis instance page.

**What I've tried:**

1. **Basic TLS connection:**
   - URL: `rediss://[encoded_user]:[encoded_pass]@172.16.12.6:6379`
   - Downloaded the TLS certificate from the Redis instance page
   - Stored certificate content as a secret environment variable `REDIS_CA_PEM`
   - Container startup script writes this to `/tmp/redis-ca.pem`
   - Set `NODE_EXTRA_CA_CERTS=/tmp/redis-ca.pem` as container environment variable
   - Result: "self-signed certificate" error

2. **Direct CA injection in Redis client:**
   - Modified application to explicitly pass the CA certificate to the Redis client connection options
   - Result: Same "self-signed certificate" error

3. **Non-TLS attempt:**
   - Changed URL to use `redis://` instead of `rediss://`
   - Result: ECONNRESET errors, and Redis logs show "ssl3_get_record:http request / wrong version number"
   - This confirms Redis requires TLS even on private endpoints

4. **Diagnostic endpoint:**
   - Created a diagnostic endpoint that attempts basic Redis operations (PING, INCR, PUB/SUB)
   - Consistently returns: `{"ok":false,"error":"no-reconnect","lastError":"self-signed certificate","diagnostics":{"urlProtocol":"rediss:","hasCA":true}}`

**Redis logs show:**
```
Error accepting a client connection: error:1408F09C:SSL routines:ssl3_get_record:http request
Error accepting a client connection: error:1408F10B:SSL routines:ssl3_get_record:wrong version number
```

**UPDATE - Root cause identified:**

Using diagnostic endpoints, I discovered the exact issue:

The Redis server presents a self-signed certificate with CN=51.15.60.211 (a public IP), not matching the private IP 172.16.12.6. The certificate details:
- Subject: O=ScalewayRedis, CN=51.15.60.211
- Issuer: O=ScalewayRedis, CN=51.15.60.211 (self-signed)
- Valid: Aug 13 2025 - Aug 11 2035

Key findings:
- TCP connectivity works fine (port 6379 is reachable)
- TLS handshake succeeds when certificate validation is disabled
- Redis AUTH command works correctly with provided credentials
- The downloaded CA certificate does NOT validate this self-signed certificate

As a workaround, I'm forced to disable certificate validation entirely (`rejectUnauthorized: false`), which isn't ideal for production.

**Questions:**
1. Why does the Redis instance use a self-signed certificate that isn't validated by the downloadable CA?
2. Why does the certificate CN (51.15.60.211) not match the private endpoint IP (172.16.12.6)?
3. Is it possible to disable TLS for private network connections?
4. If TLS is mandatory, can you provide proper certificates that:
   - Match the private IP or provide an internal hostname
   - Are signed by the downloadable CA certificate
5. What is the officially recommended approach for connecting Serverless Containers to Managed Redis on Private Networks?

**Environment details:**
- Node.js application using the official `redis` npm package (v5.8.0)
- Container runs Node.js 18 Alpine
- Using resumable-stream package which depends on Redis for pub/sub functionality

**Resource IDs (as requested in your documentation):**
- Serverless Container ID: 3523aad0-14b0-4fa3-915e-fa384b2d5ffb
- Redis Database Instance ID: c2028ed6-faf5-4120-9c80-bf1d753d78e1

**Connectivity test results from container:**
```
# TCP connectivity test
172.16.12.6 (172.16.12.6:6379) open

# Container network interfaces
inet 172.16.12.12/22 brd 172.16.15.255 scope global pn0
inet 10.0.86.96/32 brd 10.0.86.96 scope global eth0

# Routes
default via 10.0.86.80 dev eth0
172.16.12.0/22 dev pn0 scope link  src 172.16.12.12

# TLS test results
- TCP connection: SUCCESS
- TLS without CA: SUCCESS (but unauthorized due to self-signed cert)
- TLS with downloaded CA: FAILED (self-signed certificate error)
- Redis AUTH: SUCCESS when bypassing certificate validation
```

Any guidance on the proper configuration for this common use case would be greatly appreciated. I expected that resources on the same Private Network would have a straightforward connection method.

Thank you for your assistance.
