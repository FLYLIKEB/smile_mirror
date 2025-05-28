import React from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  // 감정 상태에 따른 개찰구 상태 결정 (웃음에 더 우호적)
  const getGateStatus = (emotionScore: number) => {
    if (emotionScore < -20) {
      return {
        status: '😔 진입 허가',
        color: 'text-gray-400',
        bgColor: 'bg-gray-800',
        message: '매우 부정적이지만 통과'
      };
    } else if (emotionScore >= -20 && emotionScore < 10) {
      return {
        status: '🚫 입장 거부',
        color: 'text-red-500',
        bgColor: 'bg-red-900',
        message: '감정이 불안정합니다'
      };
    } else if (emotionScore < 40) {
      return {
        status: '⚠️ 대기 중',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-900',
        message: '감정 상태 확인 중'
      };
    } else {
      return {
        status: '✅ 입장 허가',
        color: 'text-green-500',
        bgColor: 'bg-green-900',
        message: '환영합니다'
      };
    }
  };

  const gateInfo = getGateStatus(score);
  const formattedScore = `${score.toFixed(1)}%`;
  
  return (
    <div className={`fixed top-0 left-4 m-4 px-4 py-3 ${gateInfo.bgColor} bg-opacity-80 backdrop-blur rounded-lg shadow-lg z-50 border border-white border-opacity-20`}>
      <div className="flex flex-col items-center space-y-1">
        <div className={`text-lg font-bold ${gateInfo.color}`}>
          {gateInfo.status}
        </div>
        <div className="text-white text-sm opacity-90">
          감정 점수: {formattedScore}
        </div>
        <div className="text-white text-xs opacity-70 text-center">
          {gateInfo.message}
        </div>
      </div>
    </div>
  );
};

export default Score; 