import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import * as faceapi from 'face-api.js';
import Score from '../components/Score';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [showFaceBox, setShowFaceBox] = useState<boolean>(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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
      };
    } catch (error) {
      console.error('웹캠 액세스 오류:', error);
    }
  };

  // 표정 감지 및 점수 계산 함수
  const detectExpressions = async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded || !isCameraReady) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 캔버스 크기 설정
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // 캔버스 초기화
    ctx?.clearRect(0, 0, canvas.width, canvas.height);

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
    startVideo();
  }, [dimensions]);

  // 표정 감지 인터벌 설정 (0.2초마다)
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    
    const interval = setInterval(detectExpressions, 200);
    
    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady]);

  return (
    <div className="w-screen h-screen overflow-hidden" ref={containerRef}>
      <Head>
        <title>스마일 미러</title>
        <meta name="description" content="실시간 표정 분석 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <button
        onClick={() => setShowFaceBox(!showFaceBox)}
        className="fixed top-0 left-0 m-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg shadow-lg z-50 transition-colors"
      >
        얼굴 감지 {showFaceBox ? '끄기' : '켜기'}
      </button>

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
              transform: 'scaleX(-1)'
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              display: showFaceBox ? 'block' : 'none',
              transform: 'scaleX(-1)'
            }}
          />
        </div>
        
        {!isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2">모델을 로드하는 중입니다...</p>
        )}
        
        {!isCameraReady && isModelLoaded && (
          <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2">카메라를 시작하는 중입니다...</p>
        )}
      </main>
    </div>
  );
} 