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

**Questions:**
1. Your documentation mentions that TLS certificates can be outdated even for private network connections. How do we ensure we have the latest certificate? Is there a way to automatically refresh it?
2. Is there a known issue with the TLS certificate's CN/SAN not matching the private IP address (172.16.12.6)? Should we use a different hostname?
3. What is the recommended approach for connecting Serverless Containers to Managed Redis instances on the same Private Network?
4. Are there any specific TLS settings or connection parameters we should use?
5. Is it possible to disable TLS for private network connections to avoid certificate validation issues?

**Environment details:**
- Node.js application using the official `redis` npm package (v5.8.0)
- Container runs Node.js 18 Alpine
- Using resumable-stream package which depends on Redis for pub/sub functionality

Any guidance on the proper configuration for this common use case would be greatly appreciated. I expected that resources on the same Private Network would have a straightforward connection method.

Thank you for your assistance.
