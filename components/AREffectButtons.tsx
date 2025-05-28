import React from 'react';
import { EffectType } from '../types';

interface AREffectButtonsProps {
  isDeepARLoaded: boolean;
  activeEffect: EffectType;
  onApplyEffect: (effectType: EffectType, blurIntensity?: number) => void;
}

const AREffectButtons: React.FC<AREffectButtonsProps> = ({
  isDeepARLoaded,
  activeEffect,
  onApplyEffect
}) => {
  if (!isDeepARLoaded) return null;

  return (
    <div className="fixed top-0 right-0 m-4 flex flex-col space-y-2 z-50">
      <div className="text-white text-xs bg-black bg-opacity-50 p-2 rounded">
        웃음 점수 10% 이상 시 자동 블러
      </div>
      <button 
        onClick={() => onApplyEffect('blur', 5)}
        className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
          activeEffect === 'blur' 
            ? 'bg-blue-700 text-white' 
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        배경 블러 (수동)
      </button>
      <button 
        onClick={() => onApplyEffect(null)}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg shadow-lg transition-colors"
      >
        효과 제거
      </button>
    </div>
  );
};

export default AREffectButtons; 