import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { guestRegex, isDevelopmentEnvironment } from './lib/constants';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith('/ping')) {
    return new Response('pong', { status: 200 });
  }

  // Allow health check endpoint for Scaleway health checks
  if (pathname.startsWith('/api/health')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  if (!token) {
    const redirectUrl = encodeURIComponent(request.url);
    // Use the actual request host for redirects
    const protocol = request.nextUrl.protocol;
    const host = request.headers.get('host') || request.nextUrl.host;
    const baseUrl = `${protocol}//${host}`;

    return NextResponse.redirect(
      new URL(`/api/auth/guest?redirectUrl=${redirectUrl}`, baseUrl),
    );
  }

  const isGuest = guestRegex.test(token?.email ?? '');

  if (token && !isGuest && ['/login', '/register'].includes(pathname)) {
    const protocol = request.nextUrl.protocol;
    const host = request.headers.get('host') || request.nextUrl.host;
    const baseUrl = `${protocol}//${host}`;
    return NextResponse.redirect(new URL('/', baseUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/chat/:id',
    '/api/:path*',
    '/login',
    '/register',

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
