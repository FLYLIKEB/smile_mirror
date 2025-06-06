import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Head from 'next/head';
import Score from '../components/Score';
import AREffectButtons from '../components/AREffectButtons';
import LoadingMessages from '../components/LoadingMessages';
import EmotionGateOverlay from '../components/EmotionGateOverlay';
import FutureAccessModal from '../components/FutureAccessModal';
import GateFrame from '../components/GateFrame';
import SpeechStatusIndicator from '../components/SpeechStatusIndicator';
import DeniedMessage from '../components/DeniedMessage';
import SystemStatus from '../components/SystemStatus';
import { useDeepAR } from '../hooks/useDeepAR';
import { useFaceAPI } from '../hooks/useFaceAPI';
import { useVideo } from '../hooks/useVideo';
import { useDimensions } from '../hooks/useDimensions';
import { useSpeech } from '../hooks/useSpeech';
import { useEmotionGate } from '../hooks/useEmotionGate';
import { type EmotionGateStatus } from '../constants/emotionGate';
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

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const deepARCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceAPICanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);

  // 시민ID 상태 관리 (hydration 오류 방지)
  const [citizenId, setCitizenId] = useState<string>('------');

  // 미래형 출입 허용 팝업 상태 관리
  const [showAccessModal, setShowAccessModal] = useState<boolean>(false);

  // 화면 크기 관리
  const { dimensions, updateDimensions } = useDimensions(containerRef);

  // 음성 관리
  const {
    isSpeechEnabled,
    isSpeechPlaying,
    enableSpeech,
    stopSpeech,
    playMessage,
    playApprovalMessage,
    cleanup: cleanupSpeech
  } = useSpeech();

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
    takeScreenshot: takeDeepARScreenshot,
    setDeepARBackground
  } = useDeepAR(deepARCanvasRef, videoRef, dimensions);

  // 감정 개찰구 관리
  const {
    gateStatus,
    deniedMessage,
    lockTimer,
    showApprovalModal,
    setShowApprovalModal,
    processEmotionGate,
    updateLockTimer,
    cleanup: cleanupEmotionGate
  } = useEmotionGate({
    playMessage,
    playApprovalMessage,
    stopSpeech,
    isSpeechPlaying,
    showAccessModal
  });

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

  // 클라이언트 측에서만 시민ID 생성
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const randomId = `SM${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      setCitizenId(randomId);
    }
  }, []);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    cleanupVideo();
    cleanupDeepAR();
    cleanupSpeech();
    cleanupEmotionGate();
  }, [stopDetectionInterval, cleanupVideo, cleanupDeepAR, cleanupSpeech, cleanupEmotionGate]);

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
      console.log('🔍 감정 감지 시작');
      startDetectionInterval();
    } else {
      stopDetectionInterval();
    }
    
    return stopDetectionInterval;
  }, [isModelLoaded, isCameraReady, startDetectionInterval, stopDetectionInterval]);

  useEffect(() => {
    updateDeepARCanvasSize();
  }, [updateDeepARCanvasSize]);





  // 락 타이머 관리
  useEffect(() => {
    return updateLockTimer();
  }, [updateLockTimer]);

  // 감정 스코어 변화에 따른 개찰구 처리
  useEffect(() => {
    if (showApprovalModal) {
      console.log('🎉 출입허가 팝업 표시 중 - useEffect에서 감정 처리 차단');
      return;
    }
    
    if (emotionScore !== null && isModelLoaded && isCameraReady) {
      processEmotionGate(emotionScore);
    }
  }, [emotionScore, isModelLoaded, isCameraReady, processEmotionGate, showApprovalModal]);

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
    if (!isDeepARLoaded || !emotionScore) {
      return;
    }
    
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
  }, [emotionScore, isDeepARLoaded, activeEffect, applyEffect, isSpeechEnabled]);

  // 캔버스 치수 계산
  const canvasDimensions: CanvasDimensions = useMemo(() => {
    if (!dimensions.width || !dimensions.height) {
      return {
        width: 640,
        height: 480,
        displayWidth: 640,
        displayHeight: 480,
        aspectRatio: 4/3
      };
    }

    const aspectRatio = dimensions.width / dimensions.height;
    
    return {
      width: dimensions.width,
      height: dimensions.height,
      displayWidth: dimensions.width,
      displayHeight: dimensions.height,
      aspectRatio
    };
  }, [dimensions]);

  // 게이트 상태에 따른 화면 필터 효과
  const getVideoFilter = () => {
    switch (gateStatus) {
      case 'denied':
        return 'contrast(120%) saturate(150%) hue-rotate(10deg)';
      case 'locked':
        return 'contrast(200%) saturate(300%) hue-rotate(30deg) blur(2px) brightness(80%)';
      case 'approved':
        return 'contrast(110%) saturate(120%) brightness(110%)';
      default:
        return 'none';
    }
  };

  const videoFilter = getVideoFilter();



  return (
    <div 
      className="w-screen h-screen overflow-hidden relative" 
      ref={containerRef}
      onTouchStart={enableSpeech}
      onClick={enableSpeech}
    >
      <Head>
        <title>HappyGate - 감정 출입 통제 시스템</title>
        <meta name="description" content="공공안전을 위한 감정 상태 검증 및 출입 통제 시스템" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 개찰구 프레임 */}
      <GateFrame gateStatus={gateStatus} lockTimer={lockTimer} />

      {/* 감정 기반 왜곡 오버레이 */}
      <EmotionGateOverlay gateStatus={gateStatus} lockTimer={lockTimer} />

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
      <SpeechStatusIndicator 
        isSpeechEnabled={isSpeechEnabled}
        isSpeechPlaying={isSpeechPlaying}
      />

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
            filter: videoFilter,
            transition: 'filter 0.3s ease-in-out'
          }}
        />
        
        {/* DeepAR 캔버스 */}
        <canvas
          ref={deepARCanvasRef}
          style={{
            display: isDeepARLoaded ? 'block' : 'none',
            filter: videoFilter,
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
        
        {/* 거부 메시지 표시 */}
        <DeniedMessage message={deniedMessage} />
        
        {/* 시스템 상태 표시 */}
        <SystemStatus
          emotionScore={emotionScore}
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          citizenId={citizenId}
        />
        
        <LoadingMessages
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          isDeepARLoaded={isDeepARLoaded}
        />
      </main>

      {/* 미래형 출입 허용 팝업 */}
      <FutureAccessModal
        isVisible={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        emotionScore={emotionScore || 0}
        citizenId={citizenId}
      />
    </div>
  );
} 