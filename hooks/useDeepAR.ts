import { useRef, useState, useCallback } from 'react';
import { EffectType, Dimensions } from '../types';
import { calculateCanvasDimensions, setupCanvas } from '../utils/canvas';
import { 
  DEEPAR_LICENSE_KEY, 
  DEEPAR_INIT_TIMEOUT, 
  DEEPAR_RETRY_DELAY,
  FRAME_STABILIZATION_DELAY,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_CANVAS_HEIGHT
} from '../constants';

export const useDeepAR = (
  deepARCanvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  dimensions: Dimensions
) => {
  const deepARRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const [isDeepARLoaded, setIsDeepARLoaded] = useState<boolean>(false);
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [currentBlurIntensity, setCurrentBlurIntensity] = useState<number | null>(null);
  const isApplyingEffectRef = useRef<boolean>(false); // 효과 적용 중 상태 추적
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // DeepAR 스크립트 로드
  const loadDeepARScript = useCallback((): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (window.deepar && typeof window.deepar.initialize === 'function') {
        console.log('DeepAR 이미 로드됨');
        resolve();
        return;
      }

      const existingScript = document.querySelector('script[src*="deepar"]');
      if (existingScript) {
        console.log('DeepAR 스크립트가 이미 존재함, 로드 대기 중...');
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

      console.log('새 DeepAR 스크립트 생성');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.js';
      script.async = true;
      script.onload = () => {
        console.log('DeepAR 스크립트 onload 이벤트');
        const checkInterval = setInterval(() => {
          if (window.deepar && typeof window.deepar.initialize === 'function') {
            console.log('window.deepar 사용 가능');
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
        console.error('DeepAR 스크립트 로드 실패');
        reject(new Error('DeepAR 스크립트 로드 실패'));
      };
      document.head.appendChild(script);
    });
  }, []);

  // DeepAR 초기화
  const initDeepAR = useCallback(async () => {
    console.log('initDeepAR 호출됨');
    
    if (!deepARCanvasRef.current || isInitializingRef.current || deepARRef.current) return;

    // 비디오가 실제로 프레임을 출력하고 있는지 확인
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log('비디오 프레임이 아직 준비되지 않음, 1초 후 재시도');
      setTimeout(initDeepAR, 1000);
      return;
    }

    try {
      isInitializingRef.current = true;
      console.log('DeepAR 스크립트 로드 시작');
      await loadDeepARScript();
      console.log('DeepAR 스크립트 로드 완료');
      
      // 기존 인스턴스 정리
      if (deepARRef.current) {
        try {
          await deepARRef.current.shutdown();
          deepARRef.current = null;
        } catch (error) {
          console.warn('기존 DeepAR 인스턴스 정리 중 오류:', error);
        }
      }
      
      console.log('DeepAR 초기화 시작');
      
      // 통합된 캔버스 설정 사용
      if (deepARCanvasRef.current && videoRef.current) {
        const video = videoRef.current;
        const canvasDimensions = calculateCanvasDimensions(
          video.videoWidth,
          video.videoHeight,
          dimensions.width,
          dimensions.height
        );
        
        setupCanvas(deepARCanvasRef.current, canvasDimensions, true);
        
        // 캔버스 크기가 유효한지 확인
        if (deepARCanvasRef.current.width < 320 || deepARCanvasRef.current.height < 240) {
          console.warn('캔버스 크기가 너무 작음, 기본값으로 설정');
          deepARCanvasRef.current.width = DEFAULT_CANVAS_WIDTH;
          deepARCanvasRef.current.height = DEFAULT_CANVAS_HEIGHT;
        }
      }
      
      // 카메라 프레임 안정화 대기
      await new Promise(resolve => setTimeout(resolve, FRAME_STABILIZATION_DELAY));
      
      // DeepAR 초기화 - 더 안전한 설정
      deepARRef.current = await window.deepar.initialize({
        licenseKey: DEEPAR_LICENSE_KEY,
        canvas: deepARCanvasRef.current,
        additionalOptions: {
          cameraConfig: {
            disableDefaultCamera: true
          },
          memoryLimit: 32 * 1024 * 1024, // 메모리 제한을 더 낮게 설정 (32MB)
          renderingOptions: {
            clearColor: [0, 0, 0, 0],
            enableAntialiasing: false, // 안티앨리어싱 비활성화
            enableMipmaps: false, // 밉맵 비활성화
            preferLowPowerGPU: true, // 저전력 GPU 선호
            enableDepthBuffer: false, // 깊이 버퍼 비활성화
            enableStencilBuffer: false, // 스텐실 버퍼 비활성화
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
      
      console.log('DeepAR 인스턴스 생성 완료:', deepARRef.current);
      
      // 콜백 설정 - 콜백에 의존하지 않고 보조적으로만 사용
      if (deepARRef.current.callbacks) {
        deepARRef.current.callbacks.onInitialize = () => {
          console.log('DeepAR onInitialize 콜백 호출됨');
          if (isInitializingRef.current) {
            setIsDeepARLoaded(true);
            isInitializingRef.current = false;
            console.log('DeepAR 초기화 완료 (콜백)');
          }
        };
        
        deepARRef.current.callbacks.onError = (error: string) => {
          console.error('DeepAR onError 콜백:', error);
          isInitializingRef.current = false;
          setIsDeepARLoaded(false);
        };
      }
      
      // 비디오 소스 설정
      if (videoRef.current && videoRef.current.srcObject && deepARRef.current) {
        console.log('비디오 소스 설정');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (deepARRef.current && isInitializingRef.current) {
          try {
            deepARRef.current.setVideoElement(videoRef.current, true);
          } catch (videoError) {
            console.error('비디오 설정 중 오류:', videoError);
          }
        }
      }
      
      // 직접적인 초기화 확인 - 콜백보다 확실함
      console.log('DeepAR 초기화 상태 직접 확인 시작');
      let checkAttempts = 0;
      const maxCheckAttempts = 25; // 5초 대기 (200ms * 25)
      
      const checkInitializationStatus = async () => {
        while (checkAttempts < maxCheckAttempts && isInitializingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 200));
          checkAttempts++;
          
          if (!deepARRef.current) {
            console.log('DeepAR 인스턴스가 없음, 확인 중단');
            break;
          }
          
          try {
            // 여러 방법으로 초기화 상태 확인
            let isReady = false;
            
            // 방법 1: isInitialized 함수 확인
            try {
              if (deepARRef.current.isInitialized && typeof deepARRef.current.isInitialized === 'function') {
                isReady = deepARRef.current.isInitialized();
              }
            } catch (e) {}
            
            // 방법 2: 간단한 함수 호출로 상태 확인
            if (!isReady) {
              try {
                // backgroundBlur 함수 존재 여부로 초기화 확인
                if (typeof deepARRef.current.backgroundBlur === 'function') {
                  isReady = true;
                }
              } catch (e) {}
            }
            
            // 방법 3: 기본 속성 확인
            if (!isReady) {
              try {
                isReady = deepARRef.current.initialized === true || 
                         deepARRef.current.status === 'initialized' ||
                         deepARRef.current.ready === true;
              } catch (e) {}
            }
            
            if (isReady) {
              console.log(`DeepAR 초기화 완료 확인됨 (${checkAttempts}번째 시도)`);
              setIsDeepARLoaded(true);
              isInitializingRef.current = false;
              return;
            } else {
              console.log(`초기화 확인 중... (${checkAttempts}/${maxCheckAttempts})`);
            }
            
          } catch (checkError) {
            console.warn(`초기화 확인 중 오류 (${checkAttempts}번째):`, checkError);
          }
        }
        
        // 최대 시도 후에도 확인되지 않으면 강제 설정
        if (isInitializingRef.current && deepARRef.current) {
          console.log('초기화 확인 타임아웃, 강제로 활성화');
          setIsDeepARLoaded(true);
          isInitializingRef.current = false;
        }
      };
      
      // 초기화 확인 시작 (비동기)
      checkInitializationStatus();
      
    } catch (error) {
      console.error('DeepAR 초기화 오류:', error);
      isInitializingRef.current = false;
      
      // 재시도 메커니즘
      setTimeout(() => {
        if (!deepARRef.current && !isInitializingRef.current) {
          console.log('DeepAR 초기화 재시도');
          initDeepAR();
        }
      }, DEEPAR_RETRY_DELAY);
    }
  }, [loadDeepARScript, dimensions, isDeepARLoaded, deepARCanvasRef, videoRef]);

  // AR 효과 적용
  const applyEffect = useCallback(async (effectType: EffectType, blurIntensity?: number) => {
    if (!deepARRef.current || !isDeepARLoaded || isInitializingRef.current || isApplyingEffectRef.current) {
      console.log('DeepAR이 준비되지 않거나 이미 효과 적용 중');
      return;
    }
    
    // 현재 활성 효과와 같으면 건너뜀 (블러의 경우 강도가 다르면 재적용)
    if (activeEffect === effectType && effectType !== 'blur') {
      console.log('이미 같은 효과가 활성화됨');
      return;
    }
    
    // 블러의 경우 현재 강도와 비교
    if (effectType === 'blur' && activeEffect === 'blur') {
      const targetIntensity = blurIntensity !== undefined ? Math.max(1, Math.min(10, blurIntensity)) : 3;
      if (currentBlurIntensity === targetIntensity) {
        console.log(`이미 같은 강도(${targetIntensity})의 블러가 적용됨`);
        return;
      }
    }
    
    try {
      isApplyingEffectRef.current = true; // 효과 적용 시작
      console.log(`효과 적용 시작: ${effectType}${effectType === 'blur' ? `, 강도: ${blurIntensity}` : ''}`);
      
      // 블러에서 블러로 전환하는 경우 기존 효과 제거 생략
      const isBlurToBlur = (activeEffect === 'blur' && effectType === 'blur');
      
      if (!isBlurToBlur) {
        // 모든 효과 안전하게 초기화 - 순차적으로 실행하고 각 단계마다 지연 추가
        console.log('기존 효과 제거 시작');
        
        try {
          if (deepARRef.current.removeEffect) {
            await deepARRef.current.removeEffect();
          } else if (deepARRef.current.clearEffect) {
            await deepARRef.current.clearEffect();
          } else {
            await deepARRef.current.switchEffect(null);
          }
          await new Promise(resolve => setTimeout(resolve, 100)); // 지연 추가
        } catch (e) {
          console.warn('효과 제거 오류:', e);
        }
        
        try {
          // 블러 상태 확인 후 비활성화 (블러에서 블러 전환이 아닌 경우에만)
          if (activeEffect === 'blur') {
            await deepARRef.current.backgroundBlur(false);
            setCurrentBlurIntensity(null);
            await new Promise(resolve => setTimeout(resolve, 50)); // 지연 추가
          }
        } catch (e) {
          console.warn('backgroundBlur 초기화 오류:', e);
        }
        
        // 초기화 완료 후 추가 지연
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log('블러에서 블러로 전환: 기존 효과 제거 생략');
      }
      
      // DeepAR 상태 다시 확인
      if (!deepARRef.current || !isDeepARLoaded || isInitializingRef.current) {
        console.log('효과 적용 중 DeepAR 상태 변경됨, 중단');
        return;
      }
      
      // 새 효과 적용
      if (effectType === null) {
        setActiveEffect(null);
        setCurrentBlurIntensity(null);
        console.log('모든 효과 제거됨');
      } else if (effectType === 'blur') {
        try {
          console.log(`블러 효과 적용 시도${isBlurToBlur ? ' (강도 변경)' : ''}`);
          // 블러 적용 전 한 번 더 상태 확인
          if (!deepARRef.current || !isDeepARLoaded) {
            throw new Error('DeepAR 상태가 유효하지 않음');
          }
          
          // 블러 강도 계산 (기본값: 3, 범위: 1~10)
          const intensity = blurIntensity !== undefined ? Math.max(1, Math.min(10, blurIntensity)) : 3;
          
          // 블러 적용 (블러에서 블러로 전환하는 경우 더 짧은 지연)
          await deepARRef.current.backgroundBlur(true, intensity);
          setActiveEffect(effectType);
          setCurrentBlurIntensity(intensity);
          
          if (isBlurToBlur) {
            console.log(`블러 강도 변경됨: ${currentBlurIntensity} → ${intensity}`);
          } else {
            console.log(`배경 블러 효과 적용됨 (강도: ${intensity})`);
          }
        } catch (blurError) {
          console.error('블러 효과 적용 중 오류:', blurError);
          // 블러 적용 실패 시 효과 비활성화
          try {
            if (deepARRef.current) {
              await deepARRef.current.backgroundBlur(false);
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (cleanupError) {
            console.error('블러 정리 중 오류:', cleanupError);
          }
          setActiveEffect(null);
          setCurrentBlurIntensity(null);
        }
      }
    } catch (error) {
      console.error('효과 적용 오류:', error);
      
      // 오류 시 안전한 정리 - 더 신중하게
      try {
        if (deepARRef.current) {
          // 각 정리 작업 사이에 지연 추가
          if (deepARRef.current.removeEffect) {
            await deepARRef.current.removeEffect();
          } else if (deepARRef.current.clearEffect) {
            await deepARRef.current.clearEffect();
          } else {
            await deepARRef.current.switchEffect(null);
          }
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // 오류 상황에서는 블러 비활성화 생략 (이미 오류 상태일 가능성)
          console.log('오류로 인해 블러 비활성화 생략');
        }
        setActiveEffect(null);
        setCurrentBlurIntensity(null);
        console.log('오류 후 모든 효과 제거됨');
      } catch (cleanupError) {
        console.error('효과 정리 중 오류:', cleanupError);
      }
    } finally {
      isApplyingEffectRef.current = false; // 효과 적용 완료
    }
  }, [isDeepARLoaded, activeEffect, isInitializingRef]);

  // 캔버스 크기 업데이트
  const updateCanvasSize = useCallback(() => {
    if (!deepARCanvasRef.current || !videoRef.current || !isDeepARLoaded) {
      return;
    }
    
    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (!videoWidth || !videoHeight || videoWidth <= 0 || videoHeight <= 0) {
      console.log('비디오 크기가 유효하지 않음, 캔버스 크기 업데이트 건너뜀');
      return;
    }
    
    const canvasDimensions = calculateCanvasDimensions(
      videoWidth,
      videoHeight,
      dimensions.width,
      dimensions.height
    );
    
    const currentWidth = deepARCanvasRef.current.width;
    const currentHeight = deepARCanvasRef.current.height;
    
    if (currentWidth !== canvasDimensions.width || currentHeight !== canvasDimensions.height) {
      setupCanvas(deepARCanvasRef.current, canvasDimensions, true);
      
      // DeepAR resize 호출
      if (deepARRef.current && typeof deepARRef.current.resize === 'function') {
        try {
          deepARRef.current.resize(canvasDimensions.width, canvasDimensions.height);
        } catch (error) {
          console.warn('DeepAR resize 호출 중 오류:', error);
        }
      }
    }
  }, [dimensions, isDeepARLoaded, deepARCanvasRef, videoRef]);

  // 정리 함수
  const cleanup = useCallback(() => {
    if (deepARRef.current) {
      deepARRef.current.shutdown().catch((error: any) => {
        console.warn('DeepAR 종료 중 오류:', error);
      });
      deepARRef.current = null;
    }
    isInitializingRef.current = false;
  }, []);

  return {
    isDeepARLoaded,
    activeEffect,
    initDeepAR,
    applyEffect,
    updateCanvasSize,
    cleanup
  };
}; 