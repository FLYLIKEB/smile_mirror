import React, { useState, useEffect } from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  // 가짜 생체 데이터 상태
  const [heartRate, setHeartRate] = useState(72);
  const [skinTemp, setSkinTemp] = useState(36.5);
  const [eyeTension, setEyeTension] = useState(45);

  // 생체 데이터 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      // 감정 점수에 따른 생체 데이터 변화
      const emotionFactor = score / 100;
      
      // 심박수: 감정 불안정 시 증가
      const baseHeartRate = score < 0 ? 85 + Math.random() * 15 : 65 + Math.random() * 10;
      setHeartRate(Math.round(baseHeartRate));
      
      // 피부 온도: 긴장 시 약간 증가
      const baseTemp = score < 0 ? 36.8 + Math.random() * 0.4 : 36.3 + Math.random() * 0.3;
      setSkinTemp(Math.round(baseTemp * 10) / 10);
      
      // 눈가 긴장도: 억지 웃음 시 높아짐
      const baseTension = score > 50 ? 30 + Math.random() * 20 : 40 + Math.random() * 30;
      setEyeTension(Math.round(baseTension));
    }, 500);

    return () => clearInterval(interval);
  }, [score]);

  // 감정 상태에 따른 시스템 메시지
  const getSystemStatus = (emotionScore: number) => {
    if (emotionScore < -10) {
      return {
        status: '🚫 출입 거부',
        color: 'text-red-400',
        bgColor: 'bg-red-900',
        message: '감정 조정 필요'
      };
    } else if (emotionScore >= -10 && emotionScore < 12) {
      return {
        status: '⚠️ 검증 중',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-900',
        message: '적절한 감정 표현 요구됨'
      };
    } else if (emotionScore < 40) {
      return {
        status: '🔍 분석 중',
        color: 'text-blue-400',
        bgColor: 'bg-blue-900',
        message: '생체 신호 평가 중'
      };
    } else {
      return {
        status: '✅ 출입 승인',
        color: 'text-green-400',
        bgColor: 'bg-green-900',
        message: '적합한 감정 상태 확인됨'
      };
    }
  };

  const systemInfo = getSystemStatus(score);
  const formattedScore = `${score.toFixed(1)}%`;
  
  return (
    <div className={`fixed top-0 left-4 m-4 px-4 py-3 ${systemInfo.bgColor} bg-opacity-90 backdrop-blur rounded-lg shadow-lg z-50 border border-cyan-500 border-opacity-30`}>
      <div className="flex flex-col space-y-2">
        {/* 시스템 상태 */}
        <div className="text-center border-b border-gray-600 pb-2">
          <div className={`text-sm font-bold ${systemInfo.color} font-mono`}>
            {systemInfo.status}
          </div>
          <div className="text-gray-300 text-xs mt-1">
            {systemInfo.message}
          </div>
        </div>
        
        {/* 생체 데이터 */}
        <div className="space-y-1 text-xs font-mono">
          <div className="text-cyan-300 font-semibold">생체 스캔 데이터</div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">감정지수:</span>
            <span className={`${score >= 12 ? 'text-green-400' : score >= -10 ? 'text-yellow-400' : 'text-red-400'}`}>
              {formattedScore}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">심박수:</span>
            <span className={`${heartRate > 85 ? 'text-red-400' : 'text-cyan-400'}`}>
              {heartRate} BPM
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">피부온도:</span>
            <span className={`${skinTemp > 36.7 ? 'text-orange-400' : 'text-cyan-400'}`}>
              {skinTemp}°C
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-400">눈가긴장:</span>
            <span className={`${eyeTension > 60 ? 'text-red-400' : 'text-cyan-400'}`}>
              {eyeTension}%
            </span>
          </div>
        </div>
        
        {/* 시스템 정보 */}
        <div className="text-xs text-gray-500 text-center pt-1 border-t border-gray-600">
          HappyGate v2.1 | 공공안전시스템
        </div>
      </div>
    </div>
  );
};

export default Score; 