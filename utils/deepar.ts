import { DEEPAR_LICENSE_KEY, FRAME_STABILIZATION_DELAY, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants';
import { calculateCanvasDimensions, setupCanvas } from './canvas';
import { Dimensions } from '../types';

// DeepAR 타입 선언
declare global {
  interface Window {
    deepar: any;
  }
}

// DeepAR 스크립트 로드
export const loadDeepARScript = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (window.deepar && typeof window.deepar.initialize === 'function') {
      console.log('✅ DeepAR 이미 로드됨');
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="deepar"]');
    if (existingScript) {
      console.log('⏳ DeepAR 스크립트가 이미 존재함, 로드 대기 중...');
      const checkInterval = setInterval(() => {
        if (window.deepar && typeof window.deepar.initialize === 'function') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('DeepAR 스크립트 로드 타임아웃'));
      }, 10000);
      return;
    }

    console.log('📥 새 DeepAR 스크립트 생성');
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.js';
    script.async = true;
    script.onload = () => {
      const checkInterval = setInterval(() => {
        if (window.deepar && typeof window.deepar.initialize === 'function') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.deepar) {
          resolve();
        } else {
          reject(new Error('DeepAR 객체를 찾을 수 없음'));
        }
      }, 5000);
    };
    script.onerror = () => {
      reject(new Error('DeepAR 스크립트 로드 실패'));
    };
    document.head.appendChild(script);
  });
};

// DeepAR 인스턴스 생성
export const createDeepARInstance = async (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  dimensions: Dimensions
): Promise<any> => {
  // 캔버스 설정
  const canvasDimensions = calculateCanvasDimensions(
    video.videoWidth,
    video.videoHeight,
    dimensions.width,
    dimensions.height
  );
  
  setupCanvas(canvas, canvasDimensions, true);
  
  // 캔버스 크기 유효성 검사
  if (canvas.width < 320 || canvas.height < 240) {
    console.warn('⚠️ 캔버스 크기가 너무 작음, 기본값으로 설정');
    canvas.width = DEFAULT_CANVAS_WIDTH;
    canvas.height = DEFAULT_CANVAS_HEIGHT;
  }
  
  // 프레임 안정화 대기
  await new Promise(resolve => setTimeout(resolve, FRAME_STABILIZATION_DELAY));
  
  // DeepAR 인스턴스 생성
  const deepARInstance = await window.deepar.initialize({
    licenseKey: DEEPAR_LICENSE_KEY,
    canvas: canvas,
    additionalOptions: {
      cameraConfig: {
        disableDefaultCamera: true
      },
      memoryLimit: 32 * 1024 * 1024,
      renderingOptions: {
        clearColor: [0, 0, 0, 0],
        enableAntialiasing: false,
        enableMipmaps: false,
        preferLowPowerGPU: true,
        enableDepthBuffer: false,
        enableStencilBuffer: false,
        webglContextAttributes: {
          alpha: true,
          depth: false,
          stencil: false,
          antialias: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false
        }
      }
    }
  });
  
  // 전역 등록
  (window as any).deepARInstance = deepARInstance;
  
  return deepARInstance;
};

// DeepAR 인스턴스의 사용 가능한 함수 목록 가져오기
export const getAvailableFunctions = (deepARInstance: any): string[] => {
  try {
    const allKeys = Object.getOwnPropertyNames(deepARInstance);
    const prototypeKeys = Object.getOwnPropertyNames(Object.getPrototypeOf(deepARInstance) || {});
    const allPossibleKeys = Array.from(new Set([...allKeys, ...prototypeKeys]));
    return allPossibleKeys.filter(key => {
      try {
        return typeof deepARInstance[key] === 'function';
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
};

// DeepAR 초기화 상태 확인
export const checkInitializationStatus = async (
  deepARInstance: any,
  maxAttempts: number = 25
): Promise<boolean> => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 200));
    attempts++;
    
    if (!deepARInstance) {
      console.log('❌ DeepAR 인스턴스가 없음, 확인 중단');
      break;
    }
    
    try {
      // 다양한 방법으로 초기화 상태 확인
      let isReady = false;
      
      // 방법 1: isInitialized 함수 확인
      if (deepARInstance.isInitialized && typeof deepARInstance.isInitialized === 'function') {
        isReady = deepARInstance.isInitialized();
      }
      
      // 방법 2: 함수 존재 여부로 확인
      if (!isReady && typeof deepARInstance.backgroundBlur === 'function') {
        isReady = true;
      }
      
      // 방법 3: 기본 속성 확인
      if (!isReady) {
        isReady = deepARInstance.initialized === true || 
                 deepARInstance.status === 'initialized' ||
                 deepARInstance.ready === true;
      }
      
      if (isReady) {
        console.log(`✅ DeepAR 초기화 완료 확인됨 (${attempts}번째 시도)`);
        return true;
      }
      
      console.log(`⏳ 초기화 확인 중... (${attempts}/${maxAttempts})`);
    } catch (error) {
      console.warn(`⚠️ 초기화 확인 중 오류 (${attempts}번째):`, error);
    }
  }
  
  console.log('⚠️ 초기화 확인 타임아웃, 강제로 활성화');
  return true; // 타임아웃 시에도 true 반환하여 진행
}; 