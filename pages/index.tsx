import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import SmileFilter from '../components/SmileFilter';

const Home: NextPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Head>
        <title>스마일 미러</title>
        <meta name="description" content="웃음 감지 미러 앱" />
      </Head>
      
      <div className="relative w-full max-w-3xl aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border-4 border-gray-300 bg-black">
        {/* 거울 효과 */}
        <div className="absolute inset-0 bg-white opacity-5 mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent pointer-events-none"></div>
        
        {/* 거울 빛 반사 효과 */}
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white/20 to-transparent transform -skew-y-3 pointer-events-none"></div>
        
        {/* 거울 프레임 광택 */}
        <div className="absolute top-0 left-0 w-3 h-full bg-gradient-to-r from-white/40 to-transparent pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-3 h-full bg-gradient-to-l from-white/40 to-transparent pointer-events-none"></div>
        
        {/* 앱 제목 */}
        <h1 className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xl text-white/70 font-bold z-10 pointer-events-none">
          스마일 미러
        </h1>
        
        {/* 스마일 필터 */}
        <div className="w-full h-full overflow-hidden">
          <SmileFilter className="w-full h-full" />
        </div>
      </div>
    </div>
  );
};

export default Home; 