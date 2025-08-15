import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return NextResponse.json({ error: 'REDIS_URL not set' }, { status: 500 });
  }

  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = url.port || '6379';

    const results: Record<string, any> = {
      connection: {
        host,
        port,
        protocol: url.protocol,
      },
      diagnostics: {},
    };

    // Run ping test
    try {
      const { stdout: pingOut } = await execAsync(`ping -c 3 ${host}`, {
        timeout: 10000,
      });
      results.diagnostics.ping = pingOut
        .split('\n')
        .filter((line) => line.trim());
    } catch (e: any) {
      results.diagnostics.ping = `Failed: ${e.message}`;
    }

    // Test TCP connectivity with timeout
    try {
      const { stdout, stderr } = await execAsync(
        `timeout 5 nc -zv ${host} ${port} 2>&1`,
        { timeout: 6000 },
      );
      results.diagnostics.tcpConnect =
        (stdout + stderr).trim() || 'Connection test completed';
    } catch (e: any) {
      results.diagnostics.tcpConnect = `Failed: ${e.message}`;
    }

    // Get network interfaces
    try {
      const { stdout: ifOut } = await execAsync('ip a', { timeout: 5000 });
      results.diagnostics.interfaces = ifOut
        .split('\n')
        .filter((line) => line.includes('inet') || line.match(/^\d+:/))
        .slice(0, 10);
    } catch (e: any) {
      results.diagnostics.interfaces = `Failed: ${e.message}`;
    }

    // Get routes
    try {
      const { stdout: routeOut } = await execAsync('ip route', {
        timeout: 5000,
      });
      results.diagnostics.routes = routeOut
        .split('\n')
        .filter((line) => line.trim());
    } catch (e: any) {
      results.diagnostics.routes = `Failed: ${e.message}`;
    }

    // Check TLS certificate status
    if (url.protocol === 'rediss:') {
      try {
        const { stdout, stderr } = await execAsync(
          `timeout 5 openssl s_client -connect ${host}:${port} -servername ${host} 2>&1 | head -50`,
          { timeout: 6000 },
        );
        const output = stdout + stderr;
        results.diagnostics.tlsCertificate = {
          connected: output.includes('CONNECTED'),
          verifyReturn: output.match(/Verify return code: (\d+)/)?.[1],
          subject: output.match(/subject=(.+)/)?.[1],
          issuer: output.match(/issuer=(.+)/)?.[1],
        };
      } catch (e: any) {
        results.diagnostics.tlsCertificate = `Failed: ${e.message}`;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
