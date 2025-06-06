import React from 'react';

interface SpeechStatusIndicatorProps {
  isSpeechEnabled: boolean;
  isSpeechPlaying: boolean;
}

export default function SpeechStatusIndicator({
  isSpeechEnabled,
  isSpeechPlaying
}: SpeechStatusIndicatorProps) {
  return (
    <div className="absolute top-4 right-4 z-50">
      <div className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all duration-300 ${
        !isSpeechEnabled 
          ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-xl'
          : isSpeechPlaying
          ? 'bg-orange-500 text-white border-orange-400 animate-pulse shadow-lg'
          : 'bg-green-500 text-white border-green-400 shadow-lg'
      }`}>
        {!isSpeechEnabled ? (
          <div className="flex flex-col items-center space-y-1">
            <div className="flex items-center space-x-2">
              <span>🔇</span>
              <span>음성 비활성</span>
            </div>
            <div className="text-xs opacity-90">화면 터치 필요</div>
          </div>
        ) : isSpeechPlaying ? (
          <div className="flex items-center space-x-2">
            <span>🎵</span>
            <span>음성 재생 중</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>🔊</span>
            <span>음성 대기</span>
          </div>
        )}
      </div>
    </div>
  );
} 