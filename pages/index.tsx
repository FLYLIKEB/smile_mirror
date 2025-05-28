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

  // 음성 메시지 재생 함수
  const playDeniedMessage = useCallback((message: string) => {
    setDeniedMessage(message);
    
    // Web Speech API를 사용한 음성 메시지
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.8;
      utterance.pitch = 0.7;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // 감정 개찰구 로직
  const processEmotionGate = useCallback((score: number) => {
    const NEGATIVE_THRESHOLD = -10; // 부정적 감정 임계값
    const POSITIVE_THRESHOLD = 20;  // 긍정적 감정 임계값
    
    if (score <= NEGATIVE_THRESHOLD) {
      if (gateStatus !== 'denied' && gateStatus !== 'locked') {
        setGateStatus('denied');
        playDeniedMessage('감정이 불안정하신 것 같아요. 진입은 잠시 보류됩니다.');
        
        // 3초 후 락 상태로 전환
        setTimeout(() => {
          setGateStatus('locked');
          setLockTimer(5); // 5초 카운트다운
        }, 3000);
      }
    } else if (score >= POSITIVE_THRESHOLD) {
      if (gateStatus !== 'approved') {
        setGateStatus('approved');
        setDeniedMessage('');
        setLockTimer(0);
      }
    } else {
      if (gateStatus === 'approved' || gateStatus === 'denied') {
        setGateStatus('analyzing');
        setDeniedMessage('');
      }
    }
  }, [gateStatus, playDeniedMessage]);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    cleanupVideo();
    cleanupDeepAR();
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
        // 중립 감정 - 관찰 모드
        if (activeEffect !== 'beauty' || Math.abs(Date.now() % 3000) < 100) { // 3초마다 로그
          console.log(`⚠️ 감정 상태 확인 중 (${emotionScore.toFixed(1)}%) - 대기 모드`);
        }
        applyEffect('beauty', normalizedEmotion);
      } else {
        // 긍정적 감정 - 입장 허가 및 환영 효과
        if (activeEffect !== 'beauty' || Math.abs(Date.now() % 2000) < 100) { // 2초마다 로그
          console.log(`✅ 감정 안정적 (${emotionScore.toFixed(1)}%) - 입장 허가, 환영 효과 적용`);
        }
        applyEffect('beauty', normalizedEmotion);
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
    <div className="w-screen h-screen overflow-hidden relative" ref={containerRef}>
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

      {/* AR 효과 버튼 */}
      <div className="fixed top-4 right-4 z-50">
      <AREffectButtons
        isDeepARLoaded={isDeepARLoaded}
        activeEffect={activeEffect}
        onApplyEffect={applyEffect}
          onSetBackground={setDeepARBackground}
      />
      </div>

      <main className="relative w-full h-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
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
        
        {/* 점수 표시 */}
        <Score score={emotionScore} />
        
        {/* 거부 메시지 표시 */}
        {deniedMessage && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-40 bg-red-600 text-white px-8 py-4 rounded-lg text-center max-w-md animate-bounce shadow-2xl border-2 border-red-400">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-2xl">🚫</span>
              <p className="text-lg font-semibold">{deniedMessage}</p>
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