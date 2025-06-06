/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // 404 에러 필터링 및 성능 최적화
  async rewrites() {
    return [
      // .identity 요청을 무시하도록 처리
      {
        source: '/.identity',
        destination: '/404',
      },
      // current-url 요청을 무시하도록 처리  
      {
        source: '/current-url',
        destination: '/404',
      }
    ]
  },
  
  // 개발 환경에서 로그 레벨 조정
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development'
    }
  },
  
  // 정적 파일 캐싱 최적화
  headers: async () => {
    return [
      {
        source: '/public/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false
    };
    return config;
  },
}

module.exports = nextConfig 