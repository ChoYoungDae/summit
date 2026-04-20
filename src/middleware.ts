import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /subway 경로로 시작하는 요청만 처리
  if (pathname.startsWith('/subway')) {
    // 1. 파일 확장자가 없는 경우 (예: /subway, /subway/search 등)
    // 2. 또는 .html로 끝나는 경우
    // 이 경우들에만 index.html로 Rewrite하여 SPA 라우팅을 지원합니다.
    if (!pathname.includes('.') || pathname.endsWith('.html')) {
      const url = request.nextUrl.clone();
      url.pathname = '/subway/index.html';
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

// 성능을 위해 /subway 경로에 대해서만 미들웨어가 작동하도록 설정합니다.
export const config = {
  matcher: ['/subway/:path*'],
};
