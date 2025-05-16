import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

interface VideoEffectsProps {
  videoElement: HTMLVideoElement | null;
  emotionScore: number;
}

const VideoEffects: React.FC<VideoEffectsProps> = ({ videoElement, emotionScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const lastScoreRef = useRef<number>(0);
  
  // 감정 점수가 급격하게 변하지 않도록 부드럽게 처리
  const smoothedScore = useRef<number>(0);
  
  useEffect(() => {
    console.log('VideoEffects 마운트됨, 비디오 엘리먼트:', !!videoElement);
    
    if (!videoElement || !canvasRef.current) {
      console.error('비디오 또는 캔버스 엘리먼트가 없음');
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('캔버스 2D 컨텍스트를 가져올 수 없음');
      return;
    }
    
    let lastUpdate = 0;
    const fpsInterval = 1000 / 30; // 30fps
    
    // 간단한 렌더링 함수
    const render = (timestamp: number) => {
      try {
        // 프레임 제한
        if (timestamp - lastUpdate < fpsInterval) {
          rafRef.current = requestAnimationFrame(render);
          return;
        }
        
        lastUpdate = timestamp;
        
        if (videoElement.readyState < 2) {
          console.log('비디오가 아직 준비되지 않음, 상태:', videoElement.readyState);
          rafRef.current = requestAnimationFrame(render);
          return;
        }
        
        // 점수 부드럽게 변환
        smoothedScore.current += (emotionScore - smoothedScore.current) * 0.05;
        const currentScore = smoothedScore.current;
        
        // 현재 점수가 이전과 크게 다르지 않으면 너무 자주 로깅하지 않음
        if (Math.abs(currentScore - lastScoreRef.current) > 5) {
          console.log('현재 감정 점수:', currentScore.toFixed(2));
          lastScoreRef.current = currentScore;
        }
        
        // 캔버스 크기 설정
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 480;
        
        // 비디오 프레임 복사
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // 이미지 데이터 가져오기
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 감정 점수에 따른 효과 적용
        if (currentScore > 0) {
          // 긍정적 감정 효과: 밝기 증가, 따뜻한 색조
          const factor = currentScore / 100;
          
          for (let i = 0; i < data.length; i += 4) {
            // 밝기 증가 (최대 30%)
            const brightnessFactor = 1 + factor * 0.3;
            data[i] = Math.min(255, data[i] * brightnessFactor);  // 빨강 채널 (약간 더 강화)
            data[i + 1] = Math.min(255, data[i + 1] * brightnessFactor); // 초록 채널
            data[i + 2] = Math.min(255, data[i + 2]); // 파랑 채널 (그대로 유지)
            
            // 따뜻한 느낌 추가 (약간의 붉은색/노란색 증가)
            data[i] = Math.min(255, data[i] + factor * 15);      // 빨강 추가
            data[i + 1] = Math.min(255, data[i + 1] + factor * 10); // 초록 약간 추가 (노란 느낌)
          }
        } else if (currentScore < 0) {
          // 부정적 감정 효과: 어둡게, 푸른 색조, 노이즈 추가, 약간의 왜곡
          const factor = Math.abs(currentScore) / 100;
          
          // 왜곡 효과 준비 (파도 같은 효과)
          const wavePhase = Date.now() * 0.002;
          const waveAmplitude = factor * 5;
          
          for (let y = 0; y < canvas.height; y++) {
            // 줄마다 다른 파도 효과
            const waveOffset = Math.sin(wavePhase + y * 0.1) * waveAmplitude;
            
            for (let x = 0; x < canvas.width; x++) {
              // 픽셀 인덱스 계산
              const sourceIndex = (y * canvas.width + x) * 4;
              
              // 왜곡된 X 좌표 계산
              const distortedX = Math.round(x + waveOffset);
              
              // 왜곡된 좌표가 유효한 범위인지 확인
              if (distortedX >= 0 && distortedX < canvas.width) {
                const targetIndex = (y * canvas.width + distortedX) * 4;
                
                // 현재 픽셀을 왜곡된 위치로 복사
                data[targetIndex] = data[sourceIndex];
                data[targetIndex + 1] = data[sourceIndex + 1];
                data[targetIndex + 2] = data[sourceIndex + 2];
                data[targetIndex + 3] = data[sourceIndex + 3];
              }
            }
          }
          
          // 색상 및 노이즈 효과 적용
          for (let i = 0; i < data.length; i += 4) {
            // 어둡게 (최대 40%)
            const darknessFactor = 1 - factor * 0.4;
            data[i] = data[i] * darknessFactor;     // 빨강 채널
            data[i + 1] = data[i + 1] * darknessFactor; // 초록 채널
            data[i + 2] = data[i + 2] * darknessFactor; // 파랑 채널
            
            // 푸른 색조 추가
            data[i] = Math.max(0, data[i] - factor * 20);      // 빨강 감소
            data[i + 1] = Math.max(0, data[i + 1] - factor * 10); // 초록 약간 감소
            
            // 노이즈 추가
            if (Math.random() < factor * 0.3) {
              const noise = Math.random() * 50 * factor;
              data[i] = Math.max(0, Math.min(255, data[i] + noise - 25));
              data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise - 25));
              data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise - 25));
            }
          }
        }
        
        // 변경된 이미지 데이터 적용
        ctx.putImageData(imageData, 0, 0);
        
        rafRef.current = requestAnimationFrame(render);
      } catch (err) {
        console.error('렌더링 오류:', err);
        rafRef.current = requestAnimationFrame(render);
      }
    };
    
    rafRef.current = requestAnimationFrame(render);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [videoElement, emotionScore]);
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        transform: 'scaleX(-1)', // 거울 모드
        pointerEvents: 'none',   // 마우스 이벤트 통과
        zIndex: 10               // 다른 요소보다 위에 표시
      }}
    />
  );
};

export default dynamic(() => Promise.resolve(VideoEffects), {
  ssr: false
}); 