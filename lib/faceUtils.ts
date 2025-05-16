import * as tf from '@tensorflow/tfjs';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

// 전역 상태 추적 - 싱글톤 패턴 도입
let detector: any = null;

// Window 인터페이스 확장
declare global {
  interface Window {
    tf: typeof tf;
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

// 캔버스 willReadFrequently 속성을 설정하는 함수
const patchCanvas = () => {
  if (typeof window !== 'undefined' && window.HTMLCanvasElement) {
    // 원본 getContext 메소드를 직접 수정하지 않고 메서드를 교체함
    const createCustomGetContext = (element: HTMLCanvasElement) => {
      const originalGetContext = element.getContext.bind(element);
      
      return function(contextId: string, contextAttributes?: any) {
        if (contextId === '2d') {
          const newContextAttributes = {
            ...(contextAttributes || {}),
            willReadFrequently: true
          };
          return originalGetContext(contextId, newContextAttributes);
        }
        return originalGetContext(contextId, contextAttributes);
      };
    };
    
    // 함수를 바로 적용하는 대신 생성시에만 적용하는 Observer 생성
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes) {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLCanvasElement) {
              // @ts-ignore - 타입 오류 무시하고 교체
              node.getContext = createCustomGetContext(node);
            }
          });
        }
      });
    });
    
    // 문서에 새로 추가되는 캔버스 요소 감시
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    
    console.log('캔버스 감시 옵저버 설정 완료: willReadFrequently=true');
  }
};

// 얼굴 랜드마크 인덱스 (MediaPipe FaceMesh)
export const FACE_LANDMARKS = {
  // 입 랜드마크 (더 많은 포인트 추가)
  LEFT_MOUTH_CORNER: 61,   // 왼쪽 입꼬리
  RIGHT_MOUTH_CORNER: 291, // 오른쪽 입꼬리
  UPPER_LIP_TOP: 13,       // 윗입술 중앙 상단
  LOWER_LIP_BOTTOM: 14,    // 아랫입술 중앙 하단
  UPPER_LIP_CENTER: 0,     // 윗입술 중앙
  LOWER_LIP_CENTER: 17,    // 아랫입술 중앙
  
  // 입 내부 측정용 추가 포인트
  MOUTH_LEFT: 78,    // 입 왼쪽 안쪽
  MOUTH_RIGHT: 308,  // 입 오른쪽 안쪽
  MOUTH_TOP: 12,     // 입 위쪽 안쪽
  MOUTH_BOTTOM: 15,  // 입 아래쪽 안쪽
  
  // 입 꼬리 주변 추가 포인트 (웃음 주름 감지)
  LEFT_MOUTH_OUTER: 91,   // 왼쪽 입 외곽
  RIGHT_MOUTH_OUTER: 321, // 오른쪽 입 외곽
  LEFT_CHEEK_LOWER: 202,  // 왼쪽 볼 아래
  RIGHT_CHEEK_LOWER: 422, // 오른쪽 볼 아래
  
  // 눈 랜드마크
  LEFT_EYE_OUTER: 243,    // 왼쪽 눈 외측
  LEFT_EYE_INNER: 133,    // 왼쪽 눈 내측
  RIGHT_EYE_OUTER: 463,   // 오른쪽 눈 외측
  RIGHT_EYE_INNER: 362,   // 오른쪽 눈 내측
  LEFT_EYE_BOTTOM: 145,   // 왼쪽 눈 아래
  RIGHT_EYE_BOTTOM: 374,  // 오른쪽 눈 아래
  LEFT_EYE_TOP: 159,      // 왼쪽 눈 위쪽 (추가됨)
  RIGHT_EYE_TOP: 386,     // 오른쪽 눈 위쪽 (추가됨)
  
  // 눈썹 랜드마크 (부정적 감정 감지에 사용)
  LEFT_EYEBROW_OUTER: 70,     // 왼쪽 눈썹 바깥쪽
  LEFT_EYEBROW_INNER: 63,     // 왼쪽 눈썹 안쪽
  RIGHT_EYEBROW_OUTER: 300,   // 오른쪽 눈썹 바깥쪽
  RIGHT_EYEBROW_INNER: 293,   // 오른쪽 눈썹 안쪽
  LEFT_EYEBROW_MID: 105,      // 왼쪽 눈썹 중앙 (추가됨)
  RIGHT_EYEBROW_MID: 334,     // 오른쪽 눈썹 중앙 (추가됨)
  
  // 볼과 턱 랜드마크 (미소 측정에 도움)
  LEFT_CHEEK: 205,
  RIGHT_CHEEK: 425,
  CHIN_BOTTOM: 152,
  NOSE_TIP: 1,
  FOREHEAD_CENTER: 151,
  MIDPOINT_BETWEEN_EYEBROWS: 168  // 미간 중심 (추가됨)
};

// TensorFlow.js 및 FaceMesh 모델 로드
export const loadTensorflowModels = async () => {
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
    const tfConfig = {
      runtime: 'tfjs',
      refineLandmarks: false,
      modelType: 'lite',
      maxFaces: 1,
      enableSmoothing: true
    } as any;
    
    detector = await faceLandmarksDetection.createDetector(model, tfConfig);
    return detector;
  } catch (error) {
    console.error('모델 초기화 실패:', error);
    return null;
  }
};

// 얼굴 표정 분석용 임시 함수 (Face-API.js 대체)
export const loadFaceApiModels = async (): Promise<boolean> => {
  return true; // 항상 성공으로 처리
};

// 감정 타입 정의
export interface FaceExpressions {
  neutral: number;   // 무표정
  happy: number;     // 행복
  sad: number;       // 슬픔
  angry: number;     // 화남
  surprised: number; // 놀람
  disgusted: number; // 역겨움
  fearful: number;   // 두려움
}

// 주요 감정 타입
export type MainExpression = keyof FaceExpressions;

// 두 점 사이의 거리 계산
export const calculateDistance = (
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number => {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
  );
};

// 벡터 계산 유틸리티 함수들
export const calculateVector = (
  start: { x: number; y: number },
  end: { x: number; y: number }
): { dx: number; dy: number } => {
  return {
    dx: end.x - start.x,
    dy: end.y - start.y
  };
};

// 벡터 각도 계산 (라디안)
export const calculateVectorAngle = (vector: { dx: number; dy: number }): number => {
  return Math.atan2(vector.dy, vector.dx);
};

// 벡터 각도 계산 (도)
export const calculateVectorAngleDegrees = (vector: { dx: number; dy: number }): number => {
  return Math.atan2(vector.dy, vector.dx) * (180 / Math.PI);
};

// 벡터 크기 계산
export const calculateVectorMagnitude = (vector: { dx: number; dy: number }): number => {
  return Math.sqrt(vector.dx * vector.dx + vector.dy * vector.dy);
};

// 얼굴 정규화 (Face Normalization) 함수
export const normalizeFaceLandmarks = (
  landmarks: faceLandmarksDetection.Keypoint[]
): faceLandmarksDetection.Keypoint[] => {
  if (!landmarks || landmarks.length < 468) {
    return landmarks;
  }
  
  try {
    // 1. 얼굴 중심점 계산 (눈과 코의 중심)
    const leftEye = landmarks[FACE_LANDMARKS.LEFT_EYE_INNER];
    const rightEye = landmarks[FACE_LANDMARKS.RIGHT_EYE_INNER];
    const nose = landmarks[FACE_LANDMARKS.NOSE_TIP];
    
    if (!leftEye || !rightEye || !nose) {
      return landmarks;
    }
    
    const faceCenter = {
      x: (leftEye.x + rightEye.x + nose.x) / 3,
      y: (leftEye.y + rightEye.y + nose.y) / 3
    };
    
    // 2. 스케일 계산 (양쪽 눈 사이 거리 기준)
    const eyeDistance = calculateDistance(leftEye, rightEye);
    const scale = eyeDistance;
    
    // 3. 모든 랜드마크를 정규화
    return landmarks.map(point => {
      if (!point) return point;
      
      return {
        x: (point.x - faceCenter.x) / scale,
        y: (point.y - faceCenter.y) / scale,
        z: point.z // z값이 있는 경우 유지
      };
    });
  } catch (error) {
    console.error('얼굴 정규화 오류:', error);
    return landmarks;
  }
};

// 표정별 주요 랜드마크 클러스터 정의
const EXPRESSION_CLUSTERS = {
  SMILE: [
    FACE_LANDMARKS.LEFT_MOUTH_CORNER,
    FACE_LANDMARKS.RIGHT_MOUTH_CORNER,
    FACE_LANDMARKS.UPPER_LIP_TOP,
    FACE_LANDMARKS.MOUTH_LEFT,
    FACE_LANDMARKS.MOUTH_RIGHT
  ],
  ANGRY: [
    FACE_LANDMARKS.LEFT_EYEBROW_OUTER,
    FACE_LANDMARKS.LEFT_EYEBROW_INNER,
    FACE_LANDMARKS.RIGHT_EYEBROW_OUTER,
    FACE_LANDMARKS.RIGHT_EYEBROW_INNER,
    FACE_LANDMARKS.LEFT_EYEBROW_MID,
    FACE_LANDMARKS.RIGHT_EYEBROW_MID,
    FACE_LANDMARKS.MIDPOINT_BETWEEN_EYEBROWS
  ],
  SAD: [
    FACE_LANDMARKS.LEFT_MOUTH_CORNER,
    FACE_LANDMARKS.RIGHT_MOUTH_CORNER,
    FACE_LANDMARKS.LEFT_EYE_BOTTOM,
    FACE_LANDMARKS.RIGHT_EYE_BOTTOM,
    FACE_LANDMARKS.MIDPOINT_BETWEEN_EYEBROWS
  ]
};

// 정규화된 벡터 기반 웃음 점수 계산
const calculateSmileVectorScore = (
  normalizedLandmarks: faceLandmarksDetection.Keypoint[]
): number => {
  // 입술 중앙을 기준점으로 설정
  const centerLip = normalizedLandmarks[FACE_LANDMARKS.UPPER_LIP_TOP];
  
  // 양쪽 입꼬리 포인트
  const leftCorner = normalizedLandmarks[FACE_LANDMARKS.LEFT_MOUTH_CORNER];
  const rightCorner = normalizedLandmarks[FACE_LANDMARKS.RIGHT_MOUTH_CORNER];
  
  if (!centerLip || !leftCorner || !rightCorner) {
    return 0;
  }
  
  // 왼쪽 입꼬리 벡터
  const leftVector = calculateVector(centerLip, leftCorner);
  // 오른쪽 입꼬리 벡터
  const rightVector = calculateVector(centerLip, rightCorner);
  
  // 벡터 각도 계산 (웃을 때는 왼쪽은 2사분면, 오른쪽은 1사분면 각도를 가짐)
  const leftAngle = calculateVectorAngleDegrees(leftVector);
  const rightAngle = calculateVectorAngleDegrees(rightVector);
  
  // 웃음의 경우 왼쪽은 약 135도, 오른쪽은 약 45도 방향으로 입꼬리가 올라감
  // 슬픔의 경우 왼쪽은 약 -135도, 오른쪽은 약 -45도 방향으로 내려감
  
  // 입꼬리 올라감/내려감 정도 계산 (-1 ~ +1)
  const leftLift = -leftVector.dy; // 올라가면 dy가 음수, 내려가면 양수
  const rightLift = -rightVector.dy;
  
  // 두 입꼬리 평균 들림 정도
  const avgLift = (leftLift + rightLift) / 2;
  
  // 입 대칭성 점수 (0~1, 1이 완벽한 대칭)
  const symmetry = 1 - Math.abs(leftLift - rightLift) / Math.max(Math.abs(leftLift), Math.abs(rightLift), 0.001);
  
  // 대칭성 가중치 적용 (대칭적일수록 자연스러운 웃음/슬픔)
  const symmetryWeight = 0.7 + 0.3 * symmetry;
  
  // 정규화 범위: 경험적으로 정한 웃음과 슬픔의 벡터 범위
  const normalizeSmile = (value: number): number => {
    // 웃음은 입꼬리가 올라가므로 양수값
    if (value > 0) {
      return Math.min(1, Math.max(0, value / 0.25)); // 0.25를 최대 웃음으로
    } 
    // 슬픔은 입꼬리가 내려가므로 음수값
    else {
      return Math.max(-1, Math.min(0, value / 0.20)); // -0.2를 최대 슬픔으로
    }
  };
  
  return normalizeSmile(avgLift) * symmetryWeight;
};

// 정규화된 벡터 기반 화남 점수 계산
const calculateAngryVectorScore = (
  normalizedLandmarks: faceLandmarksDetection.Keypoint[]
): number => {
  // 미간 중심
  const midBrows = normalizedLandmarks[FACE_LANDMARKS.MIDPOINT_BETWEEN_EYEBROWS];
  
  // 양쪽 눈썹
  const leftBrowMid = normalizedLandmarks[FACE_LANDMARKS.LEFT_EYEBROW_MID];
  const rightBrowMid = normalizedLandmarks[FACE_LANDMARKS.RIGHT_EYEBROW_MID];
  const leftBrowInner = normalizedLandmarks[FACE_LANDMARKS.LEFT_EYEBROW_INNER];
  const rightBrowInner = normalizedLandmarks[FACE_LANDMARKS.RIGHT_EYEBROW_INNER];
  
  if (!midBrows || !leftBrowMid || !rightBrowMid || !leftBrowInner || !rightBrowInner) {
    return 0;
  }
  
  // 눈썹 기울기 벡터 계산
  const leftBrowVector = calculateVector(leftBrowMid, leftBrowInner);
  const rightBrowVector = calculateVector(rightBrowInner, rightBrowMid);
  
  // 눈썹 기울기 각도 (도)
  const leftBrowAngle = calculateVectorAngleDegrees(leftBrowVector);
  const rightBrowAngle = calculateVectorAngleDegrees(rightBrowVector);
  
  // 화남 = 눈썹 안쪽이 내려감 + 미간 주름
  // 기울기가 음수이면 화남, 양수이면 놀람/행복
  const leftBrowSlope = leftBrowVector.dy;
  const rightBrowSlope = rightBrowVector.dy;
  
  // 두 눈썹 기울기 평균 (양수면 상승, 음수면 하강)
  const avgBrowSlope = (leftBrowSlope + rightBrowSlope) / 2;
  
  // 화남 점수 계산 (눈썹이 내려갈수록 화남, -1~0 범위)
  const normalizeAnger = (value: number): number => {
    // 눈썹이 내려갈 때만 화남으로 간주
    if (value > 0) return 0;
    
    // -0.15를 최대 화남으로 정규화 (0.15 → 0.1로 변경하여 더 민감하게)
    return Math.max(-1, Math.min(0, value / 0.1));
  };
  
  return normalizeAnger(avgBrowSlope);
};

// 정규화된 벡터 기반 슬픔 점수 계산
const calculateSadVectorScore = (
  normalizedLandmarks: faceLandmarksDetection.Keypoint[]
): number => {
  // 이미 웃음 점수 계산에서 입꼬리 처짐을 계산했으므로, 
  // 여기서는 눈과 눈썹 사이의 거리를 추가로 계산
  
  const leftEyeBrow = normalizedLandmarks[FACE_LANDMARKS.LEFT_EYEBROW_MID];
  const rightEyeBrow = normalizedLandmarks[FACE_LANDMARKS.RIGHT_EYEBROW_MID];
  const leftEye = normalizedLandmarks[FACE_LANDMARKS.LEFT_EYE_TOP];
  const rightEye = normalizedLandmarks[FACE_LANDMARKS.RIGHT_EYE_TOP];
  
  if (!leftEyeBrow || !rightEyeBrow || !leftEye || !rightEye) {
    return 0;
  }
  
  // 입 꼬리 분석 (입꼬리가 내려갔는지 확인)
  const leftMouth = normalizedLandmarks[FACE_LANDMARKS.LEFT_MOUTH_CORNER];
  const rightMouth = normalizedLandmarks[FACE_LANDMARKS.RIGHT_MOUTH_CORNER];
  const upperLip = normalizedLandmarks[FACE_LANDMARKS.UPPER_LIP_TOP];
  
  if (!leftMouth || !rightMouth || !upperLip) {
    return 0;
  }
  
  // 입꼬리 벡터
  const leftMouthVector = calculateVector(upperLip, leftMouth);
  const rightMouthVector = calculateVector(upperLip, rightMouth);
  
  // 입꼬리 방향 (음수면 내려감, 양수면 올라감)
  const leftLift = -leftMouthVector.dy;
  const rightLift = -rightMouthVector.dy;
  const avgMouthLift = (leftLift + rightLift) / 2;
  
  // 입꼬리가 올라가 있으면 슬픔이 아님
  if (avgMouthLift > 0) {
    return 0;
  }
  
  // 눈과 눈썹 사이 거리 (이 값만으로는 슬픔을 판단하기 어려움)
  const leftEyeBrowDistance = calculateDistance(leftEyeBrow, leftEye);
  const rightEyeBrowDistance = calculateDistance(rightEyeBrow, rightEye);
  
  // 평균 눈-눈썹 거리
  const avgEyeBrowDistance = (leftEyeBrowDistance + rightEyeBrowDistance) / 2;
  
  // 기준값 (정규화된 좌표에서의 기준값, 높은 값 = 눈썹이 올라감)
  const baseEyeBrowDistance = 0.08; // 기준값 하향 조정 (0.1 → 0.08)
  
  // 거리 변화량
  const eyeBrowDistanceChange = avgEyeBrowDistance - baseEyeBrowDistance;
  
  // 입꼬리 처짐에 더 큰 가중치를 주고, 눈썹-눈 거리는 보조 지표로 사용
  // 입꼬리가 내려가고, 눈썹-눈 거리가 증가하면 슬픔 점수 증가
  const mouthWeight = 0.8;
  const eyebrowWeight = 0.2;
  
  // 입꼬리 처짐 정도 정규화 (-0.15 정도가 확실한 슬픔)
  const normalizedMouthSad = Math.max(-1, Math.min(0, avgMouthLift / 0.1)); // 임계값 하향 조정 (0.15 → 0.1)
  
  // 눈썹 위치 정규화 (양수 = 눈썹이 올라감 = 슬픔이 아님)
  const normalizedEyebrowSad = eyeBrowDistanceChange > 0 ? 0 : 
                              Math.max(-1, Math.min(0, eyeBrowDistanceChange / 0.04)); // 임계값 하향 조정 (0.05 → 0.04)
  
  // 종합 슬픔 점수 (-1 ~ 0 범위, 0이 슬픔 아님)
  const sadScore = normalizedMouthSad * mouthWeight + normalizedEyebrowSad * eyebrowWeight;
  
  // -0.8 이하로 제한 (슬픔의 최대 강도 증가, -0.7 → -0.8)
  return Math.max(-0.8, sadScore);
};

// face-api.js 스타일 감정 분석 함수
export const detectExpressions = (
  landmarks: faceLandmarksDetection.Keypoint[] | null
): FaceExpressions => {
  // 기본값 - 모든 감정 0으로 초기화
  const expressions: FaceExpressions = {
    neutral: 0,
    happy: 0, 
    sad: 0,
    angry: 0,
    surprised: 0,
    disgusted: 0,
    fearful: 0
  };
  
  if (!landmarks || landmarks.length < 468) {
    // 랜드마크가 없으면 중립(neutral) 감정 100%
    expressions.neutral = 1.0;
    return expressions;
  }
  
  try {
    // 랜드마크 정규화 (얼굴 크기, 위치 차이 제거)
    const normalizedLandmarks = normalizeFaceLandmarks(landmarks);
    
    // 필요한 얼굴 랜드마크 추출
    // 입 관련 랜드마크
    const leftMouthCorner = landmarks[FACE_LANDMARKS.LEFT_MOUTH_CORNER];
    const rightMouthCorner = landmarks[FACE_LANDMARKS.RIGHT_MOUTH_CORNER];
    const upperLipTop = landmarks[FACE_LANDMARKS.UPPER_LIP_TOP];
    const lowerLipBottom = landmarks[FACE_LANDMARKS.LOWER_LIP_BOTTOM];
    const mouthLeft = landmarks[FACE_LANDMARKS.MOUTH_LEFT];
    const mouthRight = landmarks[FACE_LANDMARKS.MOUTH_RIGHT]; 
    const mouthTop = landmarks[FACE_LANDMARKS.MOUTH_TOP];
    const mouthBottom = landmarks[FACE_LANDMARKS.MOUTH_BOTTOM];
    
    // 볼과 입 꼬리 관련 추가 랜드마크
    const leftMouthOuter = landmarks[FACE_LANDMARKS.LEFT_MOUTH_OUTER];
    const rightMouthOuter = landmarks[FACE_LANDMARKS.RIGHT_MOUTH_OUTER];
    const leftCheekLower = landmarks[FACE_LANDMARKS.LEFT_CHEEK_LOWER];
    const rightCheekLower = landmarks[FACE_LANDMARKS.RIGHT_CHEEK_LOWER];
    const leftCheek = landmarks[FACE_LANDMARKS.LEFT_CHEEK];
    const rightCheek = landmarks[FACE_LANDMARKS.RIGHT_CHEEK];
    
    // 눈 관련 랜드마크
    const leftEyeOuter = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];
    const leftEyeInner = landmarks[FACE_LANDMARKS.LEFT_EYE_INNER];
    const rightEyeOuter = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];
    const rightEyeInner = landmarks[FACE_LANDMARKS.RIGHT_EYE_INNER];
    const leftEyeBottom = landmarks[FACE_LANDMARKS.LEFT_EYE_BOTTOM];
    const rightEyeBottom = landmarks[FACE_LANDMARKS.RIGHT_EYE_BOTTOM];
    
    // 눈썹 랜드마크
    const leftEyebrowOuter = landmarks[FACE_LANDMARKS.LEFT_EYEBROW_OUTER];
    const leftEyebrowInner = landmarks[FACE_LANDMARKS.LEFT_EYEBROW_INNER];
    const rightEyebrowOuter = landmarks[FACE_LANDMARKS.RIGHT_EYEBROW_OUTER];
    const rightEyebrowInner = landmarks[FACE_LANDMARKS.RIGHT_EYEBROW_INNER];
    
    // 기타 얼굴 랜드마크
    const noseTip = landmarks[FACE_LANDMARKS.NOSE_TIP];
    const chinBottom = landmarks[FACE_LANDMARKS.CHIN_BOTTOM];
    const foreheadCenter = landmarks[FACE_LANDMARKS.FOREHEAD_CENTER];
    
    // 랜드마크가 유효한지 확인 (필수 랜드마크만 체크)
    if (!leftMouthCorner || !rightMouthCorner || !upperLipTop || !lowerLipBottom ||
        !mouthLeft || !mouthRight || !mouthTop || !mouthBottom ||
        !leftCheek || !rightCheek || !noseTip) {
      // 필수 랜드마크가 없으면 중립(neutral) 감정 100%
      expressions.neutral = 1.0;
      return expressions;
    }
    
    // ====== 1. 다양한 얼굴 측정치 계산 ======
    
    // 얼굴 기준 좌표 설정 (코 끝을 중심으로)
    // 얼굴의 세로 길이 (이마 중앙부터 턱 끝까지)
    const faceHeight = foreheadCenter && chinBottom ? 
                       calculateDistance(foreheadCenter, chinBottom) : 
                       calculateDistance(noseTip, chinBottom) * 2.5;
    
    // 얼굴 가로 길이 (대략적으로 양쪽 눈 바깥쪽 거리의 1.5배)
    const faceWidth = leftEyeOuter && rightEyeOuter ? 
                      calculateDistance(leftEyeOuter, rightEyeOuter) * 1.5 : 
                      calculateDistance(leftCheek, rightCheek) * 1.2;
    
    // 기준값 설정 - 얼굴 크기에 비례하도록
    const faceSizeNormalizer = Math.sqrt(faceWidth * faceHeight) / 200; // 200은 기준 얼굴 크기
    
    // ----- 입 측정 -----
    // 외부 입 가로/세로 길이
    const mouthOuterWidth = calculateDistance(leftMouthCorner, rightMouthCorner);
    const mouthOuterHeight = calculateDistance(upperLipTop, lowerLipBottom);
    
    // 내부 입 가로/세로 길이
    const mouthInnerWidth = calculateDistance(mouthLeft, mouthRight);
    const mouthInnerHeight = calculateDistance(mouthTop, mouthBottom);
    
    // 입 내부 영역
    const innerMouthArea = mouthInnerWidth * mouthInnerHeight;
    
    // 입 비율 계산
    const mouthWidthRatio = mouthInnerWidth / mouthOuterWidth;
    const mouthHeightRatio = mouthInnerHeight / Math.max(mouthOuterHeight, 5.0 * faceSizeNormalizer);
    const outerAspectRatio = mouthOuterWidth / Math.max(mouthOuterHeight, 5.0 * faceSizeNormalizer);
    
    // ----- 입 꼬리 측정 (웃음 감지에 중요) -----
    // 입 꼬리의 상대적 높이 측정 (볼에 대해)
    const leftMouthCornerHeight = leftCheekLower ? (leftCheekLower.y - leftMouthCorner.y) : 0;
    const rightMouthCornerHeight = rightCheekLower ? (rightCheekLower.y - rightMouthCorner.y) : 0;
    
    // 양쪽 입 꼬리 높이의 평균 (양수면 웃는 표정, 음수면 슬픈 표정)
    const mouthCornerLift = (leftMouthCornerHeight + rightMouthCornerHeight) / 2;
    
    // 입 꼬리가 올라간 정도 (웃음) - 얼굴 크기에 대한 비율로 정규화
    const mouthCornerLiftRatio = mouthCornerLift / (faceHeight * 0.1); // 얼굴 높이의 10%를 기준으로 정규화
    
    // 추가: 입 모양의 비대칭 감지 (스마일 불균형)
    const mouthAsymmetry = Math.abs(leftMouthCornerHeight - rightMouthCornerHeight) / 
                           Math.max(Math.abs(leftMouthCornerHeight), Math.abs(rightMouthCornerHeight), 1);
    
    // 비대칭이 크면 웃음 강도 감소 (자연스러운 웃음은 대체로 대칭)
    const symmetryFactor = Math.max(0, 1 - mouthAsymmetry * 2);
    
    // ----- 눈 측정 (웃으면 눈이 작아짐) -----
    let eyeOpenRatio = 1.0;
    if (leftEyeOuter && leftEyeInner && leftEyeBottom && 
        rightEyeOuter && rightEyeInner && rightEyeBottom) {
      // 눈 가로 길이
      const leftEyeWidth = calculateDistance(leftEyeOuter, leftEyeInner);
      const rightEyeWidth = calculateDistance(rightEyeOuter, rightEyeInner);
      
      // 눈 세로 길이 계산 개선 - 눈의 중앙 상단점 추정하여 더 정확한 높이 계산
      const leftEyeTop = {
        x: (leftEyeOuter.x + leftEyeInner.x) / 2,
        y: Math.min(leftEyeOuter.y, leftEyeInner.y) - 2 // 위쪽으로 약간 조정
      };
      
      const rightEyeTop = {
        x: (rightEyeOuter.x + rightEyeInner.x) / 2,
        y: Math.min(rightEyeOuter.y, rightEyeInner.y) - 2 // 위쪽으로 약간 조정
      };
      
      const leftEyeHeight = calculateDistance(leftEyeTop, leftEyeBottom);
      const rightEyeHeight = calculateDistance(rightEyeTop, rightEyeBottom);
      
      // 눈 종횡비 (가로 대 세로 비율)
      const leftEyeAspect = leftEyeHeight / Math.max(leftEyeWidth, 0.1);
      const rightEyeAspect = rightEyeHeight / Math.max(rightEyeWidth, 0.1);
      
      // 웃을 때는 눈이 작아지므로, 눈의 개방 비율을 계산 (평균값 정규화)
      eyeOpenRatio = (leftEyeAspect + rightEyeAspect) / 2;
      
      // 일반적인 눈 비율 범위에 맞게 조정 (0.2~0.7 범위가 일반적)
      eyeOpenRatio = Math.max(0.2, Math.min(0.7, eyeOpenRatio));
    }
    
    // ----- 눈썹 측정 (슬픔/화남 감지) -----
    let eyebrowSlopeAvg = 0;
    if (leftEyebrowOuter && leftEyebrowInner && rightEyebrowOuter && rightEyebrowInner) {
      const leftEyebrowSlope = (leftEyebrowInner.y - leftEyebrowOuter.y);
      const rightEyebrowSlope = (rightEyebrowInner.y - rightEyebrowOuter.y);
      eyebrowSlopeAvg = (leftEyebrowSlope + rightEyebrowSlope) / 2;
    }
    
    // ====== 2. 종합적인 표정 특징 분석 로그 ======
    console.log(`얼굴 크기 - 가로: ${faceWidth.toFixed(1)}, 세로: ${faceHeight.toFixed(1)}, 정규화 계수: ${faceSizeNormalizer.toFixed(2)}`);
    console.log(`입 외부 - 가로: ${mouthOuterWidth.toFixed(1)}, 세로: ${mouthOuterHeight.toFixed(1)}, 비율: ${outerAspectRatio.toFixed(2)}`);
    console.log(`입 내부 - 가로: ${mouthInnerWidth.toFixed(1)}, 세로: ${mouthInnerHeight.toFixed(1)}, 영역: ${innerMouthArea.toFixed(1)}`);
    console.log(`입 꼬리 들림: ${mouthCornerLiftRatio.toFixed(2)}, 눈 개방도: ${eyeOpenRatio.toFixed(2)}, 눈썹 기울기: ${eyebrowSlopeAvg.toFixed(2)}`);
    
    // ====== 벡터 기반 감정 점수 계산 ======
    // 1. 벡터 기반 웃음 점수
    const vectorSmileScore = calculateSmileVectorScore(normalizedLandmarks);
    
    // 2. 벡터 기반 화남 점수
    const vectorAngryScore = calculateAngryVectorScore(normalizedLandmarks);
    
    // 3. 벡터 기반 슬픔 점수
    const vectorSadScore = calculateSadVectorScore(normalizedLandmarks);
    
    console.log(`벡터 기반 점수 - 웃음: ${vectorSmileScore.toFixed(2)}, 화남: ${vectorAngryScore.toFixed(2)}, 슬픔: ${vectorSadScore.toFixed(2)}`);
    
    // ====== 3. 종합적 웃음 점수 계산 (여러 특징의 가중 조합) ======
    
    // 1) 입 꼬리 들림 점수 (가장 중요한 지표)
    const cornerLiftScore = mouthCornerLiftRatio <= 0 ? 0 :
                           Math.max(0, Math.min(1, mouthCornerLiftRatio / 0.3));
    
    // 대칭 요소를 적용하여 자연스러운 웃음 감지 정확도 향상
    const adjustedCornerLiftScore = cornerLiftScore * symmetryFactor;
    
    // 2) 입 열림/내부 영역 점수
    const normalizedMouthArea = innerMouthArea / (faceSizeNormalizer * faceSizeNormalizer);
    const mouthAreaThreshold = 40; // 정규화된 입 영역의 최소 임계값
    const mouthAreaScore = Math.max(0, Math.min(1, (normalizedMouthArea - mouthAreaThreshold) / 80));
    
    // 3) 눈 변화 점수 (웃을 때 눈이 작아짐)
    const eyeScore = eyeOpenRatio >= 0.6 ? 0 : 
                    Math.max(0, Math.min(1, (0.6 - eyeOpenRatio) / 0.3));
    
    // 4) 입 비율 점수
    const optimalRatio = 8.0; // 웃는 입 모양의 이상적인 가로/세로 비율
    const ratioTolerance = 5.0; // 허용 오차
    const mouthRatioScore = Math.max(0, Math.min(1, 
      1.0 - Math.abs(outerAspectRatio - optimalRatio) / ratioTolerance
    ));
    
    // 각 점수에 가중치 적용하여 최종 웃음 점수 계산
    // 지오메트리 기반 (70%) + 벡터 기반 (30%)
    const geometrySmileScore = 
      adjustedCornerLiftScore * 0.7 + 
      mouthAreaScore * 0.2 + 
      eyeScore * 0.1;
    
    // 기하학적 분석과 벡터 기반 분석 결합
    const smileScore = geometrySmileScore * 0.7 + Math.max(0, vectorSmileScore) * 0.3;
    
    console.log(`입모양 대칭도: ${symmetryFactor.toFixed(2)}`);
    console.log(`세부 점수 - 입꼬리: ${adjustedCornerLiftScore.toFixed(2)} (원점수: ${cornerLiftScore.toFixed(2)}), 입영역: ${mouthAreaScore.toFixed(2)}, 눈변화: ${eyeScore.toFixed(2)}, 입비율: ${mouthRatioScore.toFixed(2)}`);
    console.log(`최종 웃음 점수: ${smileScore.toFixed(2)}`);
    
    // ====== 4. 감정 확률 계산 ======
    
    // 행복/웃음 확률
    if (vectorSmileScore > 0) {
      expressions.happy = Math.min(1.0, vectorSmileScore);
      
      // 낮은 점수는 감지하지 않음
      if (expressions.happy < 0.15) {
        expressions.happy = 0;
      }
    }
    
    // 화남 확률
    if (vectorAngryScore < 0) {
      expressions.angry = Math.min(1.0, Math.abs(vectorAngryScore));
      
      // 낮은 점수는 감지하지 않음 (0.2 → 0.12로 임계값 낮춤)
      if (expressions.angry < 0.12) {
        expressions.angry = 0;
      }
    }
    
    // 슬픔 확률
    if (vectorSadScore < 0) {
      expressions.sad = Math.min(1.0, Math.abs(vectorSadScore));
      
      // 낮은 점수는 감지하지 않음 (0.3 → 0.15로 임계값 낮춤)
      if (expressions.sad < 0.15) {
        expressions.sad = 0;
      }
    }
    
    // 무표정 감지 개선 (낮은 감정 점수는 무표정으로 처리)
    const neutralThreshold = 0.2; // 0.3 → 0.2로 임계값 낮춤
    
    // 5. 무표정(neutral) 확률 계산
    // 다른 감정들의 합이 높으면 무표정 확률은 낮아짐
    const otherEmotionsSum = expressions.happy + expressions.angry + expressions.sad +
                            expressions.surprised + expressions.disgusted + expressions.fearful;
    
    // 다른 감정들의 합이 1.0을 초과하지 않도록 조정
    const adjustedSum = Math.min(1.0, otherEmotionsSum);
    
    // 무표정 확률은 (1 - 다른 감정들의 합)
    expressions.neutral = 1.0 - adjustedSum;
    
    // 표정이 감지되지 않거나 매우 약한 경우 무표정으로 처리
    if (otherEmotionsSum < neutralThreshold || 
        (Math.max(expressions.happy, expressions.sad, expressions.angry) < neutralThreshold)) {
      // 무표정 확률 감소 (0.8 → 0.7)로 다른 감정이 더 쉽게 표현되도록 함
      expressions.neutral = Math.max(0.7, expressions.neutral);
      
      // 미세한 감정 표현은 유지 (완전히 0으로 만들지 않음)
      if (expressions.happy > 0.05) expressions.happy = Math.max(0.1, expressions.happy);
      else expressions.happy = 0;
      
      if (expressions.sad > 0.05) expressions.sad = Math.max(0.1, expressions.sad);
      else expressions.sad = 0;
      
      if (expressions.angry > 0.05) expressions.angry = Math.max(0.1, expressions.angry);
      else expressions.angry = 0;
    }
    
    // 6. 디버깅 로그
    console.log('감정 확률:', {
      neutral: expressions.neutral.toFixed(2),
      happy: expressions.happy.toFixed(2),
      sad: expressions.sad.toFixed(2),
      angry: expressions.angry.toFixed(2)
    });
    
    return expressions;
  } catch (error) {
    console.error('감정 분석 중 오류:', error);
    // 오류 발생 시 중립(neutral) 감정 100%
    expressions.neutral = 1.0;
    return expressions;
  }
};

// 주요 감정과 점수 계산 함수
export const getMainExpression = (expressions: FaceExpressions): [MainExpression, number] => {
  // 가장 높은 확률의 감정 찾기
  let mainExpression: MainExpression = 'neutral';
  let maxScore = expressions.neutral;
  
  // 각 감정별로 확인
  (Object.keys(expressions) as MainExpression[]).forEach(expression => {
    if (expressions[expression] > maxScore) {
      mainExpression = expression;
      maxScore = expressions[expression];
    }
  });
  
  return [mainExpression, maxScore];
};

// 감정에 기반한 웃음 점수 계산 (-1.0 ~ 1.0 범위)
export const calculateMouthSmileStrength = (
  landmarks: faceLandmarksDetection.Keypoint[] | null
): number => {
  // 감정 분석
  const expressions = detectExpressions(landmarks);
  const [mainExpression, score] = getMainExpression(expressions);
  
  // 감정에 따른 점수 변환
  let smileScore = 0;
  
  switch (mainExpression) {
    case 'happy':
      // 행복은 0 ~ 1 범위의 양수 (비선형 매핑으로 변화 폭 증가)
      // 점수가 0.5 이상일 때 급격히 증가하는 곡선 적용
      smileScore = score < 0.5 ? score * 0.6 : 0.3 + (score - 0.5) * 1.4;
      console.log(`행복 감정 감지: +${(smileScore * 100).toFixed(0)}%`);
      break;
    case 'angry':
      // 화남은 -1 ~ 0 범위의 음수 (비선형 매핑 적용)
      smileScore = -score * (0.8 + score * 0.4); // 점수 범위 확대 (0.7+0.3 → 0.8+0.4)
      console.log(`화남 감정 감지: ${(smileScore * 100).toFixed(0)}%`);
      break;
    case 'sad':
      // 슬픔은 -0.7 ~ 0 범위의 음수
      smileScore = -score * 0.9; // 슬픔의 강도 증가 (0.7 → 0.9)
      console.log(`슬픔 감정 감지: ${(smileScore * 100).toFixed(0)}%`);
      break;
    case 'disgusted':
    case 'fearful':
      // 기타 부정적 감정
      smileScore = -score * 0.5;
      console.log(`부정적 감정 감지: ${(smileScore * 100).toFixed(0)}%`);
      break;
    case 'surprised':
      // 놀람은 약간 긍정적 (0 ~ 0.3 범위)
      smileScore = score * 0.3;
      console.log(`놀람 감정 감지: +${(smileScore * 100).toFixed(0)}%`);
      break;
    case 'neutral':
    default:
      // 무표정은 -0.05 ~ 0.05 사이의 미세한 변동 추가 (자연스러운 느낌)
      const microVariation = (Math.random() - 0.5) * 0.1;
      smileScore = microVariation;
      console.log(`무표정 감지: ${(smileScore * 100).toFixed(0)}%`);
      break;
  }
  
  // 점수가 너무 작으면 0으로 조정 (±5% 미만은 0으로 처리)
  if (Math.abs(smileScore) < 0.05) {
    smileScore = 0;
    console.log(`점수가 너무 작아 무표정(0%)으로 조정`);
  } else {
    // 미세 점수 강화 - 약한 감정도 더 분명하게 표현
    if (smileScore > 0 && smileScore < 0.1) {
      smileScore = 0.1 + (smileScore * 0.5); // 약한 긍정 감정 강화
    } else if (smileScore < 0 && smileScore > -0.1) {
      smileScore = -0.1 + (smileScore * 0.5); // 약한 부정 감정 강화
    }
  }
  
  console.log(`최종 감정 점수: ${(smileScore * 100).toFixed(0)}%`);
  
  return smileScore;
};

// 결합된 점수 계산 (FaceMesh 점수를 그대로 사용)
export const getCombinedSmileScore = (
  faceMeshScore: number
): number => {
  // .js 무시하고 FaceMesh 점수만 반환
  return faceMeshScore;
};

// 비디오 요소 준비 상태 확인 유틸리티 함수 추가
export const isVideoReady = (videoElement: HTMLVideoElement | null): boolean => {
  return !!videoElement && videoElement.readyState >= 2;
}; 