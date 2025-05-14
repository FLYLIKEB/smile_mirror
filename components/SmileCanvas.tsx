'use client';

import React, { useEffect, useRef } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { applyEyeEnhancement } from '../lib/warpUtils';

interface SmileCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  smileStrength: number;
  landmarks: faceLandmarksDetection.Keypoint[] | null;
  showDebug?: boolean;
  className?: string;
}

const SmileCanvas: React.FC<SmileCanvasProps> = ({
  videoRef,
  smileStrength,
  landmarks,
  showDebug = false,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  // 캔버스 렌더링 로직
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const debugCanvas = debugCanvasRef.current;
    
    if (!video || !canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 크기 설정
    const setCanvasSize = () => {
      if (video && canvas && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (debugCanvas) {
          debugCanvas.width = canvas.width;
          debugCanvas.height = canvas.height;
        }
      }
    };
    
    // 비디오가 준비되었는지 확인
    if (video.readyState >= 2) {
      setCanvasSize();
    } else {
      // 비디오가 준비되지 않았다면 이벤트 리스너 추가
      const handleVideoReady = () => {
        setCanvasSize();
      };
      video.addEventListener('loadeddata', handleVideoReady);
      
      // 클린업 시 이벤트 리스너 제거
      return () => {
        video.removeEventListener('loadeddata', handleVideoReady);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
    
    let lastRender = 0;
    const renderInterval = 1000 / 30; // 30fps
    
    // 보정 효과 렌더링 함수
    const renderEffect = (timestamp: number) => {
      if (!video || !canvas || !ctx) {
        animationRef.current = requestAnimationFrame(renderEffect);
        return;
      }
      
      if (timestamp - lastRender >= renderInterval) {
        lastRender = timestamp;
        
        try {
          // 캔버스 초기화
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // 기본 비디오 렌더링 (랜드마크가 없을 경우)
          if (!landmarks || landmarks.length === 0) {
            // 랜드마크가 없으면 아무것도 하지 않음 (캔버스는 이미 위에서 클리어됨)
          } else {
            // 눈 확대 효과 적용
            applyEyeEnhancement(
              ctx,
              canvas.width,
              canvas.height,
              video,
              landmarks,
              smileStrength,
              true // 좌우반전 적용
            );
          }
          
          // 디버그 캔버스에 정보 표시
          if (showDebug && debugCanvas) {
            const debugCtx = debugCanvas.getContext('2d');
            if (debugCtx) {
              // 디버그 캔버스 초기화
              debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
              
              // 디버그 정보 표시 상자 (오른쪽 상단에 위치)
              const margin = 20;
              const boxWidth = 200;
              const boxHeight = 100;
              const boxX = debugCanvas.width - boxWidth - margin;
              const boxY = margin;
              
              // 반투명 배경 상자
              debugCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
              debugCtx.fillRect(boxX, boxY, boxWidth, boxHeight);
              
              // 테두리 및 상단 강조
              debugCtx.fillStyle = 'rgba(32, 156, 238, 0.8)';
              debugCtx.fillRect(boxX, boxY, boxWidth, 4);
              
              // 텍스트 정보
              debugCtx.font = 'bold 16px Arial';
              debugCtx.fillStyle = 'white';
              debugCtx.textAlign = 'left';
              debugCtx.fillText('디버그 정보', boxX + 10, boxY + 25);
              
              // 데이터 값
              debugCtx.font = '14px Arial';
              debugCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              debugCtx.fillText(`웃음 강도: ${(smileStrength * 100).toFixed(1)}%`, boxX + 10, boxY + 50);
              debugCtx.fillText(`눈 확대 비율: ${(1 + smileStrength * 0.3).toFixed(2)}x`, boxX + 10, boxY + 75);
              
              // 감지된 랜드마크 표시 (선택 사항)
              if (landmarks && landmarks.length > 0) {
                debugCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                landmarks.forEach(point => {
                  // 비디오 좌우반전 고려
                  const x = debugCanvas.width - point.x; // 좌우반전 적용
                  debugCtx.beginPath();
                  debugCtx.arc(x, point.y, 2, 0, Math.PI * 2);
                  debugCtx.fill();
                });
              }
            }
          }
        } catch (error) {
          console.error('렌더링 오류:', error);
        }
      }
      
      animationRef.current = requestAnimationFrame(renderEffect);
    };
    
    // 렌더링 시작
    animationRef.current = requestAnimationFrame(renderEffect);
    
    // 클린업
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [videoRef, smileStrength, landmarks, showDebug]);
  
  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute top-0 left-0 w-full h-full object-contain pointer-events-none ${className || ''}`}
      />
      {showDebug && (
        <canvas
          ref={debugCanvasRef}
          className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none z-30"
        />
      )}
    </>
  );
};

export default SmileCanvas; 