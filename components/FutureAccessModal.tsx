import React, { useEffect, useState } from 'react';

interface FutureAccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  emotionScore: number;
  citizenId: string;
}

const FutureAccessModal: React.FC<FutureAccessModalProps> = ({
  isVisible,
  onClose,
  emotionScore,
  citizenId
}) => {
  const [animationStep, setAnimationStep] = useState<'entering' | 'processing' | 'approved' | 'exiting'>('entering');
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    if (isVisible) {
      setAnimationStep('entering');
      
      // 스캔 애니메이션
      setTimeout(() => {
        setAnimationStep('processing');
        
        // 스캔 진행률 애니메이션
        const interval = setInterval(() => {
          setScanProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setAnimationStep('approved');
              
              // 10초 후 자동 닫기
              setTimeout(() => {
                setAnimationStep('exiting');
                setTimeout(onClose, 500);
              }, 10000);
              
              return 100;
            }
            return prev + 4;
          });
        }, 30);
      }, 500);
    } else {
      setScanProgress(0);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const currentTime = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
      animationStep === 'entering' || animationStep === 'exiting' 
        ? 'opacity-0 scale-95' 
        : 'opacity-100 scale-100'
    }`}>
      {/* 홀로그램 배경 */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-purple-900/30 to-blue-900/30 backdrop-blur-lg" />
      
      {/* 네온 그리드 오버레이 */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(cyan 1px, transparent 1px),
            linear-gradient(90deg, cyan 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* 메인 팝업 */}
      <div className={`relative bg-gradient-to-br from-gray-900/95 via-blue-900/95 to-purple-900/95 
        border-2 border-cyan-400/50 rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto
        shadow-2xl backdrop-blur-sm transition-transform duration-300 
        scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-cyan-500 ${
          animationStep === 'approved' ? 'scale-105' : 'scale-100'
        }`}>
        
        {/* 홀로그램 글로우 효과 */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 animate-pulse" />
        
        {/* 헤더 */}
        <div className="relative z-10 text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 
              flex items-center justify-center shadow-lg shadow-cyan-500/50">
              {animationStep === 'approved' ? (
                <svg className="w-8 h-8 text-white animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>
          
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            {animationStep === 'entering' && '생체 인증 시스템'}
            {animationStep === 'processing' && '감정 스캔 진행 중...'}
            {animationStep === 'approved' && '✨ 출입 허가 승인 ✨'}
          </h2>
        </div>

        {/* 스캔 진행 영역 */}
        <div className="relative z-10 mb-6">
          {animationStep === 'processing' && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-cyan-500/30">
                <div className="flex justify-between text-sm text-cyan-300 mb-2">
                  <span>스캔 진행률</span>
                  <span>{scanProgress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-100 shadow-lg shadow-cyan-500/50"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {animationStep === 'approved' && (
            <div className="space-y-4">
              <div className="bg-green-900/30 border border-green-400/50 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-green-400 text-lg font-bold mb-2">승인 완료</div>
                  <div className="text-green-300 text-sm">
                    감정 안정도: <span className="font-mono">{emotionScore.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="relative z-10 bg-gray-800/30 rounded-lg p-4 mb-6 border border-gray-600/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">시민 ID</div>
              <div className="text-cyan-300 font-mono">{citizenId}</div>
            </div>
            <div>
              <div className="text-gray-400">인증 시간</div>
              <div className="text-cyan-300 font-mono text-xs">{currentTime}</div>
            </div>
            <div>
              <div className="text-gray-400">보안 레벨</div>
              <div className="text-green-400 font-bold">HIGH</div>
            </div>
            <div>
              <div className="text-gray-400">접근 권한</div>
              <div className="text-green-400 font-bold">GRANTED</div>
            </div>
          </div>
        </div>

        {/* 법적 조항 및 유의사항 */}
        <div className="relative z-10 text-xs text-gray-400 leading-relaxed border-t border-gray-600/30 pt-4">
          <div className="text-center mb-3">
            <span className="text-cyan-400 font-mono">[ 개인정보 처리 및 이용약관 ]</span>
          </div>
          <div className="space-y-2 text-justify">
            <p className="text-gray-300">
              본 생체인증시스템은 「개인정보 보호법」 제15조 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 제22조에 의거하여 
              귀하의 얼굴 생체정보와 감정상태 데이터를 수집·처리합니다.
            </p>
            <p>
              수집된 생체정보는 시설 출입통제 및 보안관리 목적으로만 사용되며, 처리 완료 후 즉시 삭제됩니다. 
              감정분석 알고리즘은 실시간 처리되어 별도 저장되지 않습니다.
            </p>
            <p className="text-orange-300">
              <span className="font-semibold">⚠️ 유의사항:</span> 
              본 시스템은 연구용 프로토타입으로, 실제 보안시설에서의 사용은 금지됩니다. 
              생체정보는 암호화되어 전송되나, 네트워크 환경에 따라 지연이 발생할 수 있습니다.
            </p>
          </div>
          <div className="text-center mt-3 text-cyan-400 font-mono text-xs">
            AI Mirror System v2.1.0 | 데이터 보호 준수 인증 완료
          </div>
        </div>

        {/* 홀로그램 파티클 효과 */}
        <div className="absolute top-4 right-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping"
              style={{
                left: `${i * 8}px`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FutureAccessModal; 