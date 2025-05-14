import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import * as faceapi from 'face-api.js';
import Score from '../components/Score';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);

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

  // 웹캠 시작 함수
  const startVideo = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      
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
    
    // 캔버스 크기를 비디오 크기에 맞게 설정
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    
    // 표정 감지 실행
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();
    
    if (detections.length > 0) {
      const expressions = detections[0].expressions;
      
      // 감정 점수 계산: 행복 - (슬픔 + 화남 + 역겨움)
      const happyScore = expressions.happy;
      const negativeScore = expressions.sad + expressions.angry + expressions.disgusted;
      const score = happyScore - negativeScore;
      
      setEmotionScore(score);
      
      // 감지된 얼굴과 표정을 캔버스에 그림
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, resizedDetections);
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    }
  };

  // 컴포넌트 마운트 시 모델 로드 및 웹캠 시작
  useEffect(() => {
    loadModels();
    startVideo();
    
    return () => {
      // 컴포넌트 언마운트 시 비디오 스트림 정리
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // 표정 감지 인터벌 설정 (0.2초마다)
  useEffect(() => {
    if (!isModelLoaded || !isCameraReady) return;
    
    const interval = setInterval(detectExpressions, 200);
    
    return () => clearInterval(interval);
  }, [isModelLoaded, isCameraReady]);

  return (
    <div className="flex min-h-screen flex-col items-center py-8 bg-gray-100">
      <Head>
        <title>스마일 미러</title>
        <meta name="description" content="실시간 표정 분석 앱" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">스마일 미러</h1>
        
        <div className="relative mb-6">
          <video
            ref={videoRef}
            autoPlay
            muted
            width="640"
            height="480"
            className="rounded-lg shadow-lg"
          />
          <canvas
            ref={canvasRef}
            width="640"
            height="480"
            className="absolute top-0 left-0"
          />
        </div>
        
        <div className="w-full max-w-md">
          <Score score={emotionScore} />
        </div>
        
        {!isModelLoaded && (
          <p className="mt-4 text-yellow-600">모델을 로드하는 중입니다...</p>
        )}
        
        {!isCameraReady && isModelLoaded && (
          <p className="mt-4 text-yellow-600">카메라를 시작하는 중입니다...</p>
        )}
      </main>
    </div>
  );
} 