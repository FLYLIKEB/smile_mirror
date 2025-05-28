import { useRef, useState, useCallback } from 'react';
import { EffectType, Dimensions } from '../types';
import { calculateCanvasDimensions, setupCanvas } from '../utils/canvas';
import { DEEPAR_RETRY_DELAY } from '../constants';
import { 
  loadDeepARScript, 
  createDeepARInstance, 
  checkInitializationStatus,
  getAvailableFunctions
} from '../utils/deepar';
import { 
  setDeepARBackground,
  removeEffects,
  resetBeautyParameters,
  applyBeautyEffect,
  cleanupEffects
} from '../utils/deepar-effects';

export const useDeepAR = (
  deepARCanvasRef: React.RefObject<HTMLCanvasElement>,
  videoRef: React.RefObject<HTMLVideoElement>,
  dimensions: Dimensions
) => {
  // 상태 관리
  const deepARRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const isApplyingEffectRef = useRef<boolean>(false);
  
  const [isDeepARLoaded, setIsDeepARLoaded] = useState<boolean>(false);
  const [activeEffect, setActiveEffect] = useState<EffectType>(null);
  const [currentBeautyIntensity, setCurrentBeautyIntensity] = useState<number | null>(null);

  // DeepAR 초기화
  const initDeepAR = useCallback(async () => {
    console.log('🚀 initDeepAR 호출됨');
    
    if (!deepARCanvasRef.current || isInitializingRef.current || deepARRef.current) {
      return;
    }

    // 비디오 프레임 준비 확인
    if (!videoRef.current?.videoWidth || !videoRef.current?.videoHeight) {
      console.log('⏳ 비디오 프레임이 아직 준비되지 않음, 1초 후 재시도');
      setTimeout(initDeepAR, 1000);
      return;
    }

    try {
      isInitializingRef.current = true;
      
      // 1. 스크립트 로드
      console.log('📥 DeepAR 스크립트 로드 시작');
      await loadDeepARScript();
      
      // 2. 기존 인스턴스 정리
      if (deepARRef.current) {
        try {
          await deepARRef.current.shutdown();
          deepARRef.current = null;
        } catch (error) {
          console.warn('⚠️ 기존 DeepAR 인스턴스 정리 중 오류:', error);
        }
      }
      
      // 3. 새 인스턴스 생성
      console.log('🔧 DeepAR 인스턴스 생성 시작');
      deepARRef.current = await createDeepARInstance(
        deepARCanvasRef.current,
        videoRef.current,
        dimensions
      );
      
      // 4. 비디오 소스 설정
      if (videoRef.current?.srcObject) {
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
          deepARRef.current.setVideoElement(videoRef.current, true);
        } catch (videoError) {
          console.error('❌ 비디오 설정 중 오류:', videoError);
        }
      }
      
      // 5. 초기화 상태 확인
      console.log('🔍 DeepAR 초기화 상태 확인 시작');
      const isReady = await checkInitializationStatus(deepARRef.current);
      
      if (isReady) {
        setIsDeepARLoaded(true);
        isInitializingRef.current = false;
        
        // 6. 배경 설정
        console.log('🖼️ 배경 설정 시작');
        setTimeout(async () => {
          if (deepARRef.current) {
            await setDeepARBackground(deepARRef.current);
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('❌ DeepAR 초기화 오류:', error);
      isInitializingRef.current = false;
      
      // 재시도 메커니즘
      setTimeout(() => {
        if (!deepARRef.current && !isInitializingRef.current) {
          console.log('🔄 DeepAR 초기화 재시도');
          initDeepAR();
        }
      }, DEEPAR_RETRY_DELAY);
    }
  }, [deepARCanvasRef, videoRef, dimensions]);

  // AR 효과 적용
  const applyEffect = useCallback(async (effectType: EffectType, beautyIntensity?: number) => {
    console.log('🎯 applyEffect 호출됨:', { effectType, beautyIntensity });
    
    // 기본 유효성 검사
    if (!deepARRef.current || !isDeepARLoaded || isInitializingRef.current) {
      console.log('❌ DeepAR이 준비되지 않음');
      return;
    }
    
    if (isApplyingEffectRef.current) {
      console.log('❌ 이미 다른 효과 적용 중, 요청 무시');
      return;
    }
    
    // 중복 요청 방지 (뷰티 효과의 경우 강도 차이 확인)
    if (activeEffect === effectType && effectType !== 'beauty') {
      console.log('❌ 이미 같은 효과가 활성화됨');
      return;
    }
    
    if (effectType === 'beauty' && activeEffect === 'beauty') {
      const targetIntensity = beautyIntensity !== undefined ? Math.max(0.1, Math.min(1.0, beautyIntensity)) : 0.5;
      const intensityDiff = Math.abs((currentBeautyIntensity || 0) - targetIntensity);
      if (intensityDiff < 0.05) {
        console.log(`❌ 뷰티 강도 차이가 작음 (${intensityDiff.toFixed(3)}), 적용 생략`);
        return;
      }
    }

    try {
      isApplyingEffectRef.current = true;
      
      const isBeautyToBeauty = (activeEffect === 'beauty' && effectType === 'beauty');
      
      // 기존 효과 제거 (뷰티에서 뷰티로 전환하는 경우 제외)
      if (!isBeautyToBeauty) {
        console.log('🧹 기존 효과 제거 시작');
        
        await removeEffects(deepARRef.current);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (activeEffect === 'beauty') {
          await resetBeautyParameters(deepARRef.current);
          setCurrentBeautyIntensity(null);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // 새 효과 적용
      if (effectType === null) {
        setActiveEffect(null);
        setCurrentBeautyIntensity(null);
        console.log('✅ 모든 효과 제거됨');
        
      } else if (effectType === 'beauty') {
        const intensity = beautyIntensity !== undefined ? Math.max(0.1, Math.min(1.0, beautyIntensity)) : 0.5;
        
        const success = await applyBeautyEffect(deepARRef.current, intensity);
        
        if (success) {
          setActiveEffect(effectType);
          setCurrentBeautyIntensity(intensity);
          
          if (isBeautyToBeauty) {
            console.log(`✅ 뷰티 강도 변경됨: ${currentBeautyIntensity} → ${intensity.toFixed(3)}`);
          } else {
            console.log(`✅ 뷰티 효과 적용됨 (강도: ${intensity.toFixed(3)})`);
          }
        } else {
          throw new Error('뷰티 효과 적용 실패');
        }
      }
      
    } catch (error) {
      console.error('❌ 효과 적용 오류:', error);
      
      // 오류 시 정리
      try {
        await cleanupEffects(deepARRef.current);
        setActiveEffect(null);
        setCurrentBeautyIntensity(null);
        console.log('🧹 오류 후 모든 효과 제거됨');
      } catch (cleanupError) {
        console.error('❌ 효과 정리 중 오류:', cleanupError);
      }
    } finally {
      isApplyingEffectRef.current = false;
      console.log('🏁 효과 적용 과정 완료');
    }
  }, [isDeepARLoaded, activeEffect, currentBeautyIntensity]);

  // 캔버스 크기 업데이트
  const updateCanvasSize = useCallback(() => {
    if (!deepARCanvasRef.current || !videoRef.current || !isDeepARLoaded) {
      return;
    }
    
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      console.log('⚠️ 비디오 크기가 유효하지 않음, 캔버스 크기 업데이트 건너뜀');
      return;
    }
    
    const canvasDimensions = calculateCanvasDimensions(
      video.videoWidth,
      video.videoHeight,
      dimensions.width,
      dimensions.height
    );
    
    const canvas = deepARCanvasRef.current;
    if (canvas.width !== canvasDimensions.width || canvas.height !== canvasDimensions.height) {
      setupCanvas(canvas, canvasDimensions, true);
      
      // DeepAR resize 호출
      if (deepARRef.current?.resize) {
        try {
          deepARRef.current.resize(canvasDimensions.width, canvasDimensions.height);
        } catch (error) {
          console.warn('⚠️ DeepAR resize 호출 중 오류:', error);
        }
      }
    }
  }, [dimensions, isDeepARLoaded, deepARCanvasRef, videoRef]);

  // 정리 함수
  const cleanup = useCallback(() => {
    if (deepARRef.current) {
      deepARRef.current.shutdown().catch((error: any) => {
        console.warn('⚠️ DeepAR 종료 중 오류:', error);
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
    cleanup,
    setDeepARBackground: () => setDeepARBackground(deepARRef.current)
  };
}; 