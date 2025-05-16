'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import {
  loadTensorflowModels,
  calculateMouthSmileStrength
} from '../lib/faceUtils';
import SmileCanvas from './SmileCanvas';

interface SmileFilterProps {
  className?: string;
}

const SmileFilter: React.FC<SmileFilterProps> = ({ className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smileStrength, setSmileStrength] = useState(0);
  const [faceLandmarks, setFaceLandmarks] = useState<faceLandmarksDetection.Keypoint[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detector, setDetector] = useState<any>(null);
  
  // 피드백 메시지 가져오기
  const getFeedbackMessage = (strength: number) => {
    // 긍정적 감정 (웃음)
    if (strength > 0.9) return "최상의 미소 상태입니다!";
    if (strength > 0.7) return "밝고 행복한 표정이네요!";
    if (strength > 0.5) return "좋은 미소를 짓고 있어요";
    if (strength > 0.3) return "미소가 좀 더 필요해요";
    if (strength > 0.1) return "약간 미소를 지어보세요";
    if (strength >= 0) return "미소를 지어 보세요";
    
    // 부정적 감정 (화남/슬픔)
    if (strength < -0.7) return "매우 화난 표정입니다";
    if (strength < -0.4) return "불만이 있으신가요?";
    if (strength < -0.1) return "조금 찌푸린 표정이네요";
    return "표정이 중립적입니다";
  };
  
  // 웹캠 설정
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const setupCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
          };
        }
      } catch (err) {
        setError('카메라에 접근할 수 없습니다. 권한을 확인해주세요.');
      }
    };
    
    setupCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // TensorFlow.js 모델 로드
  useEffect(() => {
    if (!isCameraReady) return;
    
    const loadModels = async () => {
      try {
        const faceDetector = await loadTensorflowModels();
        if (faceDetector) {
          setDetector(faceDetector);
          setIsModelReady(true);
        } else {
          setError('얼굴 인식 모델을 로드하는 데 실패했습니다.');
          setIsModelReady(true);
        }
      } catch (err) {
        setError('얼굴 인식 모델을 로드하는 데 문제가 발생했습니다.');
        setIsModelReady(true);
      }
    };
    
    loadModels();
  }, [isCameraReady]);
  
  // 얼굴 표정 분석
  useEffect(() => {
    if (!isModelReady || !videoRef.current) return;
    
    const detectFace = async () => {
      if (!videoRef.current || isDetecting) {
        requestRef.current = requestAnimationFrame(detectFace);
        return;
      }
      
      setIsDetecting(true);
      
      try {
        let smileScore = 0;
        let landmarks = null;
        
        if (detector && videoRef.current) {
          const videoElement = videoRef.current;
          
          if (!videoElement.videoWidth || !videoElement.videoHeight) {
            throw new Error('Invalid video dimensions');
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            
            const faces = await detector.estimateFaces(canvas, { 
              flipHorizontal: false,
              staticImageMode: true
            });
            
            if (faces && faces.length > 0) {
              const face = faces[0];
              landmarks = face.keypoints;
              if (landmarks) {
                setFaceLandmarks(landmarks);
                smileScore = calculateMouthSmileStrength(landmarks);
                smileScore = Math.max(-1, Math.min(1, smileScore));
              } else {
                setFaceLandmarks(null);
              }
            } else {
              setFaceLandmarks(null);
            }
          }
        }
        
        setSmileStrength(smileScore);
      } catch (error) {
        console.error('표정 감지 오류:', error);
      } finally {
        setIsDetecting(false);
        
        setTimeout(() => {
          requestRef.current = requestAnimationFrame(detectFace);
        }, 100);
      }
    };
    
    detectFace();
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isModelReady, detector, isDetecting]);
  
  // UI 색상 설정 - 감정에 따라 다른 색상 사용
  const getUIColor = (strength: number) => {
    // 긍정적 감정 (웃음)
    if (strength > 0.7) return 'from-cyan-500 to-blue-500';
    if (strength > 0.4) return 'from-blue-500 to-indigo-500';
    if (strength > 0) return 'from-indigo-500 to-purple-500';
    
    // 부정적 감정 (화남/슬픔)
    if (strength < -0.7) return 'from-red-600 to-red-500';
    if (strength < -0.4) return 'from-red-500 to-orange-500';
    return 'from-orange-500 to-amber-500';
  };
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full transform"
      />
      
      {isCameraReady && isModelReady && (
        <>
          <SmileCanvas
            videoRef={videoRef}
            landmarks={faceLandmarks}
            smileStrength={smileStrength}
            className=""
          />
          
          {/* 미래적인 UI 피드백 패널 */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-20 pointer-events-none">
            <div 
              className={`bg-gradient-to-r ${getUIColor(smileStrength)} p-3 rounded-xl 
                         backdrop-blur-md bg-opacity-30 border border-white/20 
                         shadow-lg shadow-blue-500/20`}
            >
              <div className="flex items-center justify-between">
                <div>
                  {/* 피드백 메시지 */}
                  <p className="text-white font-bold text-lg tracking-wide">
                    {getFeedbackMessage(smileStrength)}
                  </p>
                  
                  {/* 진행 상태 바 */}
                  <div className="mt-2 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${smileStrength >= 0 ? 'bg-white' : 'bg-red-400'} transition-all duration-300 
                                rounded-full flex items-center justify-end
                                shadow-lg ${smileStrength >= 0 ? 'shadow-white/40' : 'shadow-red-400/40'}`}
                      style={{ 
                        width: `${Math.abs(smileStrength) * 100}%`,
                        boxShadow: smileStrength >= 0 
                          ? `0 0 10px ${smileStrength > 0.5 ? '#3b82f6' : '#6366f1'}`
                          : `0 0 10px ${smileStrength < -0.5 ? '#ef4444' : '#f97316'}`
                      }}
                    >
                      <div className={`h-full aspect-square rounded-full ${smileStrength >= 0 ? 'bg-white' : 'bg-red-300'} mr-0.5 animate-pulse`}></div>
                    </div>
                  </div>
                </div>
                
                {/* 점수 */}
                <div className="bg-white/10 rounded-full p-3 backdrop-blur-lg border border-white/20">
                  <span className="font-mono text-xl font-bold text-white tracking-widest">
                    {smileStrength >= 0 ? '+' : ''}{Math.round(smileStrength * 100)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {isCameraReady && !isModelReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-30">
          <div className="relative w-16 h-16">
            <div className="absolute w-full h-full rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
            <div className="absolute w-full h-full rounded-full border-4 border-r-transparent border-purple-500 animate-spin animation-delay-500"></div>
          </div>
          <p className="mt-6 text-xl text-blue-300 font-medium tracking-wide">얼굴 인식 모델 초기화 중...</p>
          <p className="text-blue-400/70 text-sm mt-2">미소 분석 준비 중입니다</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 text-white p-4 backdrop-blur-md z-50">
          <div className="bg-black/50 p-6 rounded-xl max-w-md border border-red-300/30">
            <div className="flex items-center">
              <div className="bg-red-600 rounded-full p-2 mr-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-xl font-bold">오류 발생</p>
            </div>
            <p className="mt-3 text-gray-200">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmileFilter; 