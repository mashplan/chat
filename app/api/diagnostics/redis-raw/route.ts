import { NextResponse } from 'next/server';
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.REDIS_URL;
  if (!url) {
    return NextResponse.json({ error: 'No REDIS_URL' }, { status: 500 });
  }

  const parsed = new URL(url);
  const host = parsed.hostname;
  const port = Number.parseInt(parsed.port || '6379');
  const password = decodeURIComponent(parsed.password || '');
  const username = decodeURIComponent(parsed.username || '');

  const results: any = {
    url: { host, port, protocol: parsed.protocol },
    tests: {},
  };

  // Test 1: Raw TCP connection
  results.tests.tcp = await new Promise((resolve) => {
    const client = net.createConnection({ host, port }, () => {
      client.end();
      resolve({ success: true });
    });
    client.on('error', (err) =>
      resolve({ success: false, error: err.message }),
    );
    client.setTimeout(5000, () => {
      client.destroy();
      resolve({ success: false, error: 'timeout' });
    });
  });

  // Test 2: TLS without CA
  if (parsed.protocol === 'rediss:') {
    results.tests.tlsNoCa = await new Promise((resolve) => {
      const client = tls.connect(
        { host, port, rejectUnauthorized: false },
        () => {
          const authorized = client.authorized;
          const authError = client.authorizationError;
          const cert = client.getPeerCertificate();
          client.end();
          resolve({
            success: true,
            authorized,
            authError,
            cert: cert
              ? {
                  subject: cert.subject,
                  issuer: cert.issuer,
                  valid_from: cert.valid_from,
                  valid_to: cert.valid_to,
                }
              : null,
          });
        },
      );
      client.on('error', (err) =>
        resolve({ success: false, error: err.message }),
      );
      client.setTimeout(5000, () => {
        client.destroy();
        resolve({ success: false, error: 'timeout' });
      });
    });

    // Test 3: TLS with CA from env/file
    let ca: string | undefined;
    const caFromEnv = process.env.REDIS_CA_PEM;
    const caFromFile = process.env.NODE_EXTRA_CA_CERTS;

    if (caFromEnv?.trim()) {
      ca = caFromEnv;
      results.caSource = 'env';
    } else if (caFromFile) {
      try {
        ca = fs.readFileSync(caFromFile, 'utf8');
        results.caSource = 'file';
        results.caFile = caFromFile;
      } catch (e: any) {
        results.caError = e.message;
      }
    }

    if (ca) {
      results.caLength = ca.length;
      results.caPreview = `${ca.substring(0, 50)}...`;

      results.tests.tlsWithCa = await new Promise((resolve) => {
        const client = tls.connect(
          {
            host,
            port,
            ca,
            checkServerIdentity: () => undefined, // Skip hostname check
          },
          () => {
            const authorized = client.authorized;
            const authError = client.authorizationError;
            client.end();
            resolve({ success: true, authorized, authError });
          },
        );
        client.on('error', (err) =>
          resolve({ success: false, error: err.message }),
        );
        client.setTimeout(5000, () => {
          client.destroy();
          resolve({ success: false, error: 'timeout' });
        });
      });
    }

    // Test 4: AUTH command after TLS connection
    if (results.tests.tlsNoCa?.success || results.tests.tlsWithCa?.success) {
      results.tests.auth = await new Promise((resolve) => {
        const client = tls.connect(
          {
            host,
            port,
            rejectUnauthorized: false,
          },
          () => {
            // Send AUTH command
            const authCmd = username
              ? `AUTH ${username} ${password}\r\n`
              : `AUTH ${password}\r\n`;

            client.write(authCmd);

            let response = '';
            client.on('data', (data) => {
              response += data.toString();
              if (response.includes('\r\n')) {
                client.end();
                resolve({
                  success: response.startsWith('+OK'),
                  response: response.trim(),
                });
              }
            });
          },
        );

        client.on('error', (err) =>
          resolve({ success: false, error: err.message }),
        );
        client.setTimeout(5000, () => {
          client.destroy();
          resolve({ success: false, error: 'timeout' });
        });
      });
    }
  }

  return NextResponse.json(results);
}
