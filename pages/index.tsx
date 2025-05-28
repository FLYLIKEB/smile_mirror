import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Head from 'next/head';
import Score from '../components/Score';
import AREffectButtons from '../components/AREffectButtons';
import LoadingMessages from '../components/LoadingMessages';
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

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const deepARCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceAPICanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);

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
    cleanup: cleanupDeepAR
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

  return (
    <div className="w-screen h-screen overflow-hidden" ref={containerRef}>
      <Head>
        <title>스마일 미러 AR</title>
        <meta name="description" content="실시간 AR 표정 분석 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <AREffectButtons
        isDeepARLoaded={isDeepARLoaded}
        activeEffect={activeEffect}
        onApplyEffect={applyEffect}
      />

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
            zIndex: '0'
          }}
        />
        
        {/* DeepAR 캔버스 */}
        <canvas
          ref={deepARCanvasRef}
          style={{
            display: isDeepARLoaded ? 'block' : 'none'
          }}
        />
        
        {/* Face API 캔버스 - 표정 감지용으로만 사용, 화면에 표시하지 않음 */}
        <canvas
          ref={faceAPICanvasRef}
          style={{
            display: 'none' // 성능 개선을 위해 항상 숨김
          }}
        />
        
        {/* 점수 표시 */}
        <Score score={emotionScore} />
        
        <LoadingMessages
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          isDeepARLoaded={isDeepARLoaded}
        />
      </main>
    </div>
  );
} 