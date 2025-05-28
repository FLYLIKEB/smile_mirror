import { CanvasDimensions } from '../types';
import { MIN_CANVAS_WIDTH, MIN_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants';

// 캔버스 크기 계산 함수
export const calculateCanvasDimensions = (
  videoWidth: number, 
  videoHeight: number, 
  containerWidth: number, 
  containerHeight: number
): CanvasDimensions => {
  // 안전한 크기 보장
  const safeVideoWidth = Math.max(videoWidth || DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH);
  const safeVideoHeight = Math.max(videoHeight || DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT);
  const safeContainerWidth = Math.max(containerWidth || DEFAULT_CANVAS_WIDTH, MIN_CANVAS_WIDTH);
  const safeContainerHeight = Math.max(containerHeight || DEFAULT_CANVAS_HEIGHT, MIN_CANVAS_HEIGHT);
  
  const aspectRatio = safeVideoWidth / safeVideoHeight;
  let displayWidth = safeContainerWidth;
  let displayHeight = safeContainerHeight;
  
  // 비율 유지하면서 화면에 맞추기
  if (safeContainerWidth / safeContainerHeight > aspectRatio) {
    displayWidth = safeContainerHeight * aspectRatio;
  } else {
    displayHeight = safeContainerWidth / aspectRatio;
  }
  
  // displayWidth와 displayHeight가 0이 되지 않도록 보장
  displayWidth = Math.max(displayWidth, MIN_CANVAS_WIDTH);
  displayHeight = Math.max(displayHeight, MIN_CANVAS_HEIGHT);
  
  return {
    width: safeVideoWidth,
    height: safeVideoHeight,
    displayWidth,
    displayHeight,
    aspectRatio
  };
};

// 캔버스 설정 함수
export const setupCanvas = (
  canvas: HTMLCanvasElement,
  canvasDimensions: CanvasDimensions,
  isDeepAR: boolean = false
) => {
  // 캔버스 내부 해상도 설정 - 더 안전한 크기 사용
  const canvasWidth = Math.max(canvasDimensions.width, MIN_CANVAS_WIDTH);
  const canvasHeight = Math.max(canvasDimensions.height, MIN_CANVAS_HEIGHT);
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  // 두 캔버스 모두 동일한 전체화면 설정
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.objectFit = 'cover';
  canvas.style.pointerEvents = 'none';
  
  if (isDeepAR) {
    canvas.style.zIndex = '1';
  } else {
    canvas.style.zIndex = '2';
  }
  
  console.log(`${isDeepAR ? 'DeepAR' : 'FaceAPI'} 캔버스 설정:`, {
    ...canvasDimensions,
    actualWidth: canvasWidth,
    actualHeight: canvasHeight
  });
}; 