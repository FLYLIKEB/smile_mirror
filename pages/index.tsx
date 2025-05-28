import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Head from 'next/head';
import * as faceapi from 'face-api.js';
import Score from '../components/Score';

// DeepAR을 직접 임포트하지 않고 런타임에 로드
declare global {
  interface Window {
    deepar: any;
  }
}

// 상수 정의
const DEEPAR_LICENSE_KEY = process.env.NEXT_PUBLIC_DEEPAR_LICENSE_KEY || '421dfb74552bd0c2eb11b7a40eebb2419dbbe7a44d96eaa155e8658c20afe307e5aac445a210089f';
const MODEL_URL = '/models';
const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 240;
const DEFAULT_CANVAS_WIDTH = 640;
const DEFAULT_CANVAS_HEIGHT = 480;
const DETECTION_INTERVAL = 200;
const FRAME_STABILIZATION_DELAY = 1000;
const DEEPAR_INIT_TIMEOUT = 3000;
const DEEPAR_RETRY_DELAY = 5000;

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
  const deepARRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [isDeepARLoaded, setIsDeepARLoaded] = useState<boolean>(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 캔버스 크기 계산 함수 (통합)
  const calculateCanvasDimensions = useCallback((
    videoWidth: number, 
    videoHeight: number, 
    containerWidth: number, 
    containerHeight: number
  ): CanvasDimensions => {
    // 안전한 크기 보장
    const safeVideoWidth = Math.max(videoWidth || DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH);
    const safeVideoHeight = Math.max(videoHeight || DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT);
    
    const aspectRatio = safeVideoWidth / safeVideoHeight;
    let displayWidth = containerWidth;
    let displayHeight = containerHeight;
    
    // 비율 유지하면서 화면에 맞추기
    if (containerWidth / containerHeight > aspectRatio) {
      displayWidth = containerHeight * aspectRatio;
    } else {
      displayHeight = containerWidth / aspectRatio;
    }
    
    return {
      width: safeVideoWidth,
      height: safeVideoHeight,
      displayWidth,
      displayHeight,
      aspectRatio
    };
  }, []);

  // 캔버스 설정 함수 (통합)
  const setupCanvas = useCallback((
    canvas: HTMLCanvasElement,
    canvasDimensions: CanvasDimensions,
    isDeepAR: boolean = false
  ) => {
    // 캔버스 내부 해상도 설정
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;
    
    // 두 캔버스 모두 동일한 전체화면 설정
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.objectFit = 'cover';
    canvas.style.pointerEvents = 'none';
    
    if (isDeepAR) {
      canvas.style.zIndex = '1';
    } else {
      canvas.style.zIndex = '2';
    }
    
    console.log(`${isDeepAR ? 'DeepAR' : 'FaceAPI'} 캔버스 설정:`, canvasDimensions);
  }, []);

  // 비디오 제약 조건 생성
  const createVideoConstraints = useCallback((containerHeight: number): VideoConstraints => ({
    video: {
      facingMode: 'user',
      width: { ideal: containerHeight * (4/3) },
      height: { ideal: containerHeight }
    }
  }), []);

  // DeepAR 스크립트 로드 (메모이제이션)
  const loadDeepARScript = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (window.deepar && typeof window.deepar.initialize === 'function') {
        console.log('DeepAR 이미 로드됨');
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[src*="deepar"]');
      if (existingScript) {
        console.log('DeepAR 스크립트가 이미 존재함, 로드 대기 중...');
        const checkInterval = setInterval(() => {
          if (window.deepar && typeof window.deepar.initialize === 'function') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('DeepAR 스크립트 로드 타임아웃'));
        }, 10000);
        return;
      }

      console.log('새 DeepAR 스크립트 생성');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.js';
      script.async = true;
      script.onload = () => {
        console.log('DeepAR 스크립트 onload 이벤트');
        const checkInterval = setInterval(() => {
          if (window.deepar && typeof window.deepar.initialize === 'function') {
            console.log('window.deepar 사용 가능');
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          if (window.deepar) {
            resolve();
          } else {
            reject(new Error('DeepAR 객체를 찾을 수 없음'));
          }
        }, 5000);
      };
      script.onerror = () => {
        console.error('DeepAR 스크립트 로드 실패');
        reject(new Error('DeepAR 스크립트 로드 실패'));
      };
      document.head.appendChild(script);
    });
  }, []);

  // DeepAR 초기화 함수 (최적화)
  const initDeepAR = useCallback(async () => {
    console.log('initDeepAR 호출됨');
    
    if (!deepARCanvasRef.current || isInitializingRef.current || deepARRef.current) return;

    // 비디오가 실제로 프레임을 출력하고 있는지 확인
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log('비디오 프레임이 아직 준비되지 않음, 1초 후 재시도');
      setTimeout(initDeepAR, 1000);
      return;
    }

    try {
      isInitializingRef.current = true;
      console.log('DeepAR 스크립트 로드 시작');
      await loadDeepARScript();
      console.log('DeepAR 스크립트 로드 완료');
      
      // 기존 인스턴스 정리
      if (deepARRef.current) {
        try {
          await deepARRef.current.shutdown();
          deepARRef.current = null;
        } catch (error) {
          console.warn('기존 DeepAR 인스턴스 정리 중 오류:', error);
        }
      }
      
      console.log('DeepAR 초기화 시작');
      
      // 통합된 캔버스 설정 사용
      if (deepARCanvasRef.current && videoRef.current) {
        const video = videoRef.current;
        const canvasDimensions = calculateCanvasDimensions(
          video.videoWidth,
          video.videoHeight,
          dimensions.width,
          dimensions.height
        );
        
        setupCanvas(deepARCanvasRef.current, canvasDimensions, true);
      }
      
      // 카메라 프레임 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // DeepAR 초기화
      deepARRef.current = await window.deepar.initialize({
        licenseKey: DEEPAR_LICENSE_KEY,
        canvas: deepARCanvasRef.current,
        additionalOptions: {
          cameraConfig: {
            disableDefaultCamera: true
          },
          memoryLimit: 256 * 1024 * 1024,
          renderingOptions: {
            clearColor: [0, 0, 0, 0]
          }
        }
      });
      
      console.log('DeepAR 인스턴스 생성 완료:', deepARRef.current);
      
      // 콜백 설정
      if (deepARRef.current.callbacks) {
        deepARRef.current.callbacks.onInitialize = () => {
          console.log('DeepAR onInitialize 콜백 호출됨');
          setIsDeepARLoaded(true);
          isInitializingRef.current = false;
        };
        
        deepARRef.current.callbacks.onError = (error: string) => {
          console.error('DeepAR onError 콜백:', error);
          isInitializingRef.current = false;
        };
      }
      
      // 비디오 소스 설정
      if (videoRef.current && videoRef.current.srcObject) {
        console.log('비디오 소스 설정');
        await new Promise(resolve => setTimeout(resolve, 200));
        deepARRef.current.setVideoElement(videoRef.current, true);
      }
      
      // 폴백 메커니즘
      setTimeout(() => {
        if (deepARRef.current && !isDeepARLoaded) {
          console.log('콜백이 호출되지 않아 강제로 상태 업데이트');
          setIsDeepARLoaded(true);
          isInitializingRef.current = false;
        }
      }, DEEPAR_INIT_TIMEOUT);
      
    } catch (error) {
      console.error('DeepAR 초기화 오류:', error);
      isInitializingRef.current = false;
      
      // 재시도 메커니즘
      setTimeout(() => {
        if (!deepARRef.current && !isInitializingRef.current) {
          console.log('DeepAR 초기화 재시도');
          initDeepAR();
        }
      }, DEEPAR_RETRY_DELAY);
    }
  }, [loadDeepARScript, calculateCanvasDimensions, setupCanvas, dimensions, isDeepARLoaded]);

  // AR 효과 적용 함수 (최적화)
  const applyEffect = useCallback(async (effectType: string | null) => {
    if (!deepARRef.current || !isDeepARLoaded) {
      console.log('DeepAR이 준비되지 않음');
      return;
    }
    
    try {
      console.log(`효과 적용 시작: ${effectType}`);
      
      // 모든 효과 안전하게 초기화
      const cleanupPromises = [
        deepARRef.current.switchEffect(null).catch((e: any) => console.warn('switchEffect 초기화 오류:', e)),
        deepARRef.current.backgroundBlur(false).catch((e: any) => console.warn('backgroundBlur 초기화 오류:', e)),
        deepARRef.current.backgroundReplacement(false).catch((e: any) => console.warn('backgroundReplacement 초기화 오류:', e))
      ];
      
      await Promise.allSettled(cleanupPromises);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (effectType === null) {
        setActiveEffect(null);
        console.log('모든 효과 제거됨');
      } else if (effectType === 'blur') {
        await deepARRef.current.backgroundBlur(true, 10);
        setActiveEffect(effectType);
        console.log('배경 블러 효과 적용됨');
      } else if (effectType === 'replacement') {
        const canvas = document.createElement('canvas');
        canvas.width = DEFAULT_CANVAS_WIDTH;
        canvas.height = DEFAULT_CANVAS_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const gradient = ctx.createLinearGradient(0, 0, 0, DEFAULT_CANVAS_HEIGHT);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT);
        }
        await deepARRef.current.backgroundReplacement(true, canvas);
        setActiveEffect(effectType);
        console.log('배경 교체 효과 적용됨');
      } else if (effectType === 'aviators') {
        await deepARRef.current.switchEffect('https://cdn.jsdelivr.net/npm/deepar/effects/aviators');
        setActiveEffect(effectType);
        console.log('선글라스 효과 적용됨');
      }
    } catch (error) {
      console.error('효과 적용 오류:', error);
      
      // 오류 시 안전한 정리
      try {
        const cleanupPromises = [
          deepARRef.current.switchEffect(null),
          deepARRef.current.backgroundBlur(false),
          deepARRef.current.backgroundReplacement(false)
        ];
        await Promise.allSettled(cleanupPromises);
        setActiveEffect(null);
        console.log('오류 후 모든 효과 제거됨');
      } catch (cleanupError) {
        console.error('효과 정리 중 오류:', cleanupError);
      }
    }
  }, [isDeepARLoaded]);

  // 모델 로드 함수 (최적화)
  const loadModels = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setIsModelLoaded(true);
      console.log('모델이 로드되었습니다');
    } catch (error) {
      console.error('모델 로드 중 오류 발생:', error);
    }
  }, []);

  // 화면 크기 조정 함수 (최적화)
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    } else {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
  }, []);

  // 캔버스 크기 업데이트 함수 (통합)
  const updateCanvasSizes = useCallback(() => {
    if (!videoRef.current || (!faceAPICanvasRef.current && !deepARCanvasRef.current)) {
      return;
    }
    
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
      console.log('비디오 크기가 유효하지 않음, 캔버스 크기 업데이트 건너뜀');
      return;
    }
    
    const canvasDimensions = calculateCanvasDimensions(
      videoWidth,
      videoHeight,
      dimensions.width,
      dimensions.height
    );
    
    // FaceAPI 캔버스 업데이트
    if (faceAPICanvasRef.current) {
      setupCanvas(faceAPICanvasRef.current, canvasDimensions, false);
    }
    
    // DeepAR 캔버스 업데이트
    if (deepARCanvasRef.current && isDeepARLoaded) {
      const currentWidth = deepARCanvasRef.current.width;
      const currentHeight = deepARCanvasRef.current.height;
      
      if (currentWidth !== canvasDimensions.width || currentHeight !== canvasDimensions.height) {
        setupCanvas(deepARCanvasRef.current, canvasDimensions, true);
        
        // DeepAR resize 호출
        if (deepARRef.current && typeof deepARRef.current.resize === 'function') {
          try {
            deepARRef.current.resize(canvasDimensions.width, canvasDimensions.height);
          } catch (error) {
            console.warn('DeepAR resize 호출 중 오류:', error);
          }
        }
      }
    }
  }, [dimensions, isDeepARLoaded, calculateCanvasDimensions, setupCanvas]);

  // 웹캠 시작 함수 (최적화)
  const startVideo = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      const constraints = createVideoConstraints(dimensions.height);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log('비디오 메타데이터 로드됨');
        setIsCameraReady(true);
      };
      
      videoRef.current.onplaying = () => {
        console.log('비디오 재생 시작됨');
        
        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            console.log('카메라가 완전히 준비되었습니다. DeepAR 초기화 시작');
            
            if (!deepARRef.current && !isInitializingRef.current) {
              initDeepAR();
            }
          }
        }, FRAME_STABILIZATION_DELAY);
      };
      
      videoRef.current.onerror = (error) => {
        console.error('비디오 오류:', error);
      };
      
    } catch (error) {
      console.error('웹캠 액세스 오류:', error);
    }
  }, [dimensions.height, createVideoConstraints, initDeepAR]);

  // 표정 감지 함수 (최적화)
  const detectExpressions = useCallback(async () => {
    if (!videoRef.current || !faceAPICanvasRef.current || !isModelLoaded || !isCameraReady) return;
    
    const video = videoRef.current;
    const canvas = faceAPICanvasRef.current;
    
    // 캔버스는 표정 감지용으로만 사용, 화면에 그리지 않음
    const displaySize = { width: dimensions.width, height: dimensions.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    try {
      // 표정 감지 실행
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();
      
      if (detections.length > 0) {
        const expressions = detections[0].expressions;
        const happyScore = expressions.happy;
        const negativeScore = expressions.sad + expressions.angry + expressions.disgusted;
        const rawScore = happyScore - negativeScore;
        const percentageScore = Math.max(Math.min(rawScore * 100, 100), -100);
        setEmotionScore(percentageScore);
      }
    } catch (error) {
      console.warn('표정 감지 중 오류:', error);
    }
  }, [isModelLoaded, isCameraReady, dimensions]);

  // 표정 감지 인터벌 관리
  const startDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    detectionIntervalRef.current = setInterval(detectExpressions, DETECTION_INTERVAL);
  }, [detectExpressions]);

  const stopDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    
    // 비디오 스트림 정리
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
    }
    
    // DeepAR 정리
    if (deepARRef.current) {
      deepARRef.current.shutdown().catch((error: any) => {
        console.warn('DeepAR 종료 중 오류:', error);
      });
      deepARRef.current = null;
    }
    
    isInitializingRef.current = false;
  }, [stopDetectionInterval]);

  // 메모이제이션된 값들
  const videoOpacity = useMemo(() => isDeepARLoaded ? 0 : 1, [isDeepARLoaded]);

  // Effects
  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    loadModels();
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      cleanup();
    };
  }, [updateDimensions, loadModels, cleanup]);

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      startVideo();
    }
  }, [dimensions, startVideo]);

  useEffect(() => {
    if (isModelLoaded && isCameraReady) {
      startDetectionInterval();
    } else {
      stopDetectionInterval();
    }
    
    return stopDetectionInterval;
  }, [isModelLoaded, isCameraReady, startDetectionInterval, stopDetectionInterval]);

  useEffect(() => {
    updateCanvasSizes();
  }, [dimensions, isDeepARLoaded, updateCanvasSizes]);

  return (
    <div className="w-screen h-screen overflow-hidden" ref={containerRef}>
      <Head>
        <title>스마일 미러 AR</title>
        <meta name="description" content="실시간 AR 표정 분석 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {isDeepARLoaded && (
        <div className="fixed top-0 right-0 m-4 flex flex-col space-y-2 z-50">
          <button 
            onClick={() => applyEffect('blur')}
            className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
              activeEffect === 'blur' 
                ? 'bg-blue-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            배경 블러
          </button>
          <button 
            onClick={() => applyEffect('replacement')}
            className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
              activeEffect === 'replacement' 
                ? 'bg-green-700 text-white' 
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
          >
            배경 교체
          </button>
          <button 
            onClick={() => applyEffect('aviators')}
            className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
              activeEffect === 'aviators' 
                ? 'bg-pink-700 text-white' 
                : 'bg-pink-600 hover:bg-pink-500 text-white'
            }`}
          >
            선글라스
          </button>
          <button 
            onClick={() => applyEffect(null)}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg shadow-lg transition-colors"
          >
            효과 제거
          </button>
        </div>
      )}

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
            transform: 'scaleX(-1)',
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
        
        {!isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
            모델을 로드하는 중입니다...
          </p>
        )}
        
        {!isCameraReady && isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
            카메라를 시작하는 중입니다...
          </p>
        )}
        
        {!isDeepARLoaded && isCameraReady && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
            DeepAR을 로드하는 중입니다...
          </p>
        )}
      </main>
    </div>
  );
} 