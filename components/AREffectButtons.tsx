import React from 'react';
import { EffectType } from '../types';

interface AREffectButtonsProps {
  isDeepARLoaded: boolean;
  activeEffect: EffectType;
}

const AREffectButtons: React.FC<AREffectButtonsProps> = ({
  isDeepARLoaded,
  activeEffect
}) => {
  if (!isDeepARLoaded) return null;

  return (
    <div className="fixed top-0 right-0 m-4 z-50 max-w-48">
      <div className="text-white text-xs bg-black bg-opacity-70 p-3 rounded-lg border border-gray-600">
        <div className="text-center">
          <div className="text-sm font-bold mb-1">🚪 감정 개찰구</div>
          <div className="text-xs opacity-80">
            {activeEffect === 'beauty' ? '📊 감정 분석 활성' : '⚪ 대기 중'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AREffectButtons; 