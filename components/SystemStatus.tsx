import React from 'react';

interface SystemStatusProps {
  emotionScore: number | null;
  isModelLoaded: boolean;
  isCameraReady: boolean;
  citizenId: string;
}

export default function SystemStatus({
  emotionScore,
  isModelLoaded,
  isCameraReady,
  citizenId
}: SystemStatusProps) {
  return (
    <div className="fixed bottom-4 left-4 z-40 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
      <div>감정 점수: {emotionScore?.toFixed(1) || '스캔중'}</div>
      <div>시스템: {isModelLoaded && isCameraReady ? '온라인' : '오프라인'}</div>
      <div className="text-xs text-blue-300">유저ID: {citizenId}</div>
    </div>
  );
} 