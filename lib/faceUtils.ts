import * as faceapi from 'face-api.js';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

// 전역 상태 추적 - 싱글톤 패턴 도입
let tfInitialized = false;
let detector: any = null;
let initializationPromise: Promise<any> | null = null;

// Window 인터페이스 확장
declare global {
  interface Window {
    tf: any;
    faceLandmarksDetection: any;
    tfjs_initialized: boolean;
  }
}

// TensorFlow 오류 경고 억제 함수
const suppressTFWarnings = () => {
  if (typeof window !== 'undefined' && !window.tfjs_initialized) {
    // console.warn 임시 저장
    const originalWarn = console.warn;
    
    // 경고 필터링 함수로 대체
    console.warn = (...args: any[]) => {
      // Platform node has already been set 경고 무시
      if (args.length > 0 && typeof args[0] === 'string' && 
          args[0].includes('Platform node has already been set')) {
        return;
      }
      originalWarn.apply(console, args);
    };
    
    // 초기화 플래그 설정
    window.tfjs_initialized = true;
  }
};

// 얼굴 랜드마크 인덱스 (MediaPipe)
export const FACE_LANDMARKS = {
  LEFT_EYE_INDICES: [
    // 왼쪽 눈 윤곽 인덱스 (대략적인 범위)
    33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7
  ],
  RIGHT_EYE_INDICES: [
    // 오른쪽 눈 윤곽 인덱스 (대략적인 범위)
    263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249
  ],
  LEFT_MOUTH_CORNER: 61,
  RIGHT_MOUTH_CORNER: 291,
  UPPER_LIP: 13,
  LOWER_LIP: 14
};

// face-api.js 모델 로드
export const loadFaceApiModels = async () => {
  try {
    console.log('face-api.js 모델 로드 중...');
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/models');
    console.log('face-api.js 모델 로드 완료');
    return true;
  } catch (error) {
    console.error('face-api.js 모델 로드 실패:', error);
    return false;
  }
};

// TensorFlow.js 및 FaceMesh 모델 로드 - 싱글톤 패턴 적용
export const loadTensorflowModels = async () => {
  // 경고 억제 함수 호출
  suppressTFWarnings();
  
  // 이미 초기화되고 detector가 준비되었으면 즉시 반환
  if (tfInitialized && detector) {
    console.log('기존 detector 반환, 함수 존재 여부:', typeof detector.estimateFaces === 'function');
    return detector;
  }
  
  // 이미 초기화 중이면 해당 Promise 반환
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // 새로운 초기화 Promise 생성
  initializationPromise = (async () => {
    try {
      console.log('TensorFlow.js 초기화 시작...');
      
      // TensorFlow.js 임포트
      const tf = await import('@tensorflow/tfjs');
      
      if (typeof window !== 'undefined') {
        // 전역 객체에 할당
        window.tf = tf;
      }
      
      // 백엔드 설정 (아직 설정되지 않은 경우에만)
      if (!tf.getBackend()) {
        await tf.setBackend('webgl');
        console.log(`백엔드 설정: ${tf.getBackend()}`);
      }
      
      // 모듈 준비
      await tf.ready();
      
      // FaceMesh 모델 로드
      if (!detector) {
        try {
          console.log('FaceMesh 모델 로드 중...');
          
          detector = await faceLandmarksDetection.createDetector(
            faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
            {
              runtime: 'tfjs',
              maxFaces: 1,
              refineLandmarks: false
            }
          );
          
          if (!detector || typeof detector.estimateFaces !== 'function') {
            console.error('FaceMesh 모델이 올바르게 로드되지 않았습니다. detector:', detector);
            throw new Error('detector.estimateFaces is not a function');
          }
          
          console.log('FaceMesh 모델 로드 완료, detector:', detector);
          console.log('estimateFaces 함수 존재 여부:', typeof detector.estimateFaces === 'function');
        } catch (modelError) {
          console.error('FaceMesh 모델 로드 실패:', modelError);
          initializationPromise = null;
          return null;
        }
      }
      
      // 초기화 완료 플래그 설정
      tfInitialized = true;
      return detector;
    } catch (error) {
      console.error('TensorFlow.js 초기화 실패:', error);
      initializationPromise = null;
      return null;
    }
  })();
  
  return initializationPromise;
};

// face-api.js를 사용한 웃음 점수 계산
export const calculateSmileStrength = (
  expressions: faceapi.FaceExpressions | null
): number => {
  if (!expressions) return 0;
  
  // happy 표정 값 추출 (0-1 사이 값)
  const happyScore = expressions.happy;
  
  // angry와 sad 표정 값 추출 (0-1 사이 값)
  const angryScore = expressions.angry;
  const sadScore = expressions.sad;
  
  // 부정적 감정 점수 계산 (최대 -1까지)
  const negativeScore = Math.max(angryScore, sadScore);
  
  // 최종 점수: happy는 0~1, angry/sad는 -1~0 범위로 매핑
  if (happyScore > negativeScore) {
    return happyScore; // 0~1 사이 양수값
  } else if (negativeScore > 0.1) { // 임계값 적용
    return -negativeScore; // -1~0 사이 음수값
  }
  
  return 0; // 무표정이거나 다른 표정일 경우
};

// 두 점 사이의 거리 계산
export const calculateDistance = (
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number => {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
};

// 입 비율 기반 웃음 점수 계산
export const calculateMouthSmileStrength = (
  landmarks: faceLandmarksDetection.Keypoint[] | null
): number => {
  if (!landmarks) return 0;
  
  const leftMouthCorner = landmarks[FACE_LANDMARKS.LEFT_MOUTH_CORNER];
  const rightMouthCorner = landmarks[FACE_LANDMARKS.RIGHT_MOUTH_CORNER];
  const upperLip = landmarks[FACE_LANDMARKS.UPPER_LIP];
  const lowerLip = landmarks[FACE_LANDMARKS.LOWER_LIP];
  
  if (!leftMouthCorner || !rightMouthCorner || !upperLip || !lowerLip) return 0;
  
  // 입 가로 및 세로 길이 계산
  const mouthWidth = calculateDistance(leftMouthCorner, rightMouthCorner);
  const mouthHeight = calculateDistance(upperLip, lowerLip);
  
  // 비율 계산 (가로:세로)
  const smileRatio = mouthWidth / mouthHeight;
  
  // 정규화 (1.5~2.5 범위를 0~1로 변환)
  const minRatio = 1.5; // 무표정 평균
  const maxRatio = 2.5; // 활짝 웃을 때
  
  let calculatedScore = (smileRatio - minRatio) / (maxRatio - minRatio);
  calculatedScore = Math.max(0, Math.min(1, calculatedScore));
  
  return calculatedScore;
};

// 결합된 웃음 점수 계산 (face-api와 FaceMesh 결합)
export const getCombinedSmileScore = (
  faceApiScore: number,
  faceMeshScore: number
): number => {
  // 두 점수의 가중 평균 계산
  return faceApiScore * 0.7 + faceMeshScore * 0.3;
};

// 비디오 요소 준비 상태 확인 유틸리티 함수 추가
export const isVideoReady = (videoElement: HTMLVideoElement | null): boolean => {
  return !!videoElement && videoElement.readyState >= 2;
}; 