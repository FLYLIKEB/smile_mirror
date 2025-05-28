import React from 'react';
import { EffectType } from '../types';

interface AREffectButtonsProps {
  isDeepARLoaded: boolean;
  activeEffect: EffectType;
  onApplyEffect: (effectType: EffectType, beautyIntensity?: number) => void;
  onSetBackground?: () => void;
}

const AREffectButtons: React.FC<AREffectButtonsProps> = ({
  isDeepARLoaded,
  activeEffect,
  onApplyEffect,
  onSetBackground
}) => {
  if (!isDeepARLoaded) return null;

  return (
    <div className="fixed top-0 right-0 m-4 flex flex-col space-y-2 z-50 max-w-48">
      <div className="text-white text-xs bg-black bg-opacity-50 p-2 rounded">
        🚪 감정 개찰구 시스템
      </div>
      
      {/* 감정 개찰구 (기본) */}
      <button 
        onClick={() => onApplyEffect('beauty', 0.7)}
        className={`px-3 py-2 text-sm rounded-lg shadow-lg transition-colors ${
          activeEffect === 'beauty' 
            ? 'bg-blue-700 text-white' 
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        🚪 감정 스캔
      </button>

      {/* 배경 설정 */}
      {onSetBackground && (
        <button 
          onClick={() => {
            console.log('배경 설정 버튼 클릭됨');
            onSetBackground();
          }}
          className="px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-lg transition-colors"
        >
          🖼️ 배경 설정
        </button>
      )}

      {/* 효과 제거 */}
      <button 
        onClick={() => onApplyEffect(null)}
        className="px-3 py-2 text-sm bg-gray-600 hover:bg-gray-500 text-white rounded-lg shadow-lg transition-colors"
      >
        ❌ 효과 제거
      </button>
    </div>
  );
};

export default AREffectButtons; 