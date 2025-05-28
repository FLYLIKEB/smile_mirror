import React, { useState, useEffect } from 'react';

interface EmotionGateOverlayProps {
  gateStatus: 'analyzing' | 'approved' | 'denied' | 'locked';
  lockTimer: number;
}

const EmotionGateOverlay: React.FC<EmotionGateOverlayProps> = ({ 
  gateStatus, 
  lockTimer 
}) => {
  const [noiseIntensity, setNoiseIntensity] = useState(0);

  // 부정적 감정 시 노이즈 강도 조절
  useEffect(() => {
    if (gateStatus === 'denied') {
      setNoiseIntensity(0.3);
    } else if (gateStatus === 'locked') {
      setNoiseIntensity(0.6);
    } else {
      setNoiseIntensity(0);
    }
  }, [gateStatus]);

  // CSS 필터 계산
  const getDistortionFilter = () => {
    if (gateStatus === 'denied') {
      return `
        contrast(140%) 
        saturate(180%) 
        hue-rotate(15deg) 
        sepia(20%)
        brightness(80%)
      `;
    } else if (gateStatus === 'locked') {
      return `
        contrast(200%) 
        saturate(250%) 
        hue-rotate(30deg) 
        sepia(40%)
        brightness(60%)
        blur(2px)
        invert(5%)
      `;
    }
    return 'none';
  };

  // 노이즈 애니메이션을 위한 SVG 필터
  const NoiseFilter = () => (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="noise" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence 
            baseFrequency={noiseIntensity}
            numOctaves="4"
            result="noise"
          />
          <feDisplacementMap 
            in="SourceGraphic"
            in2="noise"
            scale={noiseIntensity * 20}
          />
        </filter>
        <filter id="glitch" x="0%" y="0%" width="100%" height="100%">
          <feOffset in="SourceGraphic" dx="2" dy="0" result="layer1" />
          <feOffset in="SourceGraphic" dx="-2" dy="0" result="layer2" />
          <feOffset in="SourceGraphic" dx="0" dy="1" result="layer3" />
          <feBlend in="layer1" in2="layer2" mode="multiply" result="blend1" />
          <feBlend in="blend1" in2="layer3" mode="screen" />
        </filter>
      </defs>
    </svg>
  );

  return (
    <>
      <NoiseFilter />
      
      {/* 메인 왜곡 오버레이 */}
      <div 
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          filter: getDistortionFilter(),
          background: gateStatus === 'locked' 
            ? 'radial-gradient(circle, rgba(255,0,0,0.1) 0%, rgba(139,0,0,0.3) 100%)'
            : gateStatus === 'denied'
            ? 'linear-gradient(45deg, rgba(255,0,0,0.05) 0%, rgba(255,100,100,0.15) 100%)'
            : 'transparent'
        }}
      />

      {/* 글리치 효과 (locked 상태에서만) */}
      {gateStatus === 'locked' && (
        <div 
          className="absolute inset-0 z-25 pointer-events-none animate-pulse glitch-animation"
          style={{
            filter: 'url(#glitch)',
            background: `
              repeating-linear-gradient(
                90deg,
                transparent,
                transparent 98px,
                rgba(255,0,0,0.1) 100px
              )
            `
          }}
        />
      )}

      {/* 스캔라인 효과 */}
      {(gateStatus === 'denied' || gateStatus === 'locked') && (
        <div 
          className={`absolute inset-0 z-30 pointer-events-none ${
            gateStatus === 'locked' ? 'scanlines-animation' : ''
          }`}
          style={{
            background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(255,0,0,0.05) 3px,
                rgba(255,0,0,0.05) 4px
              )
            `
          }}
        />
      )}

      {/* 노이즈 오버레이 */}
      {noiseIntensity > 0 && (
        <div 
          className={`absolute inset-0 z-35 pointer-events-none ${
            gateStatus === 'locked' ? 'interference-animation' : ''
          }`}
          style={{
            filter: 'url(#noise)',
            opacity: noiseIntensity,
            background: 'rgba(255, 0, 0, 0.1)',
            mixBlendMode: 'overlay'
          }}
        />
      )}

      {/* 경고 텍스트 오버레이 */}
      {gateStatus === 'locked' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-red-600 bg-opacity-90 text-white px-8 py-4 rounded-lg text-center flicker-animation border-2 border-red-400">
            <div className="text-3xl mb-2">🔴 최종 경고 🔴</div>
            <div className="text-lg font-bold">감정 위험 임계치 초과</div>
            <div className="text-sm">완전 차단 모드 활성화</div>
            <div className="text-xs mt-1 animate-pulse">CRITICAL LOCKDOWN - ACCESS DENIED</div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmotionGateOverlay; 