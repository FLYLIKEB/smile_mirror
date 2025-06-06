import React from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  // 감정 상태에 따른 미러 상태 결정 (웃음에 더 우호적)
  const getMirrorStatus = (emotionScore: number) => {
    if (emotionScore < -20) {
      return {
        status: '😔 괜찮아요',
        color: 'text-gray-400',
        bgColor: 'bg-gray-800',
        message: '천천히 미소지어 보세요'
      };
    } else if (emotionScore >= -20 && emotionScore < 10) {
      return {
        status: '🔄 조정 중',
        color: 'text-red-500',
        bgColor: 'bg-red-900',
        message: '더 밝게 웃어보세요'
      };
    } else if (emotionScore < 40) {
      return {
        status: '⚠️ 분석 중',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-900',
        message: '표정 상태 확인 중'
      };
    } else {
      return {
        status: '✨ 완벽해요',
        color: 'text-green-500',
        bgColor: 'bg-green-900',
        message: '아름다운 미소입니다'
      };
    }
  };

  const mirrorInfo = getMirrorStatus(score);
  const formattedScore = `${score.toFixed(1)}%`;
  
  return (
    <div className={`fixed top-0 left-4 m-4 px-4 py-3 ${mirrorInfo.bgColor} bg-opacity-80 backdrop-blur rounded-lg shadow-lg z-50 border border-white border-opacity-20`}>
      <div className="flex flex-col items-center space-y-1">
        <div className={`text-lg font-bold ${mirrorInfo.color}`}>
          {mirrorInfo.status}
        </div>
        <div className="text-white text-sm opacity-90">
          감정 점수: {formattedScore}
        </div>
        <div className="text-white text-xs opacity-70 text-center">
          {mirrorInfo.message}
        </div>
      </div>
    </div>
  );
};

export default Score; 