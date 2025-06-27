import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Add any critical checks here
    // For example, database connectivity check:
    // await testDatabaseConnection()

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 },
    );
  }
}
