import React from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  // 점수에 따라 색상 결정 (양수는 초록색, 음수는 빨간색)
  const color = score >= 0 ? 'text-green-600' : 'text-red-600';
  
  // 소수점 둘째 자리까지 표시
  const formattedScore = score.toFixed(2);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">감정 점수</h2>
      <p className={`text-4xl font-bold ${color}`}>{formattedScore}</p>
      <p className="mt-2 text-gray-600">
        {score >= 0 ? '긍정적인 감정 상태입니다!' : '부정적인 감정 상태입니다!'}
      </p>
    </div>
  );
};

export default Score; 