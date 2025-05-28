import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Head from 'next/head';
import Score from '../components/Score';
import AREffectButtons from '../components/AREffectButtons';
import LoadingMessages from '../components/LoadingMessages';
import EmotionGateOverlay from '../components/EmotionGateOverlay';
import { useDeepAR } from '../hooks/useDeepAR';
import { useFaceAPI } from '../hooks/useFaceAPI';
import { useVideo } from '../hooks/useVideo';
import { useDimensions } from '../hooks/useDimensions';
import '../types';

// DeepAR을 직접 임포트하지 않고 런타임에 로드
declare global {
  interface Window {
    deepar: any;
  }
}

// 타입 정의
interface CanvasDimensions {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  aspectRatio: number;
}

interface VideoConstraints {
  video: {
    facingMode: string;
    width: { ideal: number };
    height: { ideal: number };
  };
}

// 감정 상태 타입
type EmotionGateStatus = 'analyzing' | 'approved' | 'denied' | 'locked';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const deepARCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceAPICanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 감정 개찰구 상태 관리
  const [gateStatus, setGateStatus] = useState<EmotionGateStatus>('analyzing');
  const [deniedMessage, setDeniedMessage] = useState<string>('');
  const [lockTimer, setLockTimer] = useState<number>(0);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 화면 크기 관리
  const { dimensions, updateDimensions } = useDimensions(containerRef);

  // FaceAPI 관리
  const {
    emotionScore,
    isModelLoaded,
    isCameraReady,
    loadModels,
    startDetectionInterval,
    stopDetectionInterval,
    setCameraReady
  } = useFaceAPI(faceAPICanvasRef, videoRef, dimensions);

  // DeepAR 관리
  const {
    isDeepARLoaded,
    activeEffect,
    initDeepAR,
    applyEffect,
    updateCanvasSize: updateDeepARCanvasSize,
    cleanup: cleanupDeepAR,
    setDeepARBackground
  } = useDeepAR(deepARCanvasRef, videoRef, dimensions);

  // 비디오 관리
  const { startVideo, cleanupVideo } = useVideo(
    videoRef,
    dimensions,
    setCameraReady,
    () => {
      if (!isDeepARLoaded) {
        initDeepAR();
      }
    }
  );

  // 메모이제이션된 값들
  const videoOpacity = useMemo(() => isDeepARLoaded ? 0 : 1, [isDeepARLoaded]);

  // iOS에서 사용자 터치 시 음성 활성화
  const enableSpeechOnTouch = useCallback(() => {
    if (!isSpeechEnabled && 'speechSynthesis' in window) {
      // 디바이스 정보 로깅
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
      
      console.log('📱 디바이스 정보:', {
        isIOS,
        isChrome,
        isSafari,
        userAgent: navigator.userAgent,
        speechSynthesis: !!window.speechSynthesis,
        voices: window.speechSynthesis?.getVoices?.()?.length || 0
      });
      
      // 더미 음성으로 권한 요청
      const testUtterance = new SpeechSynthesisUtterance('');
      testUtterance.volume = 0;
      
      testUtterance.onstart = () => {
        console.log('✅ 음성 권한 획득 성공');
      };
      
      testUtterance.onerror = (event) => {
        console.error('❌ 음성 권한 획득 실패:', event.error);
      };
      
      window.speechSynthesis.speak(testUtterance);
      setIsSpeechEnabled(true);
      console.log('🔊 음성 권한 활성화 시도됨');
    }
  }, [isSpeechEnabled]);

  // 음성 메시지 재생 함수
  const playDeniedMessage = useCallback((message: string) => {
    setDeniedMessage(message);
    
    // 기존 음성 타이머 정리
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    // Web Speech API를 사용한 음성 메시지 - iOS 호환성 개선
    if ('speechSynthesis' in window && isSpeechEnabled) {
      // 기존 음성 완전히 중단하고 큐 비우기
      try {
        window.speechSynthesis.cancel();
        // iOS에서 완전한 중단을 위한 추가 대기
        speechTimeoutRef.current = setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = 'ko-KR';
          utterance.rate = 1.2; // 더 빠른 속도로 긴박감 증가
          utterance.pitch = 0.8; // 약간 낮은 톤으로 경고음 느낌
          utterance.volume = 1.0; // 최대 볼륨
          
          // iOS에서 음성 재생 보장을 위한 추가 처리
          utterance.onstart = () => {
            console.log('✅ 음성 재생 시작:', message);
          };
          
          utterance.onerror = (event) => {
            // interrupted 오류는 정상적인 상황이므로 경고 레벨로 처리
            if (event.error === 'interrupted') {
              console.warn('⚠️ 음성 재생 중단됨 (새로운 음성으로 교체)');
            } else if (event.error === 'not-allowed') {
              console.error('❌ 음성 재생 권한 없음 - 사용자 상호작용 필요');
            } else {
              console.error('❌ 음성 재생 오류:', event.error);
            }
          };
          
          utterance.onend = () => {
            console.log('✅ 음성 재생 완료');
            speechTimeoutRef.current = null; // 타이머 정리
          };
          
          // iOS Safari/Chrome에서 재생 시도
          try {
            // 재생 전 상태 확인
            if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
              console.log('🔄 기존 음성 대기 중 - 강제 중단 후 재시도');
              window.speechSynthesis.cancel();
              setTimeout(() => {
                window.speechSynthesis.speak(utterance);
              }, 100);
            } else {
              window.speechSynthesis.speak(utterance);
            }
          } catch (error) {
            console.error('❌ 음성 재생 실패:', error);
            speechTimeoutRef.current = null; // 실패 시 타이머 정리
          }
        }, 50); // 50ms 대기로 중단 완료 보장
      } catch (cancelError) {
        console.error('❌ 음성 중단 실패:', cancelError);
      }
    } else {
      if (!isSpeechEnabled) {
        console.warn('⚠️ 음성이 활성화되지 않음 - 화면을 터치해주세요');
      } else {
        console.warn('⚠️ Web Speech API가 지원되지 않습니다.');
      }
    }
  }, [isSpeechEnabled]);

  // 감정 개찰구 로직
  const processEmotionGate = useCallback((score: number) => {
    const NEGATIVE_THRESHOLD = -10; // 부정적 감정 임계값
    const POSITIVE_THRESHOLD = 20;  // 긍정적 감정 임계값
    
    if (score <= NEGATIVE_THRESHOLD) {
      if (gateStatus !== 'denied' && gateStatus !== 'locked') {
        setGateStatus('denied');
        playDeniedMessage('감정이 불안정하신 것 같아요. 진입은 잠시 보류됩니다.');
        
        // 3초 후 락 상태로 전환
        lockTimeoutRef.current = setTimeout(() => {
          // 2단계 더 극한 경고 메시지 먼저 재생
          playDeniedMessage('시스템 오류가 발생했습니다. 감정 불안정이 감지되어 출입이 일시적으로 제한됩니다.');
          
          // 음성과 동시에 락 상태와 타이머 설정 (동시 업데이트)
          setGateStatus('locked');
          setLockTimer(5); // 5초 카운트다운
        }, 3000);
      }
    } else if (score >= POSITIVE_THRESHOLD) {
      if (gateStatus !== 'approved') {
        // 감정이 개선되면 즉시 음성 중단 (denied/locked 상태에서)
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            console.log('🔇 감정 개선으로 인한 음성 중단');
          } catch (cancelError) {
            console.warn('⚠️ 음성 중단 실패:', cancelError);
          }
        }
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('approved');
        setDeniedMessage('');
        setLockTimer(0);
      }
    } else {
      if (gateStatus === 'approved' || gateStatus === 'denied' || gateStatus === 'locked') {
        // 중립 상태로 변경 시에도 음성 중단
        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
            console.log('🔇 중립 상태로 인한 음성 중단');
          } catch (cancelError) {
            console.warn('⚠️ 음성 중단 실패:', cancelError);
          }
        }
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('analyzing');
        setDeniedMessage('');
        setLockTimer(0);
      }
    }
  }, [gateStatus, playDeniedMessage]);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    cleanupVideo();
    cleanupDeepAR();
    
    // 음성 안전하게 중단
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        console.log('🧹 정리 함수에서 음성 중단 완료');
      } catch (cancelError) {
        console.warn('⚠️ 정리 함수에서 음성 중단 실패:', cancelError);
      }
    }
    
    // 락 타이머 정리
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    
    // 음성 타이머 정리
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
  }, [stopDetectionInterval, cleanupVideo, cleanupDeepAR]);

  // Effects
  useEffect(() => {
    console.log('컴포넌트 마운트됨');
    updateDimensions();
    loadModels();
    
    // 간단한 지연 후 비디오 시작
    setTimeout(() => {
      console.log('지연 후 비디오 시작 시도');
      startVideo();
    }, 1000);
    
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isModelLoaded && isCameraReady) {
      startDetectionInterval();
    } else {
      stopDetectionInterval();
    }
    
    return stopDetectionInterval;
  }, [isModelLoaded, isCameraReady, startDetectionInterval, stopDetectionInterval]);

  useEffect(() => {
    updateDeepARCanvasSize();
  }, [updateDeepARCanvasSize]);

  // 감정 스코어 변화에 따른 개찰구 처리
  useEffect(() => {
    if (emotionScore !== null && isModelLoaded && isCameraReady) {
      processEmotionGate(emotionScore);
    }
  }, [emotionScore, isModelLoaded, isCameraReady, processEmotionGate]);

  // DeepAR 로드 시 초기 설정
  useEffect(() => {
    if (isDeepARLoaded && !isInitializedRef.current) {
      isInitializedRef.current = true;
      console.log('DeepAR 초기화 완료 - 모든 효과 제거');
      
      // 초기에 모든 효과 제거하여 깔끔한 상태로 시작
      setTimeout(() => {
        applyEffect(null);
      }, 500);
    }
  }, [isDeepARLoaded, applyEffect]);

  // 감정 개찰구 시스템에 따른 자동 효과 적용
  useEffect(() => {
    if (!isDeepARLoaded || !emotionScore) return;
    
    // 스코어 값 검증 (-100~100 범위 확인)
    if (emotionScore < -100 || emotionScore > 100) {
      console.warn(`비정상적인 감정 점수: ${emotionScore}, 무시됨`);
      return;
    }
    
    // 안정적인 디바운싱을 위한 타이머
    const debounceTimer = setTimeout(() => {
      // 감정 점수를 -1~1 범위로 정규화 (-100~100 -> -1~1)
      const normalizedEmotion = Math.max(-100, Math.min(100, emotionScore)) / 100;
      
      if (normalizedEmotion < -0.2) {
        // 매우 부정적 감정 - 진입 허가하지만 효과 없음
        if (activeEffect === 'beauty') {
          console.log(`😔 매우 부정적 (${emotionScore.toFixed(1)}%) - 진입 허가, 효과 제거`);
          applyEffect(null);
        }
      } else if (normalizedEmotion >= -0.2 && normalizedEmotion < 0.1) {
        // 부정적 감정 - 입장 거부 및 왜곡 효과
        if (activeEffect !== 'beauty' || Math.abs(Date.now() % 5000) < 100) { // 5초마다 로그
          console.log(`🚫 감정 불안정 (${emotionScore.toFixed(1)}%) - 입장 거부, 왜곡 효과 적용`);
        }
        applyEffect('beauty', normalizedEmotion);
      } else if (normalizedEmotion >= 0.1 && normalizedEmotion < 0.4) {
        // 중립 감정 - 관찰 모드 (효과 없음)
        if (activeEffect === 'beauty') {
          console.log(`⚠️ 감정 상태 확인 중 (${emotionScore.toFixed(1)}%) - 대기 모드, 효과 제거`);
          applyEffect(null);
        }
      } else {
        // 긍정적 감정 - 입장 허가 (효과 없음)
        if (activeEffect === 'beauty') {
          console.log(`✅ 감정 안정적 (${emotionScore.toFixed(1)}%) - 입장 허가, 효과 제거`);
          applyEffect(null);
        }
      }
    }, 200); // 200ms 디바운싱으로 반응성 향상
    
    return () => clearTimeout(debounceTimer);
  }, [emotionScore, isDeepARLoaded, activeEffect, applyEffect]);

  // 락 타이머 카운트다운
  useEffect(() => {
    if (lockTimer > 0) {
      const timer = setTimeout(() => {
        setLockTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (lockTimer === 0 && gateStatus === 'locked') {
      setGateStatus('analyzing');
    }
  }, [lockTimer, gateStatus]);

  // 게이트 상태에 따른 스타일 결정
  const getGateStyles = () => {
    switch (gateStatus) {
      case 'denied':
        return {
          overlay: 'bg-red-500 bg-opacity-30',
          border: 'border-red-500 border-4',
          filter: 'contrast(120%) saturate(150%) hue-rotate(10deg)'
        };
      case 'locked':
        return {
          overlay: 'bg-red-700 bg-opacity-50',
          border: 'border-red-700 border-8 animate-pulse',
          filter: 'contrast(150%) saturate(200%) hue-rotate(20deg) blur(1px)'
        };
      case 'approved':
        return {
          overlay: 'bg-green-500 bg-opacity-20',
          border: 'border-green-500 border-2',
          filter: 'contrast(110%) saturate(120%) brightness(110%)'
        };
      default:
        return {
          overlay: 'bg-blue-500 bg-opacity-10',
          border: 'border-blue-300 border-2',
          filter: 'none'
        };
    }
  };

  const gateStyles = getGateStyles();

  return (
    <div 
      className="w-screen h-screen overflow-hidden relative" 
      ref={containerRef}
      onTouchStart={enableSpeechOnTouch}
      onClick={enableSpeechOnTouch}
    >
      <Head>
        <title>감정 개찰구 - 스마일 미러 AR</title>
        <meta name="description" content="감정 인식 기반 출입 통제 시스템" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 개찰구 프레임 */}
      <div className={`absolute inset-0 z-10 ${gateStyles.border} pointer-events-none`}>
        {/* 상단 헤더 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-b-lg border-2 border-gray-700 shadow-lg">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-1">🚇 감정 개찰구</h1>
            <div className={`text-sm font-medium ${
              gateStatus === 'analyzing' ? 'text-blue-300' :
              gateStatus === 'approved' ? 'text-green-300' :
              gateStatus === 'denied' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              {gateStatus === 'analyzing' && '📊 감정 분석 중...'}
              {gateStatus === 'approved' && '✅ 출입 허가됨'}
              {gateStatus === 'denied' && '⚠️ 출입 거부됨'}
              {gateStatus === 'locked' && `🔒 출입 제한됨 (${lockTimer}초)`}
            </div>
          </div>
        </div>

        {/* 좌우 기둥 */}
        <div className="absolute left-0 top-1/4 w-8 h-1/2 bg-gray-800 border-r-2 border-gray-600"></div>
        <div className="absolute right-0 top-1/4 w-8 h-1/2 bg-gray-800 border-l-2 border-gray-600"></div>

        {/* 하단 바 */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2/3 h-4 bg-gray-800 border-2 border-gray-600 rounded-t-lg">
          <div className={`h-full rounded-t-lg transition-colors duration-300 ${
            gateStatus === 'approved' ? 'bg-green-500' :
            gateStatus === 'denied' ? 'bg-yellow-500' :
            gateStatus === 'locked' ? 'bg-red-500' :
            'bg-blue-500'
          }`}>
            {/* LED 표시등 */}
            <div className="flex justify-center items-center h-full space-x-1">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    gateStatus === 'approved' ? 'bg-green-200' :
                    gateStatus === 'denied' ? 'bg-yellow-200' :
                    gateStatus === 'locked' ? 'bg-red-200 animate-pulse' :
                    'bg-blue-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 감정 기반 왜곡 오버레이 */}
      <EmotionGateOverlay gateStatus={gateStatus} lockTimer={lockTimer} />

      {/* 상태 오버레이 */}
      <div className={`absolute inset-0 z-5 ${gateStyles.overlay} pointer-events-none transition-all duration-500`} />

      {/* AR 효과 상태 표시 */}
      <div className="fixed top-4 right-4 z-50">
        <AREffectButtons
          isDeepARLoaded={isDeepARLoaded}
          activeEffect={activeEffect}
        />
      </div>

      {/* 스코어 표시 */}
      <Score 
        score={emotionScore}
      />

      {/* 음성 상태 표시기 */}
      <div className="absolute top-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-sm font-bold ${
          isSpeechEnabled 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white animate-pulse'
        }`}>
          {isSpeechEnabled ? '🔊 음성 활성' : '🔇 터치하여 음성 활성화'}
        </div>
      </div>

      <main className="relative w-full h-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            objectPosition: 'center top',
            opacity: videoOpacity,
            zIndex: '0',
            filter: gateStyles.filter,
            transition: 'filter 0.3s ease-in-out'
          }}
        />
        
        {/* DeepAR 캔버스 */}
        <canvas
          ref={deepARCanvasRef}
          style={{
            display: isDeepARLoaded ? 'block' : 'none',
            filter: gateStyles.filter,
            transition: 'filter 0.3s ease-in-out'
          }}
        />
        
        {/* Face API 캔버스 - 표정 감지용으로만 사용, 화면에 표시하지 않음 */}
        <canvas
          ref={faceAPICanvasRef}
          style={{
            display: 'none'
          }}
        />
        
        {/* 거부 메시지 표시 - 화면 하단 중앙 정렬 */}
        {deniedMessage && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-20 pointer-events-none">
            <div className="bg-yellow-600 text-white px-8 py-4 rounded-lg text-center max-w-md animate-bounce shadow-2xl border-2 border-yellow-400 pointer-events-auto">
              <div className="flex items-center justify-center space-x-2">
                <span className="text-2xl">🚫</span>
                <p className="text-lg font-semibold">{deniedMessage}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* 시스템 상태 표시 */}
        <div className="fixed bottom-4 left-4 z-40 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
          <div>감정 점수: {emotionScore?.toFixed(1) || '분석중'}</div>
          <div>시스템: {isModelLoaded && isCameraReady ? '온라인' : '오프라인'}</div>
        </div>
        
        <LoadingMessages
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          isDeepARLoaded={isDeepARLoaded}
        />
      </main>
    </div>
  );
} 