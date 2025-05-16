import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  const [displayScore, setDisplayScore] = useState<number>(0);
  const requestRef = useRef<number | undefined>(undefined);
  
  // 부드러운 점수 전환을 위한 애니메이션
  useEffect(() => {
    const animate = () => {
      setDisplayScore(prevScore => {
        // 부드럽게 현재 점수로 접근
        const diff = score - prevScore;
        const newScore = prevScore + diff * 0.1;
        
        // 차이가 아주 작으면 목표값으로 설정
        if (Math.abs(diff) < 0.1) {
          return score;
        }
        
        return newScore;
      });
      
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [score]);
  
  // 색상 계산 (빨간색 -> 노란색 -> 초록색)
  const getColor = (value: number) => {
    // 음수는 빨간색에서 노란색으로
    if (value < 0) {
      const normalizedValue = Math.min(1, Math.abs(value) / 100);
      return `rgb(255, ${Math.round(255 * (1 - normalizedValue))}, 0)`;
    }
    // 양수는 노란색에서 초록색으로
    else {
      const normalizedValue = Math.min(1, value / 100);
      return `rgb(${Math.round(255 * (1 - normalizedValue))}, 255, 0)`;
    }
  };
  
  const color = getColor(displayScore);
  const formattedScore = `${displayScore.toFixed(2)}%`;
  
  // 배경 투명도는 점수에 따라 변화 (긍정적일수록 더 투명하게)
  const bgOpacity = Math.max(0.4, 0.8 - Math.abs(displayScore) / 250);
  
  return (
    <div 
      className="fixed top-0 left-[160px] m-4 px-4 py-2 rounded-lg shadow-lg z-50 backdrop-blur-sm transition-all duration-300"
      style={{ 
        backgroundColor: `rgba(25, 25, 25, ${bgOpacity})`,
        transform: `scale(${1 + Math.abs(displayScore) / 400})`,
      }}
    >
      <span 
        className="text-2xl font-bold transition-colors duration-300"
        style={{ color }}
      >
        {formattedScore}
      </span>
    </div>
  );
};

export default dynamic(() => Promise.resolve(Score), {
  ssr: false
}); 