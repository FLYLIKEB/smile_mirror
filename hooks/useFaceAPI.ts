import { useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Dimensions } from '../types';
import { MODEL_URL, DETECTION_INTERVAL, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants';

export const useFaceAPI = (
  faceAPICanvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  dimensions: Dimensions
) => {
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [emotionScore, setEmotionScore] = useState<number>(0);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);

  // 모델 로드
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

  // 표정 감지
  const detectExpressions = useCallback(async () => {
    if (!videoRef.current || !faceAPICanvasRef.current || !isModelLoaded || !isCameraReady) return;
    
    const video = videoRef.current;
    const canvas = faceAPICanvasRef.current;
    
    // 캔버스 크기를 고정값으로 설정 (화면에 표시되지 않으므로)
    if (canvas.width !== DEFAULT_CANVAS_WIDTH || canvas.height !== DEFAULT_CANVAS_HEIGHT) {
      canvas.width = DEFAULT_CANVAS_WIDTH;
      canvas.height = DEFAULT_CANVAS_HEIGHT;
    }
    
    // 표정 감지용으로만 사용하므로 고정 크기로 matchDimensions
    const displaySize = { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
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
  }, [isModelLoaded, isCameraReady, faceAPICanvasRef, videoRef]);

  // 표정 감지 인터벌 시작
  const startDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    detectionIntervalRef.current = setInterval(detectExpressions, DETECTION_INTERVAL);
  }, [detectExpressions]);

  // 표정 감지 인터벌 중지
  const stopDetectionInterval = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  }, []);

  // 카메라 준비 상태 설정
  const setCameraReady = useCallback((ready: boolean) => {
    setIsCameraReady(ready);
  }, []);

  return {
    emotionScore,
    isModelLoaded,
    isCameraReady,
    loadModels,
    detectExpressions,
    startDetectionInterval,
    stopDetectionInterval,
    setCameraReady
  };
}; 