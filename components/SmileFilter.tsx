'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import {
  loadFaceApiModels,
  loadTensorflowModels,
  calculateSmileStrength,
  calculateMouthSmileStrength,
  getCombinedSmileScore,
  isVideoReady
} from '../lib/faceUtils';
import SmileCanvas from './SmileCanvas';

// Window 인터페이스 확장
declare global {
  interface Window {
    lastFaceMeshErrorTime: number;
    USE_FACEMESH: boolean;
  }
}

interface SmileFilterProps {
  className?: string;
}

const SmileFilter: React.FC<SmileFilterProps> = ({ className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  
  // 상태 관리
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isFaceApiReady, setIsFaceApiReady] = useState(false);
  const [isTensorflowReady, setIsTensorflowReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smileStrength, setSmileStrength] = useState(0);
  const [faceLandmarks, setFaceLandmarks] = useState<faceLandmarksDetection.Keypoint[] | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detector, setDetector] = useState<any>(null);
  
  // 웹캠 설정
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const setupCamera = async () => {
      try {
        console.log('카메라 권한 요청 중...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsCameraReady(true);
            console.log('카메라 준비 완료');
          };
        }
      } catch (err) {
        console.error('카메라 접근 오류:', err);
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
  
  // face-api.js 모델 로드
  useEffect(() => {
    if (!isCameraReady) return;
    
    const loadModels = async () => {
      try {
        const success = await loadFaceApiModels();
        if (success) {
          setIsFaceApiReady(true);
        } else {
          setError('face-api.js 모델을 로드하는 데 실패했습니다.');
        }
      } catch (err) {
        console.error('face-api.js 모델 로드 오류:', err);
        setError('face-api.js 모델을 로드하는 데 문제가 발생했습니다.');
      }
    };
    
    loadModels();
  }, [isCameraReady]);
  
  // TensorFlow.js 및 FaceMesh 모델 로드
  useEffect(() => {
    if (!isCameraReady) return;
    
    // 전역 설정 - FaceMesh 사용 여부
    if (typeof window !== 'undefined') {
      // 기본적으로 FaceMesh 사용하지 않음
      window.USE_FACEMESH = false;
    }
    
    // 2초 지연 후 로드하여 초기화 충돌 방지
    const loadTfModels = async () => {
      try {
        // 2초 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('TensorFlow.js 모델 로드 시작');
        
        // FaceMesh 사용 설정이 활성화된 경우에만 로드
        if (window.USE_FACEMESH) {
          const faceDetector = await loadTensorflowModels();
          if (faceDetector) {
            setDetector(faceDetector);
            setIsTensorflowReady(true);
          } else {
            console.log('FaceMesh 사용 안함');
            setIsTensorflowReady(true); // FaceMesh 없이도 진행
          }
        } else {
          console.log('FaceMesh 비활성화됨: face-api.js만 사용');
          setIsTensorflowReady(true); // FaceMesh 없이도 진행
        }
      } catch (err) {
        console.error('TensorFlow.js 모델 로드 오류:', err);
        setIsTensorflowReady(true); // 오류가 있어도 계속 진행
      }
    };
    
    loadTfModels();
  }, [isCameraReady]);
  
  // 얼굴 표정 분석 및 랜드마크 감지
  useEffect(() => {
    if (!isFaceApiReady || !isTensorflowReady || !videoRef.current) return;
    
    const detectFace = async () => {
      if (!videoRef.current || isDetecting) {
        requestRef.current = requestAnimationFrame(detectFace);
        return;
      }
      
      setIsDetecting(true);
      
      try {
        // 1. face-api.js로 표정 분석 (항상 사용)
        let faceApiSmileScore = 0;
        try {
          const detections = await faceapi.detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceExpressions();
          
          if (detections && detections.length > 0) {
            const detection = detections[0];
            // 웃음 점수 계산
            faceApiSmileScore = calculateSmileStrength(detection.expressions);
          }
        } catch (faceApiError) {
          console.error('face-api.js 감지 오류:', faceApiError);
        }
        
        // 2. FaceMesh로 랜드마크 감지 (선택적 사용)
        let faceMeshSmileScore = 0;
        let landmarks = null;
        
        // FaceMesh가 활성화된 경우만 시도
        if (window.USE_FACEMESH && detector) {
          try {
            // faceMesh 감지 오류 중단: faceMeshError 오류가 반복될 경우 잠시 건너뜀
            const currentTime = Date.now();
            if (!window.lastFaceMeshErrorTime || currentTime - window.lastFaceMeshErrorTime > 5000) {
              // 비디오 요소를 정확하게 전달
              const videoElement = videoRef.current as unknown as HTMLVideoElement;
              
              // 비디오 준비 상태 확인
              if (!isVideoReady(videoElement)) {
                console.warn('비디오가 준비되지 않았습니다. readyState:', videoElement?.readyState);
                throw new Error('Video not ready');
              }
              
              // FaceMesh 감지 전 detector 유효성 확인
              if (!detector || typeof detector.estimateFaces !== 'function') {
                console.error('detector가 유효하지 않습니다:', detector);
                throw new Error('Invalid detector');
              }
              
              console.log('FaceMesh 분석 시작, videoElement:', videoElement?.readyState);
              
              // FaceMesh 감지 시도 (5초 이상 간격)
              const faces = await detector.estimateFaces(videoElement);
              
              if (faces && faces.length > 0) {
                const face = faces[0];
                landmarks = face.keypoints;
                if (landmarks) {
                  setFaceLandmarks(landmarks);
                  
                  // 입 비율 기반 웃음 점수 계산
                  faceMeshSmileScore = calculateMouthSmileStrength(landmarks);
                } else {
                  setFaceLandmarks(null);
                }
              } else {
                setFaceLandmarks(null);
              }
            }
          } catch (faceMeshError) {
            // 오류 시간 기록
            if (typeof window !== 'undefined') {
              window.lastFaceMeshErrorTime = Date.now();
            }
            console.error('FaceMesh 감지 오류:', faceMeshError);
            setFaceLandmarks(null);
          }
        }
        
        // 점수 계산: FaceMesh 활성화 여부에 따라 다르게 처리
        let combinedScore = faceApiSmileScore;
        
        // FaceMesh가 활성화되고 랜드마크가 감지된 경우에만 결합
        if (window.USE_FACEMESH && landmarks) {
          combinedScore = getCombinedSmileScore(faceApiSmileScore, faceMeshSmileScore);
        }
        
        // 부드러운 변화를 위해 보간
        setSmileStrength(prev => prev * 0.8 + combinedScore * 0.2);
        
      } catch (err) {
        console.error('얼굴 감지 오류:', err);
      } finally {
        setIsDetecting(false);
        
        // 500ms 간격으로 분석 수행 (간격 늘림)
        setTimeout(() => {
          requestRef.current = requestAnimationFrame(detectFace);
        }, 500);
      }
    };
    
    // Window 전역 객체에 변수 추가
    if (typeof window !== 'undefined') {
      window.lastFaceMeshErrorTime = 0;
    }
    
    requestRef.current = requestAnimationFrame(detectFace);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isFaceApiReady, isTensorflowReady, detector, isDetecting]);
  
  // 표정 상태 메시지 및 이모지 선택
  const getSmileStatus = (score: number) => {
    if (score > 0.8) return { emoji: '😄', text: '활짝 웃는 중' };
    if (score > 0.5) return { emoji: '🙂', text: '미소 짓는 중' };
    if (score > 0.3) return { emoji: '😐', text: '옅은 미소' };
    if (score > 0.1) return { emoji: '😑', text: '무표정에 가까움' };
    if (score === 0) return { emoji: '😶', text: '무표정' };
    if (score > -0.3) return { emoji: '😕', text: '살짝 불편한 표정' };
    if (score > -0.6) return { emoji: '😠', text: '화난 표정' };
    return { emoji: '😡', text: '매우 화난 표정' };
  };

  const smileStatus = getSmileStatus(smileStrength);
  
  // 오류 표시
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[400px] text-white">
        <div className="bg-red-500/30 p-6 rounded-lg max-w-md border border-red-500">
          <p className="text-white font-bold text-xl mb-2">오류 발생</p>
          <p className="text-white text-lg">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`relative overflow-hidden flex justify-center ${className || ''}`}>
      {/* 웹캠 비디오 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      
      {/* 보정 효과 적용 캔버스 */}
      {isFaceApiReady && isTensorflowReady && (
        <SmileCanvas
          videoRef={videoRef}
          smileStrength={smileStrength}
          landmarks={faceLandmarks}
          showDebug={showDebug}
        />
      )}
      
      {/* 카메라 로딩 중 표시 */}
      {!isCameraReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center bg-gray-800/80 p-6 rounded-lg shadow-xl">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-xl font-bold">카메라 권한 요청 중...</p>
            <p className="text-white mt-2">카메라 접근을 허용해주세요</p>
          </div>
        </div>
      )}
      
      {/* 모델 로딩 중 표시 */}
      {isCameraReady && (!isFaceApiReady || !isTensorflowReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center bg-gray-800/80 p-6 rounded-lg shadow-xl">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-xl font-bold">AI 모델 초기화 중...</p>
            <p className="text-white mt-2">잠시만 기다려주세요</p>
          </div>
        </div>
      )}
      
      {/* 디버그 토글 버튼 - 작고 거의 투명하게 */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="absolute bottom-4 right-4 bg-black/20 hover:bg-black/40 text-white/60 hover:text-white/90 text-xs px-2 py-1 rounded-lg font-medium transition-colors z-20"
      >
        {showDebug ? '디버그 끄기' : '디버그 켜기'}
      </button>
      
      {/* 상태 표시 - 최소화되고 반투명하게 */}
      {Math.abs(smileStrength) > 0.1 && (
        <div className="absolute bottom-4 left-4 bg-black/20 backdrop-blur-sm px-2 py-1 rounded-lg z-10 transition-opacity duration-300">
          <div className="flex items-center">
            <span className="text-white/80 text-xl mr-1">{smileStatus.emoji}</span>
            <span className={`text-xs font-medium ${smileStrength >= 0 ? 'text-blue-300/80' : 'text-red-300/80'}`}>
              {smileStrength >= 0 
                ? `+${Math.round(smileStrength * 100)}%` 
                : `${Math.round(smileStrength * 100)}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmileFilter; 