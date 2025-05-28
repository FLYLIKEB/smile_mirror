import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import * as faceapi from 'face-api.js';
import Score from '../components/Score';

// DeepAR을 직접 임포트하지 않고 런타임에 로드
declare global {
  interface Window {
    deepar: any;
  }
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const deepARCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceAPICanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deepARRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [showFaceBox, setShowFaceBox] = useState<boolean>(true);
  const [isDeepARLoaded, setIsDeepARLoaded] = useState<boolean>(false);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // DeepAR 스크립트 로드
  const loadDeepARScript = () => {
    return new Promise<void>((resolve, reject) => {
      // 이미 로드되어 있는지 확인
      if (window.deepar && typeof window.deepar.initialize === 'function') {
        console.log('DeepAR 이미 로드됨');
        resolve();
        return;
      }

      // 기존 스크립트가 있는지 확인
      const existingScript = document.querySelector('script[src*="deepar"]');
      if (existingScript) {
        console.log('DeepAR 스크립트가 이미 존재함, 로드 대기 중...');
        // 스크립트가 로드될 때까지 대기
        const checkInterval = setInterval(() => {
          if (window.deepar && typeof window.deepar.initialize === 'function') {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        
        // 10초 후 타임아웃
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
        // 스크립트가 로드되었지만 window.deepar가 아직 없을 수 있음
        const checkInterval = setInterval(() => {
          if (window.deepar && typeof window.deepar.initialize === 'function') {
            console.log('window.deepar 사용 가능');
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        
        // 5초 후 타임아웃
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
  };

  // DeepAR 초기화 함수
  const initDeepAR = async () => {
    console.log('initDeepAR 호출됨');
    console.log('deepARCanvasRef.current:', deepARCanvasRef.current);
    console.log('isInitializingRef.current:', isInitializingRef.current);
    console.log('deepARRef.current:', deepARRef.current);
    
    if (!deepARCanvasRef.current || isInitializingRef.current || deepARRef.current) return;

    try {
      isInitializingRef.current = true;
      console.log('DeepAR 스크립트 로드 시작');
      await loadDeepARScript();
      console.log('DeepAR 스크립트 로드 완료');
      
      // 기존 인스턴스가 있다면 정리
      if (deepARRef.current) {
        try {
          await deepARRef.current.shutdown();
          deepARRef.current = null;
        } catch (error) {
          console.warn('기존 DeepAR 인스턴스 정리 중 오류:', error);
        }
      }
      
      console.log('DeepAR 초기화 시작');
      console.log('window.deepar:', window.deepar);
      
      // 캔버스 크기를 비디오와 동일하게 설정
      if (deepARCanvasRef.current && videoRef.current) {
        const video = videoRef.current;
        const canvas = deepARCanvasRef.current;
        
        // 비디오의 실제 크기 가져오기
        const videoWidth = video.videoWidth || dimensions.width;
        const videoHeight = video.videoHeight || dimensions.height;
        
        // 캔버스 크기 설정 (화면에 맞게 스케일링)
        const aspectRatio = videoWidth / videoHeight;
        let canvasWidth = dimensions.width;
        let canvasHeight = dimensions.height;
        
        // 비율 유지하면서 화면에 맞추기
        if (dimensions.width / dimensions.height > aspectRatio) {
          canvasWidth = dimensions.height * aspectRatio;
        } else {
          canvasHeight = dimensions.width / aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        console.log('캔버스 크기 설정:', { canvasWidth, canvasHeight, videoWidth, videoHeight });
      }
      
      // DeepAR v5.x 초기화 방법
      deepARRef.current = await window.deepar.initialize({
        licenseKey: process.env.NEXT_PUBLIC_DEEPAR_LICENSE_KEY || '421dfb74552bd0c2eb11b7a40eebb2419dbbe7a44d96eaa155e8658c20afe307e5aac445a210089f',
        canvas: deepARCanvasRef.current,
        additionalOptions: {
          cameraConfig: {
            disableDefaultCamera: true // 우리가 직접 카메라를 관리
          }
        }
      });
      
      console.log('DeepAR 인스턴스 생성 완료:', deepARRef.current);
      
      // 콜백 설정 (초기화 후)
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
        deepARRef.current.setVideoElement(videoRef.current, true);
      }
      
      // 초기화가 완료되었다고 가정하고 상태 업데이트
      // (콜백이 호출되지 않는 경우를 대비)
      setTimeout(() => {
        if (deepARRef.current && !isDeepARLoaded) {
          console.log('콜백이 호출되지 않아 강제로 상태 업데이트');
          setIsDeepARLoaded(true);
          isInitializingRef.current = false;
        }
      }, 2000);
      
    } catch (error) {
      console.error('DeepAR 초기화 오류:', error);
      isInitializingRef.current = false;
    }
  };

  // AR 효과 적용 함수
  const applyEffect = async (effectType: string | null) => {
    if (!deepARRef.current || !isDeepARLoaded) return;
    
    try {
      // 모든 효과 초기화
      await deepARRef.current.switchEffect(null);
      await deepARRef.current.backgroundBlur(false);
      await deepARRef.current.backgroundReplacement(false);
      
      if (effectType === null) {
        // 효과 제거
        setActiveEffect(null);
        console.log('모든 효과 제거됨');
      } else if (effectType === 'blur') {
        // 배경 블러 효과
        await deepARRef.current.backgroundBlur(true, 10);
        setActiveEffect(effectType);
        console.log('배경 블러 효과 적용됨');
      } else if (effectType === 'replacement') {
        // 배경 교체 효과 (단색 배경)
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 그라데이션 배경 생성
          const gradient = ctx.createLinearGradient(0, 0, 0, 480);
          gradient.addColorStop(0, '#667eea');
          gradient.addColorStop(1, '#764ba2');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 640, 480);
        }
        await deepARRef.current.backgroundReplacement(true, canvas);
        setActiveEffect(effectType);
        console.log('배경 교체 효과 적용됨');
      } else if (effectType === 'aviators') {
        // 선글라스 효과 (실제 존재하는 효과)
        await deepARRef.current.switchEffect('https://cdn.jsdelivr.net/npm/deepar/effects/aviators');
        setActiveEffect(effectType);
        console.log('선글라스 효과 적용됨');
      }
    } catch (error) {
      console.error('효과 적용 오류:', error);
    }
  };

  // 모델 로드 함수
  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setIsModelLoaded(true);
      console.log('모델이 로드되었습니다');
    } catch (error) {
      console.error('모델 로드 중 오류 발생:', error);
    }
  };

  // 화면 크기 조정 함수
  const updateDimensions = () => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({
        width: clientWidth,
        height: clientHeight
      });
    } else {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }
  };

  // DeepAR 캔버스 크기 업데이트 함수
  const updateDeepARCanvasSize = () => {
    if (deepARCanvasRef.current && videoRef.current && isDeepARLoaded) {
      const video = videoRef.current;
      const canvas = deepARCanvasRef.current;
      
      // 비디오의 실제 크기 가져오기
      const videoWidth = video.videoWidth || dimensions.width;
      const videoHeight = video.videoHeight || dimensions.height;
      
      // 캔버스 크기 설정 (화면에 맞게 스케일링)
      const aspectRatio = videoWidth / videoHeight;
      let canvasWidth = dimensions.width;
      let canvasHeight = dimensions.height;
      
      // 비율 유지하면서 화면에 맞추기
      if (dimensions.width / dimensions.height > aspectRatio) {
        canvasWidth = dimensions.height * aspectRatio;
      } else {
        canvasHeight = dimensions.width / aspectRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      console.log('DeepAR 캔버스 크기 업데이트:', { canvasWidth, canvasHeight });
    }
  };

  // 웹캠 시작 함수
  const startVideo = async () => {
    if (!videoRef.current) return;
    
    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: dimensions.height * (4/3) }, // 4:3 비율 유지
          height: { ideal: dimensions.height }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        setIsCameraReady(true);
        console.log('카메라가 준비되었습니다');
        
        // 카메라 준비되면 DeepAR 초기화 (한 번만)
        if (!deepARRef.current && !isInitializingRef.current) {
          initDeepAR();
        }
      };
    } catch (error) {
      console.error('웹캠 액세스 오류:', error);
    }
  };

  // 표정 감지 및 점수 계산 함수
  const detectExpressions = async () => {
    if (!videoRef.current || !faceAPICanvasRef.current || !isModelLoaded || !isCameraReady) return;
    
    const video = videoRef.current;
    const canvas = faceAPICanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.warn('Canvas 2D context를 가져올 수 없습니다');
      return;
    }
    
    // 캔버스 크기 설정
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const displaySize = { width: dimensions.width, height: dimensions.height };
    faceapi.matchDimensions(canvas, displaySize);
    
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

      // showFaceBox가 true이고 캔버스가 보이는 상태일 때만 그리기
      if (showFaceBox && canvas.style.display !== 'none') {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      }
    }
  };

  // 컴포넌트 마운트 시 화면 크기 설정, 모델 로드 및 웹캠 시작
  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    loadModels();
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      // 컴포넌트 언마운트 시 비디오 스트림 정리
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // 카메라 준비되면 시작
  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      startVideo();
    }
  }, [dimensions]);

  // 표정 감지 인터벌 설정 (0.2초마다)
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    
    const interval = setInterval(detectExpressions, 200);
    
    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady, showFaceBox]);

  // DeepAR 캔버스 크기 업데이트 (화면 크기 변경 시)
  useEffect(() => {
    updateDeepARCanvasSize();
  }, [dimensions, isDeepARLoaded]);

  // 컴포넌트 언마운트 시 DeepAR 정리
  useEffect(() => {
    return () => {
      if (deepARRef.current) {
        deepARRef.current.shutdown().catch((error: any) => {
          console.warn('DeepAR 종료 중 오류:', error);
        });
        deepARRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden" ref={containerRef}>
      <Head>
        <title>스마일 미러 AR</title>
        <meta name="description" content="실시간 AR 표정 분석 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <button
        onClick={() => setShowFaceBox(!showFaceBox)}
        className="fixed top-0 left-0 m-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg z-50 transition-colors"
      >
        얼굴 감지 {showFaceBox ? '끄기' : '켜기'}
      </button>

      {isDeepARLoaded && (
        <div className="fixed top-0 right-0 m-4 flex flex-col space-y-2 z-50">
          <button 
            onClick={() => applyEffect('blur')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg transition-colors"
          >
            배경 블러
          </button>
          <button 
            onClick={() => applyEffect('replacement')}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-lg transition-colors"
          >
            배경 교체
          </button>
          <button 
            onClick={() => applyEffect('aviators')}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg shadow-lg transition-colors"
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

      <Score score={emotionScore} />

      <main className="relative w-full h-full bg-black flex justify-center items-center">
        <div className="relative h-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              height: '100%',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
              transform: 'scaleX(-1)',
              opacity: isDeepARLoaded ? 0 : 1 // DeepAR 로드되면 비디오 숨김
            }}
          />
          
          {/* DeepAR 캔버스 */}
          <canvas
            ref={deepARCanvasRef}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) scaleX(-1)', // 중앙 정렬 + 미러링
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              display: isDeepARLoaded ? 'block' : 'none'
            }}
          />
          
          {/* Face API 캔버스 */}
          <canvas
            ref={faceAPICanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              display: showFaceBox && !isDeepARLoaded ? 'block' : 'none',
              transform: 'scaleX(-1)' // 미러링
            }}
          />
        </div>
        
        {!isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2">모델을 로드하는 중입니다...</p>
        )}
        
        {!isCameraReady && isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2">카메라를 시작하는 중입니다...</p>
        )}
        
        {!isDeepARLoaded && isCameraReady && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2">DeepAR을 로드하는 중입니다...</p>
        )}
      </main>
    </div>
  );
} 