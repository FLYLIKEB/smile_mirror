import React from 'react';
import type { NextPage } from 'next';
import Head from 'next/head';
import SmileFilter from '../components/SmileFilter';

const Home: NextPage = () => {
  return (
    <div className="min-h-screen text-white">
      <main className="p-0 flex flex-col h-screen">
        <div className="flex-grow w-full overflow-hidden">
          <SmileFilter className="w-full h-full" />
        </div>
      </main>
    </div>
  );
};

export default Home; 