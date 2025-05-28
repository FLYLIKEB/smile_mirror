import { EffectType } from '../types';
import { getAvailableFunctions } from './deepar';

// 배경 설정 함수
export const setDeepARBackground = async (deepARInstance: any): Promise<void> => {
  console.log('🖼️ setDeepARBackground 함수 호출됨');
  
  if (!deepARInstance) {
    console.log('❌ DeepAR 인스턴스가 없음, 배경 설정 불가');
    return;
  }
  
  try {
    console.log('🎨 DeepAR 배경 이미지 설정 시도...');
    const availableFunctions = getAvailableFunctions(deepARInstance);
    console.log('🔍 사용 가능한 배경 함수들:', availableFunctions.filter(f => f.toLowerCase().includes('background')));
    
    // DeepAR backgroundReplacement 함수 사용
    if (availableFunctions.includes('backgroundReplacement')) {
      try {
        await deepARInstance.backgroundReplacement(true, '/images/background.jpg');
        console.log('✅ backgroundReplacement로 배경 설정 성공');
        return;
      } catch (funcError) {
        console.error('❌ backgroundReplacement 실패:', funcError);
      }
    }
    
    // 백업: 다른 배경 관련 함수들 시도
    const backgroundFunctions = ['setBackground', 'changeBackground', 'setBackgroundImage', 'backgroundSegmentation', 'replaceBackground'];
    
    for (const funcName of backgroundFunctions) {
      if (availableFunctions.includes(funcName)) {
        try {
          await deepARInstance[funcName]('/images/background.jpg');
          console.log(`✅ ${funcName}로 배경 설정 성공`);
          return;
        } catch (funcError) {
          console.error(`❌ ${funcName} 실패:`, funcError);
        }
      }
    }
    
    console.warn('⚠️ 배경 설정 실패 - DeepAR에서 지원하지 않는 기능일 수 있습니다');
  } catch (backgroundError) {
    console.error('❌ DeepAR 배경 설정 중 전체적인 오류:', backgroundError);
  }
};

// 효과 제거 함수
export const removeEffects = async (deepARInstance: any): Promise<void> => {
  if (!deepARInstance) return;
  
  try {
    const availableFunctions = getAvailableFunctions(deepARInstance);
    const removeFunctions = ['removeEffect', 'clearEffect', 'switchEffect'];
    
    for (const funcName of removeFunctions) {
      if (availableFunctions.includes(funcName)) {
        try {
          if (funcName === 'switchEffect') {
            await deepARInstance[funcName](null);
          } else {
            await deepARInstance[funcName]();
          }
          console.log(`✅ ${funcName}으로 효과 제거 성공`);
          return;
        } catch (removeError) {
          console.log(`❌ ${funcName} 실패:`, removeError);
        }
      }
    }
    
    console.log('⚠️ 효과 제거 함수를 찾을 수 없음');
  } catch (error) {
    console.warn('⚠️ 효과 제거 오류:', error);
  }
};

// 뷰티 파라미터 리셋 함수
export const resetBeautyParameters = async (deepARInstance: any): Promise<void> => {
  if (!deepARInstance) return;
  
  try {
    const availableFunctions = getAvailableFunctions(deepARInstance);
    
    if (availableFunctions.includes('setParameter')) {
      const params = ['FaceSmooth', 'MakeupLook', 'beauty', 'Beauty'];
      
      for (const param of params) {
        try {
          await deepARInstance.setParameter(param, 0);
          console.log(`✅ ${param} 파라미터 리셋 완료`);
        } catch (paramError) {
          // 조용히 다음 파라미터로 이동
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 뷰티 파라미터 리셋 오류:', error);
  }
};

// 감정 개찰구 효과 적용 함수
export const applyBeautyEffect = async (
  deepARInstance: any,
  intensity: number
): Promise<boolean> => {
  if (!deepARInstance) return false;
  
  try {
    console.log(`🚪 감정 개찰구 분석 중 (감정 점수: ${intensity.toFixed(3)})`);
    const availableFunctions = getAvailableFunctions(deepARInstance);
    let effectApplied = false;
    
    // 감정 개찰구 시스템: 부정적/긍정적 감정에 따른 처리 (웃음에 더 우호적)
    const isNegativeEmotion = intensity >= -0.2 && intensity < 0.1; // -20% 이상 10% 미만은 부정적 감정 (범위 축소)
    const isNeutralEmotion = intensity >= 0.1 && intensity < 0.4; // 10-40%는 중립 (더 관대)
    const isPositiveEmotion = intensity >= 0.4; // 40% 이상은 긍정적 감정 (더 쉽게 달성)
    const isVeryNegative = intensity < -0.2; // -20% 미만은 매우 부정적 (더 관대)
    
    if (isVeryNegative) {
      // 😔 매우 부정적 감정 - 진입 허가하지만 효과 없음
      console.log('😔 매우 부정적인 감정이지만 진입을 허가합니다. 효과 없음');
      effectApplied = true; // 효과는 적용하지 않지만 상태는 업데이트
      
    } else if (isNegativeEmotion) {
      // 🚫 부정적 감정 - 입장 거부 & 얼굴 왜곡
      console.log('🚫 감정이 불안정합니다. 진입 보류 - 왜곡 효과 적용');
      
      // 얼굴 왜곡 효과들 시도
      const distortionEffects = [
        { name: '🌀 노이즈 왜곡', path: '/effects/alien.deepar' }, // 외계인 효과로 왜곡
        { name: '🔴 붉은 발색', path: '/effects/lion' }, // 사자 효과로 강렬한 색감
        { name: '👾 글리치 효과', path: '/effects/dalmatian' } // 달마시안으로 패턴 왜곡
      ];
      
      // 강도에 따라 왜곡 레벨 선택
      const distortionLevel = Math.floor((0.3 - intensity) * 10); // 0-3 레벨
      const selectedDistortion = distortionEffects[Math.min(distortionLevel, distortionEffects.length - 1)];
      
      if (availableFunctions.includes('switchEffect')) {
        try {
          console.log(`💀 ${selectedDistortion.name} 적용 중... (왜곡 레벨: ${distortionLevel})`);
          await deepARInstance.switchEffect(selectedDistortion.path);
          console.log(`✅ 입장 거부 효과 적용: ${selectedDistortion.name}`);
          effectApplied = true;
          
          // 왜곡 강도 증폭
          if (availableFunctions.includes('setParameter')) {
            const distortionParams = ['intensity', 'strength', 'distortion', 'noise', 'glitch'];
            for (const param of distortionParams) {
              try {
                const distortionValue = Math.min((0.3 - intensity) * 3, 1.0); // 부정적일수록 강한 왜곡
                await deepARInstance.setParameter(param, distortionValue);
                console.log(`🌀 ${param} 왜곡 강도: ${distortionValue.toFixed(3)}`);
                break;
              } catch (paramError) {
                // 조용히 다음 파라미터 시도
              }
            }
          }
        } catch (distortionError) {
          console.warn(`❌ 왜곡 효과 실패: ${selectedDistortion.name}`, distortionError);
        }
      }
      
      // 백업: 강한 블러로 왜곡 효과
      if (!effectApplied && availableFunctions.includes('backgroundBlur')) {
        try {
          const blurIntensity = (0.3 - intensity) * 2; // 부정적일수록 강한 블러
          await deepARInstance.backgroundBlur(blurIntensity);
          console.log(`🌀 강제 블러 왜곡 적용: ${blurIntensity.toFixed(3)}`);
          effectApplied = true;
        } catch (blurError) {
          console.log('❌ 블러 왜곡 실패:', blurError);
        }
      }
      
    } else if (isNeutralEmotion) {
      // ⚠️ 중립 감정 - 대기 상태
      console.log('⚠️ 감정 상태 확인 중... 대기해주세요');
      
      if (availableFunctions.includes('switchEffect')) {
        try {
          console.log('👓 기본 관찰 모드 활성화...');
          await deepARInstance.switchEffect('/effects/aviators');
          console.log('✅ 관찰 모드 활성화됨');
          effectApplied = true;
        } catch (neutralError) {
          console.warn('❌ 관찰 모드 실패:', neutralError);
        }
      }
      
    } else if (isPositiveEmotion) {
      // ✅ 긍정적 감정 - 입장 허가 & 아름다운 효과
      console.log('✅ 감정이 안정적입니다. 입장 허가 - 환영 효과 적용');
      
      // 긍정적 감정에 따른 아름다운 효과들
      const welcomeEffects = [
        { name: '🌸 플라워 환영', path: '/effects/flowers.deepar', minIntensity: 0.9 },
        { name: '🐨 귀여운 안내', path: '/effects/koala', minIntensity: 0.8 },
        { name: '🌌 우주적 환영', path: '/effects/galaxy_background', minIntensity: 0.7 },
        { name: '🕶️ 멋진 입장', path: '/effects/aviators', minIntensity: 0.6 }
      ];
      
      // 긍정적 감정 강도에 따라 효과 선택
      const selectedWelcome = welcomeEffects.find(effect => intensity >= effect.minIntensity) || welcomeEffects[welcomeEffects.length - 1];
      
      if (availableFunctions.includes('switchEffect')) {
        try {
          console.log(`🎉 ${selectedWelcome.name} 적용 중... (환영 레벨: ${intensity.toFixed(3)})`);
          await deepARInstance.switchEffect(selectedWelcome.path);
          console.log(`✅ 입장 허가 효과: ${selectedWelcome.name}`);
          effectApplied = true;
          
          // 부드러운 강도 적용
          if (availableFunctions.includes('setParameter')) {
            const welcomeParams = ['intensity', 'beauty', 'glow', 'warmth', 'brightness'];
            for (const param of welcomeParams) {
              try {
                const welcomeValue = Math.min(intensity * 0.9, 0.8); // 부드럽고 따뜻한 효과
                await deepARInstance.setParameter(param, welcomeValue);
                console.log(`🌟 ${param} 환영 강도: ${welcomeValue.toFixed(3)}`);
                break;
              } catch (paramError) {
                // 조용히 다음 파라미터 시도
              }
            }
          }
        } catch (welcomeError) {
          console.warn(`❌ 환영 효과 실패: ${selectedWelcome.name}`, welcomeError);
        }
      }
    }
    
    // 최종 백업
    if (!effectApplied) {
      console.log('🎨 감정 개찰구 효과 적용 실패, 기본 모드로 진행');
      effectApplied = true; // UI 상태는 업데이트
    }
    
    return effectApplied;
  } catch (error) {
    console.error('❌ 감정 개찰구 시스템 오류:', error);
    return false;
  }
};

// 효과 정리 함수
export const cleanupEffects = async (deepARInstance: any): Promise<void> => {
  if (!deepARInstance) return;
  
  try {
    const availableFunctions = getAvailableFunctions(deepARInstance);
    
    // 효과 제거
    await removeEffects(deepARInstance);
    
    // 뷰티 파라미터 리셋
    await resetBeautyParameters(deepARInstance);
    
    await new Promise(resolve => setTimeout(resolve, 50));
  } catch (error) {
    console.error('❌ 효과 정리 중 오류:', error);
  }
}; 