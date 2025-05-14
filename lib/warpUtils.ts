import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { FACE_LANDMARKS } from './faceUtils';

// 점의 바운딩 박스 계산
export const calculateBoundingBox = (
  points: faceLandmarksDetection.Keypoint[]
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} => {
  let minX = Number.MAX_VALUE;
  let minY = Number.MAX_VALUE;
  let maxX = Number.MIN_VALUE;
  let maxY = Number.MIN_VALUE;

  // 점들의 범위 계산
  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  // 바운딩 박스 주변에 여유 공간 추가 (20% 확장)
  const width = maxX - minX;
  const height = maxY - minY;
  
  const padding = Math.max(width, height) * 0.2;
  
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = maxX + padding;
  maxY = maxY + padding;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

// 눈 확대 효과 적용
export const applyEyeEnhancement = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  videoElement: HTMLVideoElement,
  landmarks: faceLandmarksDetection.Keypoint[],
  smileStrength: number,
  mirrorVideo: boolean = true
): void => {
  if (!landmarks || landmarks.length === 0) return;

  // 좌우반전이 적용된 경우 좌표 계산을 위한 함수
  const adjustX = (x: number): number => {
    return mirrorVideo ? canvasWidth - x : x;
  };

  // 왼쪽 눈과 오른쪽 눈 키포인트 추출
  const leftEyePoints = FACE_LANDMARKS.LEFT_EYE_INDICES.map(idx => {
    const point = landmarks[idx];
    return point ? { x: adjustX(point.x), y: point.y } : null;
  }).filter(point => point !== null) as faceLandmarksDetection.Keypoint[];

  const rightEyePoints = FACE_LANDMARKS.RIGHT_EYE_INDICES.map(idx => {
    const point = landmarks[idx];
    return point ? { x: adjustX(point.x), y: point.y } : null;
  }).filter(point => point !== null) as faceLandmarksDetection.Keypoint[];

  // 스케일 팩터 계산 (웃음에 따라 눈 크기 조정)
  const scaleFactor = 1 + smileStrength * 0.3; // 웃음이 클수록 눈 확대

  // 각 눈의 바운딩 박스 계산
  const leftEyeBBox = calculateBoundingBox(leftEyePoints);
  const rightEyeBBox = calculateBoundingBox(rightEyePoints);

  // 얼굴 상단 부분(텍스트 영역) 지우기
  try {
    // 얼굴 상단 영역 (눈보다 위쪽)
    const faceTopY = Math.min(leftEyeBBox.minY, rightEyeBBox.minY);
    if (faceTopY > 0) {
      // 머리 영역 계산
      const faceWidth = Math.max(leftEyeBBox.maxX, rightEyeBBox.maxX) - Math.min(leftEyeBBox.minX, rightEyeBBox.minX);
      const faceCenterX = (Math.min(leftEyeBBox.minX, rightEyeBBox.minX) + Math.max(leftEyeBBox.maxX, rightEyeBBox.maxX)) / 2;
      
      // 텍스트가 있는 영역 완전히 삭제하고 주변 픽셀로 채우기
      const textBoxWidth = faceWidth * 1.5;
      const textBoxHeight = 40; // 텍스트 영역 높이
      const textBoxX = faceCenterX - textBoxWidth / 2;
      const textBoxY = Math.max(0, faceTopY - 50); // 눈 위쪽에서 조금 더 위로 올라가서
      
      // 텍스트 영역을 주변 색상으로 채우기
      ctx.save();
      
      // 주변 영역에서 색상 샘플링 (텍스트 아래 영역)
      const samplingY = Math.min(canvasHeight - 1, Math.max(faceTopY + 30, textBoxY + textBoxHeight + 10));
      const samplingData = ctx.getImageData(
        Math.max(0, Math.floor(textBoxX + textBoxWidth/2 - 1)), 
        Math.floor(samplingY), 
        2, 
        2
      );
      
      // 샘플링된 색상 계산
      const sampleR = samplingData.data[0];
      const sampleG = samplingData.data[1];
      const sampleB = samplingData.data[2];
      
      // 텍스트 영역 색상으로 채우기
      ctx.fillStyle = `rgb(${sampleR}, ${sampleG}, ${sampleB})`;
      ctx.fillRect(
        Math.max(0, Math.floor(textBoxX)), 
        Math.max(0, Math.floor(textBoxY)), 
        Math.min(canvasWidth - Math.floor(textBoxX), Math.floor(textBoxWidth)), 
        Math.min(canvasHeight - Math.floor(textBoxY), Math.floor(textBoxHeight))
      );
      
      ctx.restore();
    }
  } catch (error) {
    console.error('텍스트 영역 처리 오류:', error);
  }

  // 왼쪽 눈 영역 확대 적용
  applyWarpToRegion(
    ctx,
    videoElement,
    leftEyeBBox,
    scaleFactor,
    mirrorVideo
  );

  // 오른쪽 눈 영역 확대 적용
  applyWarpToRegion(
    ctx,
    videoElement,
    rightEyeBBox,
    scaleFactor,
    mirrorVideo
  );
};

// 특정 영역에 워핑(확대) 효과 적용
export const applyWarpToRegion = (
  ctx: CanvasRenderingContext2D,
  videoElement: HTMLVideoElement,
  bbox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  },
  scaleFactor: number,
  mirrorVideo: boolean
): void => {
  try {
    // 좌표가 유효한지 확인
    if (isNaN(bbox.minX) || isNaN(bbox.minY) || isNaN(bbox.width) || isNaN(bbox.height) ||
        bbox.width <= 0 || bbox.height <= 0 || 
        !isFinite(bbox.minX) || !isFinite(bbox.minY) || !isFinite(bbox.width) || !isFinite(bbox.height)) {
      return;
    }
    
    // 비디오가 로드되었는지 확인
    if (videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
      return;
    }
    
    // 확대의 중심점
    const centerX = (bbox.minX + bbox.maxX) / 2;
    const centerY = (bbox.minY + bbox.maxY) / 2;
    
    // 중심점이 유효한지 확인
    if (isNaN(centerX) || isNaN(centerY) || !isFinite(centerX) || !isFinite(centerY)) {
      return;
    }
    
    // 확대할 영역의 크기
    const regionWidth = Math.max(1, bbox.width);  // 0보다 작으면 안됨
    const regionHeight = Math.max(1, bbox.height); // 0보다 작으면 안됨
    
    // 임시 캔버스 생성 (확대할 영역만큼)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return;
    
    tempCanvas.width = regionWidth;
    tempCanvas.height = regionHeight;
    
    // 원본 좌표 계산 (좌우 반전 처리)
    const sourceX = mirrorVideo ? 
      Math.max(0, Math.min(videoElement.videoWidth - regionWidth, videoElement.videoWidth - bbox.maxX)) : 
      Math.max(0, Math.min(videoElement.videoWidth - regionWidth, bbox.minX));
    
    const sourceY = Math.max(0, Math.min(videoElement.videoHeight - regionHeight, bbox.minY));
    
    // 원본 영역 추출
    tempCtx.drawImage(
      videoElement,
      sourceX,
      sourceY,
      regionWidth,
      regionHeight,
      0,
      0,
      regionWidth,
      regionHeight
    );
    
    // 원본 영역 지우고 확대된 이미지 그리기 (중앙에 모이지 않도록 실제 위치에 그림)
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(regionWidth, regionHeight) / 2, 0, Math.PI * 2);
    ctx.clip();
    
    // 확대된 이미지 원래 위치에 그리기
    const scaledWidth = regionWidth * scaleFactor;
    const scaledHeight = regionHeight * scaleFactor;
    
    // 중앙이 아닌 원래 위치 기준으로 그리기
    const drawX = bbox.minX - (scaledWidth - regionWidth) / 2;
    const drawY = bbox.minY - (scaledHeight - regionHeight) / 2;
    
    ctx.drawImage(
      tempCanvas,
      0,
      0,
      regionWidth,
      regionHeight,
      drawX,
      drawY,
      scaledWidth,
      scaledHeight
    );
    
    ctx.restore();
  } catch (error) {
    console.error('워핑 효과 적용 중 오류:', error);
  }
}; 