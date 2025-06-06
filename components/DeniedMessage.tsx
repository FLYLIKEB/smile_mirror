import React from 'react';

interface DeniedMessageProps {
  message: string;
}

export default function DeniedMessage({ message }: DeniedMessageProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-20 pointer-events-none">
      <div className="bg-red-600 text-white px-8 py-4 rounded-lg text-center max-w-md animate-bounce shadow-2xl border-2 border-red-400 pointer-events-auto">
        <div className="flex items-center justify-center space-x-2">
          <span className="text-2xl">🚨</span>
          <p className="text-lg font-semibold">{message}</p>
        </div>
        <div className="text-xs mt-2 opacity-90 font-mono">
          시스템 지시에 따라 적절한 감정을 표현해주세요
        </div>
      </div>
    </div>
  );
} 