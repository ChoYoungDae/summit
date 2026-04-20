import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/subway')) {
    if (!pathname.includes('.') || pathname.endsWith('.html')) {
      const url = request.nextUrl.clone();
      url.pathname = '/subway/index.html';
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/subway/:path*'],
};