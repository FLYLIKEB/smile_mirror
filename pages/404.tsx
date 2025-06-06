import { useEffect } from 'react';

export default function Custom404() {
  useEffect(() => {
    // 404 에러를 조용히 처리하고 메인 페이지로 리다이렉트
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      
      // .identity나 current-url 요청은 무시
      if (pathname === '/.identity' || pathname === '/current-url') {
        // 로그도 남기지 않고 조용히 무시
        return;
      }
      
      // 다른 404 에러는 메인 페이지로 리다이렉트
      window.location.href = '/';
    }
  }, []);

  return null; // 아무것도 렌더링하지 않음
} 