import React from 'react';

interface ScoreProps {
  score: number;
}

const Score: React.FC<ScoreProps> = ({ score }) => {
  const color = score >= 0 ? 'text-green-500' : 'text-red-500';
  const formattedScore = `${score.toFixed(2)}%`;
  
  return (
    <div className="fixed top-0 left-40 m-4 px-4 py-2 bg-gray-800 bg-opacity-80 backdrop-blur rounded-lg shadow-lg z-50">
      <span className={`text-2xl font-bold ${color}`}>
        {formattedScore}
      </span>
    </div>
  );
};

export default Score; 