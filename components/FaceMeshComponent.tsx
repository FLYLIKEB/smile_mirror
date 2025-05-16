import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import {
  loadTensorflowModels,
  calculateMouthSmileStrength,
  isVideoReady
} from '../lib/faceUtils';

interface FaceMeshProps {
  onEmotionScoreChange: (score: number) => void;
  showMesh: boolean;
  onVideoRef: (element: HTMLVideoElement | null) => void;
}

const FaceMeshComponent: React.FC<FaceMeshProps> = ({ onEmotionScoreChange, showMesh, onVideoRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [detector, setDetector] = useState<any>(null);
  const [landmarks, setLandmarks] = useState<faceLandmarksDetection.Keypoint[] | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  // 비디오 참조를 부모 컴포넌트로 전달
  useEffect(() => {
    if (videoRef.current) {
      onVideoRef(videoRef.current);
      console.log('비디오 참조 전달됨');
    }
    return () => onVideoRef(null);
  }, [onVideoRef, isVideoReady]);

  // 웹캠 설정
  useEffect(() => {
    let isMounted = true;
    const setupCamera = async () => {
      if (!videoRef.current) {
        console.error('비디오 엘리먼트가 없음');
        return;
      }

      try {
        console.log('웹캠 접근 요청 중...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        if (!isMounted) return;
        
        console.log('웹캠 스트림 획득됨');
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('비디오 메타데이터 로드됨');
          if (isMounted) {
            setIsVideoReady(true);
            console.log('비디오 준비 완료');
          }
        };
      } catch (err) {
        console.error('웹캠 접근 오류:', err);
        if (isMounted) {
          setError('카메라에 접근할 수 없습니다.');
        }
      }
    };

    setupCamera();

    return () => {
      isMounted = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // TensorFlow.js 및 FaceMesh 모델 로드
  useEffect(() => {
    if (!isVideoReady) return;
    
    const loadModels = async () => {
      try {
        const faceDetector = await loadTensorflowModels();
        if (faceDetector) {
          setDetector(faceDetector);
          setIsModelLoaded(true);
          console.log('FaceMesh 모델 로드 완료');
        } else {
          setError('얼굴 인식 모델을 로드하는 데 실패했습니다.');
        }
      } catch (err) {
        console.error('모델 로드 오류:', err);
        setError('얼굴 인식 모델을 로드하는 데 문제가 발생했습니다.');
      }
    };
    
    loadModels();
  }, [isVideoReady]);

  // MediaPipe FaceMesh를 사용한 표정 분석
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady || !isModelLoaded || !detector) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastUpdate = 0;
    const fpsInterval = 1000 / 30; // 30fps

    // 얼굴 랜드마크 감지 함수
    const detectFacialLandmarks = async () => {
      if (!detector || !video) return null;
      
      try {
        const predictions = await detector.estimateFaces(video);
        
        if (predictions && predictions.length > 0) {
          // 첫 번째 얼굴의 랜드마크 반환
          setFaceDetected(true);
          return predictions[0].keypoints;
        } else {
          setFaceDetected(false);
          return null;
        }
      } catch (error) {
        console.error('얼굴 랜드마크 감지 오류:', error);
        setFaceDetected(false);
        return null;
      }
    };

    const processVideo = async (timestamp: number) => {
      if (timestamp - lastUpdate >= fpsInterval) {
        lastUpdate = timestamp;
        
        // 캔버스 크기 설정
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 비디오 프레임을 캔버스에 그림
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 얼굴 랜드마크 감지
        const faceLandmarks = await detectFacialLandmarks();
        setLandmarks(faceLandmarks);
        
        // 감정 점수 계산
        try {
          if (faceLandmarks) {
            // MediaPipe FaceMesh 랜드마크를 사용한 감정 점수 계산
            const smileStrengthScore = calculateMouthSmileStrength(faceLandmarks);
            
            // -1.0~1.0 범위의 점수를 -100~100으로 변환
            const emotionScore = smileStrengthScore * 100;
            
            // 감정 점수 업데이트
            onEmotionScoreChange(emotionScore);
            console.log(`FaceMesh 감정 점수: ${emotionScore.toFixed(1)}%`);
          } else {
            // 얼굴이 감지되지 않으면 점수 서서히 중립으로
            onEmotionScoreChange(0);
          }
        } catch (err) {
          console.error('표정 분석 오류:', err);
        }
        
        // 얼굴 메쉬 시각화
        if (showMesh && faceLandmarks) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 상태 표시 영역
          const statusBarHeight = 40;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, canvas.width, statusBarHeight);
          
          // 메시지 표시
          ctx.font = '18px Arial';
          ctx.fillStyle = faceDetected ? '#32EEDB' : '#FF5555';
          ctx.fillText(faceDetected ? '✓ 얼굴 감지됨' : '✗ 얼굴 감지 안됨', 20, 25);
          
          if (faceDetected) {
            // 랜드마크 그리기 (FaceMesh 포인트)
            // 색상별로 구분하여 표시
            if (faceLandmarks) {
              // 모든 랜드마크 작은 점으로 표시 (배경)
              ctx.fillStyle = 'rgba(50, 238, 219, 0.2)';
              for (let i = 0; i < faceLandmarks.length; i++) {
                const point = faceLandmarks[i];
                ctx.beginPath();
                ctx.arc(point.x, point.y, 0.5, 0, 2 * Math.PI);
                ctx.fill();
              }
              
              // 주요 특징점 구분하여 표시
              const { FACE_LANDMARKS } = await import('../lib/faceUtils');
              
              // 입 관련 랜드마크 (빨간색)
              ctx.fillStyle = '#FF5555';
              [
                FACE_LANDMARKS.LEFT_MOUTH_CORNER,
                FACE_LANDMARKS.RIGHT_MOUTH_CORNER,
                FACE_LANDMARKS.UPPER_LIP_TOP,
                FACE_LANDMARKS.LOWER_LIP_BOTTOM,
                FACE_LANDMARKS.UPPER_LIP_CENTER,
                FACE_LANDMARKS.LOWER_LIP_CENTER,
                FACE_LANDMARKS.MOUTH_LEFT,
                FACE_LANDMARKS.MOUTH_RIGHT,
                FACE_LANDMARKS.MOUTH_TOP,
                FACE_LANDMARKS.MOUTH_BOTTOM
              ].forEach(index => {
                const point = faceLandmarks[index];
                if (point) {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
              
              // 입 꼬리와 볼 (주황색)
              ctx.fillStyle = '#FFA500';
              [
                FACE_LANDMARKS.LEFT_MOUTH_OUTER,
                FACE_LANDMARKS.RIGHT_MOUTH_OUTER,
                FACE_LANDMARKS.LEFT_CHEEK_LOWER,
                FACE_LANDMARKS.RIGHT_CHEEK_LOWER,
                FACE_LANDMARKS.LEFT_CHEEK,
                FACE_LANDMARKS.RIGHT_CHEEK
              ].forEach(index => {
                const point = faceLandmarks[index];
                if (point) {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
              
              // 눈 랜드마크 (파란색)
              ctx.fillStyle = '#3388FF';
              [
                FACE_LANDMARKS.LEFT_EYE_OUTER,
                FACE_LANDMARKS.LEFT_EYE_INNER,
                FACE_LANDMARKS.RIGHT_EYE_OUTER,
                FACE_LANDMARKS.RIGHT_EYE_INNER,
                FACE_LANDMARKS.LEFT_EYE_BOTTOM,
                FACE_LANDMARKS.RIGHT_EYE_BOTTOM,
                FACE_LANDMARKS.LEFT_EYE_TOP,
                FACE_LANDMARKS.RIGHT_EYE_TOP
              ].forEach(index => {
                const point = faceLandmarks[index];
                if (point) {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
              
              // 눈썹 랜드마크 (보라색)
              ctx.fillStyle = '#9933FF';
              [
                FACE_LANDMARKS.LEFT_EYEBROW_OUTER,
                FACE_LANDMARKS.LEFT_EYEBROW_INNER,
                FACE_LANDMARKS.RIGHT_EYEBROW_OUTER,
                FACE_LANDMARKS.RIGHT_EYEBROW_INNER,
                FACE_LANDMARKS.LEFT_EYEBROW_MID,
                FACE_LANDMARKS.RIGHT_EYEBROW_MID
              ].forEach(index => {
                const point = faceLandmarks[index];
                if (point) {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
              
              // 기타 중요 랜드마크 (노란색)
              ctx.fillStyle = '#FFFF33';
              [
                FACE_LANDMARKS.NOSE_TIP,
                FACE_LANDMARKS.CHIN_BOTTOM,
                FACE_LANDMARKS.FOREHEAD_CENTER,
                FACE_LANDMARKS.MIDPOINT_BETWEEN_EYEBROWS
              ].forEach(index => {
                const point = faceLandmarks[index];
                if (point) {
                  ctx.beginPath();
                  ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                  ctx.fill();
                }
              });
              
              // 감정 분석에 중요한 특징 연결 (눈과 입의 관계)
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.lineWidth = 0.5;
              
              // 눈과 입 꼬리 연결 (웃음 감지에 중요)
              const drawConnectionIfExists = (index1: number, index2: number) => {
                const point1 = faceLandmarks[index1];
                const point2 = faceLandmarks[index2];
                if (point1 && point2) {
                  ctx.beginPath();
                  ctx.moveTo(point1.x, point1.y);
                  ctx.lineTo(point2.x, point2.y);
                  ctx.stroke();
                }
              };
              
              // 눈과 입 사이 연결
              drawConnectionIfExists(FACE_LANDMARKS.LEFT_EYE_OUTER, FACE_LANDMARKS.LEFT_MOUTH_CORNER);
              drawConnectionIfExists(FACE_LANDMARKS.RIGHT_EYE_OUTER, FACE_LANDMARKS.RIGHT_MOUTH_CORNER);
              
              // 눈썹과 눈 사이 연결 (슬픔/화남 감지에 중요)
              drawConnectionIfExists(FACE_LANDMARKS.LEFT_EYEBROW_MID, FACE_LANDMARKS.LEFT_EYE_TOP);
              drawConnectionIfExists(FACE_LANDMARKS.RIGHT_EYEBROW_MID, FACE_LANDMARKS.RIGHT_EYE_TOP);
              
              // 입 가로 연결 (웃음 곡선 표시)
              drawConnectionIfExists(FACE_LANDMARKS.LEFT_MOUTH_CORNER, FACE_LANDMARKS.UPPER_LIP_CENTER);
              drawConnectionIfExists(FACE_LANDMARKS.UPPER_LIP_CENTER, FACE_LANDMARKS.RIGHT_MOUTH_CORNER);
            }
            
            // 감정 상태에 따른 이모지 표시
            let emoji = '😐';
            const emotionScore = calculateMouthSmileStrength(faceLandmarks) * 100;
            
            if (emotionScore > 50) emoji = '😄';
            else if (emotionScore > 20) emoji = '🙂';
            else if (emotionScore < -50) emoji = '😢';
            else if (emotionScore < -20) emoji = '🙁';
            
            const scoreText = `표정 점수: ${emotionScore.toFixed(1)}%`;
            ctx.fillStyle = '#32EEDB';
            ctx.fillText(scoreText, canvas.width - 150, 25);
            
            // 트래킹 중인 랜드마크 범주 설명
            ctx.font = '14px Arial';
            ctx.fillStyle = '#FF5555';
            ctx.fillText('● 입', 20, 60);
            ctx.fillStyle = '#FFA500';
            ctx.fillText('● 입꼬리/볼', 60, 60);
            ctx.fillStyle = '#3388FF';
            ctx.fillText('● 눈', 140, 60);
            ctx.fillStyle = '#9933FF';
            ctx.fillText('● 눈썹', 170, 60);
            ctx.fillStyle = '#FFFF33';
            ctx.fillText('● 기타', 220, 60);
            
            // 감정 이모지
            ctx.font = '30px Arial';
            ctx.fillStyle = '#32EEDB';
            ctx.fillText(emoji, 260, 35);
          } else {
            // 얼굴 감지 실패 메시지
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            ctx.font = '24px Arial';
            ctx.fillStyle = '#FF5555';
            ctx.textAlign = 'center';
            ctx.fillText('얼굴이 감지되지 않았습니다', centerX, centerY - 50);
            ctx.font = '18px Arial';
            ctx.fillText('카메라 앞에 얼굴을 위치시켜 주세요', centerX, centerY - 20);
            
            // 안내용 원 표시
            ctx.beginPath();
            const guideSize = Math.min(canvas.width, canvas.height) * 0.3;
            ctx.ellipse(centerX, centerY + 50, guideSize/2, guideSize/1.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#FF5555';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // 얼굴 윤곽 아이콘
            drawFaceIcon(ctx, centerX, centerY + 50, guideSize/2);
          }
        } else if (showMesh) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 상태 표시 영역
          const statusBarHeight = 40;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(0, 0, canvas.width, statusBarHeight);
          
          // 메시지 표시
          ctx.font = '18px Arial';
          ctx.fillStyle = '#FF5555';
          ctx.fillText('모델 로드 중...', 20, 25);
        }
      }
      
      animationRef.current = requestAnimationFrame(processVideo);
    };
    
    animationRef.current = requestAnimationFrame(processVideo);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVideoReady, showMesh, onEmotionScoreChange, isModelLoaded, detector]);

  // 얼굴 아이콘 그리기 함수
  const drawFaceIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const headRadius = size * 0.5;
    
    // 머리 윤곽
    ctx.beginPath();
    ctx.arc(x, y, headRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF5555';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 눈
    const eyeOffset = headRadius * 0.3;
    const eyeSize = headRadius * 0.15;
    
    ctx.beginPath();
    ctx.arc(x - eyeOffset, y - eyeOffset * 0.5, eyeSize, 0, Math.PI * 2);
    ctx.arc(x + eyeOffset, y - eyeOffset * 0.5, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FF5555';
    ctx.fill();
    
    // 입 (미소)
    ctx.beginPath();
    ctx.arc(x, y + eyeOffset, headRadius * 0.4, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#FF5555';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <p className="text-white text-xl">오류: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onCanPlay={() => {
          console.log('비디오 재생 가능');
          setIsVideoReady(true);
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)'
        }}
      />
      {showMesh && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            pointerEvents: 'none'
          }}
        />
      )}
      {!isVideoReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <p className="text-white text-xl">카메라를 불러오는 중...</p>
        </div>
      )}
    </div>
  );
};

// NoSSR로 컴포넌트 내보내기
export default dynamic(() => Promise.resolve(FaceMeshComponent), {
  ssr: false
}); 