'use client';

import React, { useEffect, useRef } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

interface SmileCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  smileStrength: number; // -1.0 ~ 1.0 범위 (-100% ~ +100%)
  landmarks: faceLandmarksDetection.Keypoint[] | null;
  className?: string;
}

const SmileCanvas: React.FC<SmileCanvasProps> = ({
  videoRef,
  smileStrength,
  landmarks,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  // 캔버스 렌더링 로직
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const effectCanvas = effectCanvasRef.current;
    
    if (!video || !canvas || !effectCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const effectCtx = effectCanvas.getContext('2d');
    if (!ctx || !effectCtx) return;
    
    // 캔버스 크기 설정
    const setCanvasSize = () => {
      if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        effectCanvas.width = canvas.width;
        effectCanvas.height = canvas.height;
      }
    };
    
    // 비디오가 준비되었는지 확인
    if (video.readyState >= 2) {
      setCanvasSize();
    } else {
      const handleVideoReady = () => setCanvasSize();
      video.addEventListener('loadeddata', handleVideoReady);
      
      return () => {
        video.removeEventListener('loadeddata', handleVideoReady);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
    
    // 미소 효과 적용 함수
    const applySmileEffect = (strength: number) => {
      effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);
      
      if (!landmarks || landmarks.length === 0) return;
      
      // 절대 강도 계산 (0 ~ 1 범위)
      const absStrength = Math.abs(strength);
      
      // 얼굴 윤곽선 그리기
      effectCtx.strokeStyle = `rgba(255, 255, 255, ${absStrength * 0.3})`;
      effectCtx.lineWidth = 2;
      
      // 감정 상태에 따른 효과 색상 설정
      let glowColor = 'rgba(255, 255, 255, 0.3)'; // 기본 흰색
      
      if (strength > 0) { // 긍정적 감정 (웃음)
        if (strength > 0.7) {
          glowColor = 'rgba(255, 215, 0, 0.6)'; // 황금색 (매우 기쁨)
        } else if (strength > 0.4) {
          glowColor = 'rgba(0, 191, 255, 0.5)'; // 하늘색 (약간 기쁨)
        }
      } else if (strength < 0) { // 부정적 감정 (화남/슬픔)
        if (strength < -0.7) {
          glowColor = 'rgba(255, 0, 0, 0.6)'; // 빨간색 (매우 화남)
        } else if (strength < -0.4) {
          glowColor = 'rgba(255, 69, 0, 0.5)'; // 주황색 (약간 화남)
        }
      }
      
      effectCtx.shadowColor = glowColor;
      effectCtx.shadowBlur = 15 * absStrength;
      
      // 입 주변 하이라이트
      if (landmarks) {
        try {
          // 입 주변 랜드마크 추출
          const mouthPoints = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291].map(idx => 
            landmarks[idx] ? landmarks[idx] : null
          ).filter(point => point !== null) as faceLandmarksDetection.Keypoint[];
          
          if (mouthPoints.length > 0) {
            // 입 주변 영역 하이라이트
            effectCtx.beginPath();
            effectCtx.moveTo(mouthPoints[0].x, mouthPoints[0].y);
            
            for (let i = 1; i < mouthPoints.length; i++) {
              effectCtx.lineTo(mouthPoints[i].x, mouthPoints[i].y);
            }
            
            effectCtx.closePath();
            effectCtx.fillStyle = `rgba(255, 255, 255, ${absStrength * 0.1})`;
            effectCtx.fill();
            effectCtx.stroke();
          }
        } catch (error) {
          console.error("랜드마크 처리 오류:", error);
        }
      }
      
      // 감정 점수 표시
      // 음수/양수에 따라 다른 접두사 사용
      const prefix = strength > 0 ? '+' : '';
      const scoreText = `${prefix}${Math.round(strength * 100)}%`;
      const fontSize = 24 + (absStrength * 12);
      
      effectCtx.font = `bold ${fontSize}px Arial`;
      effectCtx.textAlign = 'center';
      effectCtx.textBaseline = 'top';
      
      // 그림자 효과로 텍스트 테두리
      effectCtx.fillStyle = glowColor;
      effectCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      effectCtx.shadowBlur = 5;
      effectCtx.shadowOffsetX = 2;
      effectCtx.shadowOffsetY = 2;
      
      // 감정에 따른 이모지 선택
      let emoji = '😐'; // 기본 무표정
      if (strength > 0.7) emoji = '😄'; // 매우 웃음
      else if (strength > 0.4) emoji = '🙂'; // 약간 웃음
      else if (strength > 0.1) emoji = '😊'; // 미소
      else if (strength < -0.7) emoji = '😠'; // 매우 화남
      else if (strength < -0.4) emoji = '😒'; // 약간 화남
      else if (strength < -0.1) emoji = '😕'; // 살짝 불만
      
      // 테스트용 점수 표시
      console.log(`캔버스 감정 점수: ${scoreText} (강도: ${strength}, 절대값: ${absStrength})`);
      
      // 텍스트와 이모지 표시
      effectCtx.fillText(`${emoji} ${scoreText}`, effectCanvas.width - 80, 30);
      
      // 그림자 초기화
      effectCtx.shadowColor = 'transparent';
      effectCtx.shadowBlur = 0;
      effectCtx.shadowOffsetX = 0;
      effectCtx.shadowOffsetY = 0;
    };
    
    // 렌더링 함수
    const renderFrame = () => {
      if (video && canvas && ctx) {
        // 캔버스 초기화 및 비디오 그리기
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 미소 효과 적용
        applySmileEffect(smileStrength);
      }
      
      animationRef.current = requestAnimationFrame(renderFrame);
    };
    
    // 렌더링 시작
    animationRef.current = requestAnimationFrame(renderFrame);
    
    // 클린업
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoRef, smileStrength, landmarks]);
  
  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-contain pointer-events-none ${className || ''}`}
      />
      <canvas
        ref={effectCanvasRef}
        className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none z-10"
      />
    </>
  );
};

export default SmileCanvas;