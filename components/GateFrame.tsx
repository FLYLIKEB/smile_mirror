import React from 'react';
import { EmotionGateStatus } from '../constants/emotionGate';

interface GateFrameProps {
  gateStatus: EmotionGateStatus;
  lockTimer: number;
}

export default function GateFrame({ gateStatus, lockTimer }: GateFrameProps) {
  // 게이트 상태에 따른 스타일 결정
  const getGateStyles = () => {
    switch (gateStatus) {
      case 'denied':
        return {
          overlay: 'bg-red-500 bg-opacity-30',
          border: 'border-red-500 border-4',
          filter: 'contrast(120%) saturate(150%) hue-rotate(10deg)'
        };
      case 'locked':
        return {
          overlay: 'bg-red-700 bg-opacity-70',
          border: 'border-red-700 border-8 animate-pulse',
          filter: 'contrast(200%) saturate(300%) hue-rotate(30deg) blur(2px) brightness(80%)'
        };
      case 'approved':
        return {
          overlay: 'bg-green-500 bg-opacity-20',
          border: 'border-green-500 border-2',
          filter: 'contrast(110%) saturate(120%) brightness(110%)'
        };
      default:
        return {
          overlay: 'bg-blue-500 bg-opacity-10',
          border: 'border-blue-300 border-2',
          filter: 'none'
        };
    }
  };

  const gateStyles = getGateStyles();

  return (
    <>
      {/* 개찰구 프레임 */}
      <div className={`absolute inset-0 z-10 ${gateStyles.border} pointer-events-none`}>
        {/* 상단 헤더 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-b-lg border-2 border-gray-700 shadow-lg">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-1 font-mono">🏛️ HAPPY GATE</h1>
            <div className={`text-sm font-medium font-mono ${
              gateStatus === 'analyzing' ? 'text-blue-300' :
              gateStatus === 'approved' ? 'text-green-300' :
              gateStatus === 'denied' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              {gateStatus === 'analyzing' && '🔍 생체 스캔 진행 중'}
              {gateStatus === 'approved' && '✅ 출입 허가됨'}
              {gateStatus === 'denied' && '⚠️ 감정 조정 요구됨'}
              {gateStatus === 'locked' && `🚫 출입 제한 (${lockTimer}초)`}
            </div>
          </div>
        </div>

        {/* 좌우 기둥 */}
        <div className="absolute left-0 top-1/4 w-8 h-1/2 bg-gray-800 border-r-2 border-gray-600"></div>
        <div className="absolute right-0 top-1/4 w-8 h-1/2 bg-gray-800 border-l-2 border-gray-600"></div>

        {/* 하단 바 */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2/3 h-4 bg-gray-800 border-2 border-gray-600 rounded-t-lg">
          <div className={`h-full rounded-t-lg transition-colors duration-300 ${
            gateStatus === 'approved' ? 'bg-green-500' :
            gateStatus === 'denied' ? 'bg-yellow-500' :
            gateStatus === 'locked' ? 'bg-red-500' :
            'bg-blue-500'
          }`}>
            {/* LED 표시등 */}
            <div className="flex justify-center items-center h-full space-x-1">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    gateStatus === 'approved' ? 'bg-green-200' :
                    gateStatus === 'denied' ? 'bg-yellow-200' :
                    gateStatus === 'locked' ? 'bg-red-200 animate-pulse' :
                    'bg-blue-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 상태 오버레이 */}
      <div className={`absolute inset-0 z-5 ${gateStyles.overlay} pointer-events-none transition-all duration-500`} />
    </>
  );
} 