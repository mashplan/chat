import { NextResponse } from 'next/server';
import { createClient } from 'redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.REDIS_URL;

  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'Missing REDIS_URL' },
      { status: 500 },
    );
  }

  const diagnostics: Record<string, unknown> = {
    urlProtocol: (() => {
      try {
        return new URL(url).protocol;
      } catch {
        return 'invalid-url';
      }
    })(),
    hasCA: Boolean(process.env.NODE_EXTRA_CA_CERTS),
  };

  const client = createClient({
    url,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: () => new Error('no-reconnect'),
    },
  });
  let lastError: string | null = null;
  client.on('error', (e) => {
    lastError = e instanceof Error ? e.message : String(e);
  });

  try {
    await client.connect();
    diagnostics.ping = await client.ping();

    // Basic INCR test
    const key = `diag:incr:${Date.now()}`;
    diagnostics.incr = await client.incr(key);

    // Basic pub/sub roundtrip
    const channel = `diag:ch:${crypto.randomUUID()}`;
    const sub = client.duplicate();
    const pub = client.duplicate();
    await Promise.all([sub.connect(), pub.connect()]);

    const pubsubResult = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      sub.subscribe(channel, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      pub.publish(channel, 'hello');
    });

    diagnostics.pubsub = pubsubResult;

    await Promise.all([
      sub.unsubscribe(channel).catch(() => {}),
      sub.quit().catch(() => {}),
      pub.quit().catch(() => {}),
    ]);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        lastError,
        diagnostics,
      },
      { status: 500 },
    );
  } finally {
    try {
      await client.quit();
    } catch {}
  }

  return NextResponse.json({ ok: true, diagnostics });
}
