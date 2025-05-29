import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Head from 'next/head';
import Score from '../components/Score';
import AREffectButtons from '../components/AREffectButtons';
import LoadingMessages from '../components/LoadingMessages';
import EmotionGateOverlay from '../components/EmotionGateOverlay';
import ScreenshotQR from '../components/ScreenshotQR';
import { useDeepAR } from '../hooks/useDeepAR';
import { useFaceAPI } from '../hooks/useFaceAPI';
import { useVideo } from '../hooks/useVideo';
import { useDimensions } from '../hooks/useDimensions';
import '../types';

// DeepAR을 직접 임포트하지 않고 런타임에 로드
declare global {
  interface Window {
    deepar: any;
  }
}

// 타입 정의
interface CanvasDimensions {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  aspectRatio: number;
}

interface VideoConstraints {
  video: {
    facingMode: string;
    width: { ideal: number };
    height: { ideal: number };
  };
}

// 감정 상태 타입
type EmotionGateStatus = 'analyzing' | 'approved' | 'denied' | 'locked';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const deepARCanvasRef = useRef<HTMLCanvasElement>(null);
  const faceAPICanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 감정 개찰구 상태 관리
  const [gateStatus, setGateStatus] = useState<EmotionGateStatus>('analyzing');
  const [deniedMessage, setDeniedMessage] = useState<string>('');
  const [lockTimer, setLockTimer] = useState<number>(0);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 음성 재생 상태 추가
  const [isSpeechPlaying, setIsSpeechPlaying] = useState<boolean>(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 스크린샷 QR 상태 관리
  const [isScreenshotQRVisible, setIsScreenshotQRVisible] = useState<boolean>(false);
  const [hasReached100, setHasReached100] = useState<boolean>(false);
  const lastScoreRef = useRef<number>(0);
  
  // 시민ID 상태 관리 (hydration 오류 방지)
  const [citizenId, setCitizenId] = useState<string>('------');

  // 화면 크기 관리
  const { dimensions, updateDimensions } = useDimensions(containerRef);

  // FaceAPI 관리
  const {
    emotionScore,
    isModelLoaded,
    isCameraReady,
    loadModels,
    startDetectionInterval,
    stopDetectionInterval,
    setCameraReady
  } = useFaceAPI(faceAPICanvasRef, videoRef, dimensions);

  // DeepAR 관리
  const {
    isDeepARLoaded,
    activeEffect,
    initDeepAR,
    applyEffect,
    updateCanvasSize: updateDeepARCanvasSize,
    cleanup: cleanupDeepAR,
    takeScreenshot: takeDeepARScreenshot,
    setDeepARBackground
  } = useDeepAR(deepARCanvasRef, videoRef, dimensions);

  // 비디오 관리
  const { startVideo, cleanupVideo } = useVideo(
    videoRef,
    dimensions,
    setCameraReady,
    () => {
      if (!isDeepARLoaded) {
        initDeepAR();
      }
    }
  );

  // 메모이제이션된 값들
  const videoOpacity = useMemo(() => isDeepARLoaded ? 0 : 1, [isDeepARLoaded]);

  // iOS에서 사용자 터치 시 음성 활성화
  const enableSpeechOnTouch = useCallback(() => {
    if (!isSpeechEnabled && 'speechSynthesis' in window) {
      // 디바이스 정보 로깅
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
      
      console.log('📱 디바이스 정보:', {
        isIOS,
        isChrome,
        isSafari,
        userAgent: navigator.userAgent,
        speechSynthesis: !!window.speechSynthesis,
        voices: window.speechSynthesis?.getVoices?.()?.length || 0
      });
      
      // iOS용 강화된 음성 권한 획득
      try {
        // 1차: 즉시 더미 음성 재생
        const testUtterance = new SpeechSynthesisUtterance('');
        testUtterance.volume = 0;
        testUtterance.rate = 10; // 빠르게 완료
        
        testUtterance.onstart = () => {
          console.log('✅ 음성 권한 획득 성공');
          setIsSpeechEnabled(true);
        };
        
        testUtterance.onerror = (event) => {
          console.error('❌ 음성 권한 획득 실패:', event.error);
          
          // iOS에서 실패 시 다른 방법들 시도
          setTimeout(() => {
            console.log('🔄 음성 권한 재시도...');
            
            // 2차: 짧은 한국어 음성 시도
            const retryUtterance = new SpeechSynthesisUtterance('테스트');
            retryUtterance.volume = 0.01; // 거의 들리지 않게
            retryUtterance.rate = 10;
            retryUtterance.lang = 'ko-KR';
            
            retryUtterance.onstart = () => {
              console.log('✅ 재시도로 음성 권한 획득');
              setIsSpeechEnabled(true);
            };
            
            retryUtterance.onerror = (retryEvent) => {
              console.error('❌ 재시도도 실패:', retryEvent.error);
              
              // 3차: Web Audio API로 무음 재생 시도
              try {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                gainNode.gain.value = 0; // 무음
                oscillator.frequency.value = 0;
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.01);
                
                console.log('🎵 Web Audio API로 오디오 컨텍스트 활성화');
                setIsSpeechEnabled(true);
              } catch (audioError) {
                console.error('❌ Web Audio API도 실패:', audioError);
              }
            };
            
            window.speechSynthesis.speak(retryUtterance);
          }, 500);
        };
        
        testUtterance.onend = () => {
          if (!isSpeechEnabled) {
            setIsSpeechEnabled(true);
            console.log('🔊 음성 권한 onend에서 활성화');
          }
        };
        
        // 즉시 재생 시도
        window.speechSynthesis.speak(testUtterance);
        
        // iOS에서 즉시 활성화되지 않을 수 있으므로 타이머로 강제 활성화
        setTimeout(() => {
          if (!isSpeechEnabled) {
            console.log('⏰ 타이머로 강제 음성 활성화');
            setIsSpeechEnabled(true);
          }
        }, 1000);
        
      } catch (initError) {
        console.error('❌ 음성 초기화 실패:', initError);
        // 그래도 활성화 상태로 변경 (시도라도 해보기)
        setIsSpeechEnabled(true);
      }
    }
  }, [isSpeechEnabled]);

  // 강화된 음성 중단 함수
  const stopSpeech = useCallback((reason: string = '사용자 요청') => {
    console.log(`🔇 음성 중단 시도: ${reason}`);
    
    // 음성 상태 즉시 업데이트
    setIsSpeechPlaying(false);
    setDeniedMessage('');
    
    // 현재 utterance 참조 정리
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null;
    }
    
    // 음성 타이머 정리
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    // Web Speech API 중단
    if ('speechSynthesis' in window) {
      try {
        // 여러 방법으로 강제 중단 시도
        window.speechSynthesis.cancel();
        
        // iOS에서 즉시 중단되지 않을 수 있으므로 추가 시도
        setTimeout(() => {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            console.log('🔄 음성이 아직 재생 중 - 강제 중단 재시도');
            window.speechSynthesis.cancel();
            
            // 최종 백업: 음성 큐 완전히 비우기
            setTimeout(() => {
              try {
                window.speechSynthesis.cancel();
                // 빈 음성으로 큐 교체
                const silentUtterance = new SpeechSynthesisUtterance('');
                silentUtterance.volume = 0;
                silentUtterance.rate = 10;
                window.speechSynthesis.speak(silentUtterance);
                setTimeout(() => window.speechSynthesis.cancel(), 50);
              } catch (finalError) {
                console.warn('⚠️ 최종 음성 중단 시도 실패:', finalError);
              }
            }, 100);
          }
        }, 100);
        
        console.log(`✅ 음성 중단 완료: ${reason}`);
      } catch (cancelError) {
        console.warn('⚠️ 음성 중단 실패:', cancelError);
      }
    }
  }, []);

  // 음성 메시지 재생 함수
  const playDeniedMessage = useCallback((message: string) => {
    // 이미 재생 중이면 먼저 중단
    if (isSpeechPlaying) {
      console.log('🔄 기존 음성 중단 후 새 음성 재생');
      stopSpeech('새 음성 재생 준비');
    }
    
    setDeniedMessage(message);
    setIsSpeechPlaying(true);
    
    // Web Speech API를 사용한 음성 메시지 - iOS 호환성 개선
    if ('speechSynthesis' in window && isSpeechEnabled) {
      // iOS에서 음성 로드 완료 대기
      const waitForVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('🎙️ 사용 가능한 음성:', voices.length, '개');
        
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0; // iOS에서 안정적인 속도
        utterance.pitch = 0.8;
        utterance.volume = 1.0;
        
        // 현재 utterance 참조 저장
        currentUtteranceRef.current = utterance;
        
        // iOS에서 한국어 음성 선택 시도
        const koreaVoice = voices.find(voice => 
          voice.lang.includes('ko') || 
          voice.name.includes('Korea') || 
          voice.name.includes('Korean')
        );
        
        if (koreaVoice) {
          utterance.voice = koreaVoice;
          console.log('🇰🇷 한국어 음성 선택:', koreaVoice.name);
        } else {
          console.log('⚠️ 한국어 음성 없음, 기본 음성 사용');
        }
        
        utterance.onstart = () => {
          console.log('✅ 음성 재생 시작:', message);
          setIsSpeechPlaying(true);
        };
        
        utterance.onerror = (event) => {
          console.log(`❌ 음성 오류 (${event.error}):`, message);
          setIsSpeechPlaying(false);
          currentUtteranceRef.current = null;
          
          if (event.error === 'interrupted') {
            console.warn('⚠️ 음성 재생 중단됨 (정상적인 중단)');
          } else if (event.error === 'not-allowed') {
            console.error('❌ 음성 재생 권한 없음 - 다시 터치해주세요');
            setIsSpeechEnabled(false); // 권한 재요청 필요
          } else {
            // iOS에서 실패 시 재시도 (단, 현재 utterance가 여전히 유효한 경우만)
            if (currentUtteranceRef.current === utterance) {
              setTimeout(() => {
                console.log('🔄 음성 재생 재시도...');
                try {
                  window.speechSynthesis.speak(utterance);
                } catch (retryError) {
                  console.error('❌ 재시도도 실패:', retryError);
                  setIsSpeechPlaying(false);
                  currentUtteranceRef.current = null;
                }
              }, 200);
            }
          }
        };
        
        utterance.onend = () => {
          console.log('✅ 음성 재생 완료');
          setIsSpeechPlaying(false);
          currentUtteranceRef.current = null;
          speechTimeoutRef.current = null;
        };
        
        // iOS에서 안전한 재생
        try {
          console.log('🎵 음성 재생 시작 시도:', message.substring(0, 20) + '...');
          window.speechSynthesis.speak(utterance);
          
          // iOS에서 즉시 재생되지 않는 경우 체크
          setTimeout(() => {
            if (currentUtteranceRef.current === utterance && 
                !window.speechSynthesis.speaking && 
                !window.speechSynthesis.pending) {
              console.log('🔄 음성이 시작되지 않음 - 재시도');
              window.speechSynthesis.speak(utterance);
            }
          }, 300);
        } catch (error) {
          console.error('❌ 음성 재생 실패:', error);
          setIsSpeechPlaying(false);
          currentUtteranceRef.current = null;
          speechTimeoutRef.current = null;
        }
      };
      
      // iOS에서 음성 로드 대기
      speechTimeoutRef.current = setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          waitForVoices();
        } else {
          // 음성이 아직 로드되지 않았다면 이벤트 대기
          window.speechSynthesis.onvoiceschanged = () => {
            console.log('🎙️ 음성 로드 완료');
            waitForVoices();
            window.speechSynthesis.onvoiceschanged = null;
          };
          
          // 백업: 2초 후 강제 실행
          setTimeout(() => {
            console.log('⏰ 음성 로드 타임아웃 - 강제 실행');
            waitForVoices();
          }, 2000);
        }
      }, 100); // iOS에서 중단 완료 대기
      
    } else {
      if (!isSpeechEnabled) {
        console.warn('⚠️ 음성이 활성화되지 않음 - 화면을 터치해주세요');
      } else {
        console.warn('⚠️ Web Speech API가 지원되지 않습니다.');
      }
      setIsSpeechPlaying(false);
    }
  }, [isSpeechEnabled, isSpeechPlaying, stopSpeech]);

  // 감정 개찰구 로직
  const processEmotionGate = useCallback((score: number) => {
    const NEGATIVE_THRESHOLD = -10; // 부정적 감정 임계값
    const POSITIVE_THRESHOLD = 20;  // 긍정적 감정 임계값
    
    if (score <= NEGATIVE_THRESHOLD) {
      if (gateStatus !== 'denied' && gateStatus !== 'locked') {
        setGateStatus('denied');
        playDeniedMessage('감정이 불안정하신 것 같아요. 웃어주세요!');
        
        // 3초 후 락 상태로 전환
        lockTimeoutRef.current = setTimeout(() => {
          // 2단계 더 극한 경고 메시지 먼저 재생
          playDeniedMessage('시스템 오류가 발생했습니다. 감정 불안정이 감지되어 출입이 일시적으로 제한됩니다.');
          
          // 음성과 동시에 락 상태와 타이머 설정 (동시 업데이트)
          setGateStatus('locked');
          setLockTimer(5); // 5초 카운트다운
        }, 3000);
      }
    } else if (score >= POSITIVE_THRESHOLD) {
      if (gateStatus !== 'approved') {
        // 감정이 개선되면 즉시 음성 중단 (denied/locked 상태에서)
        console.log(`✅ 감정 개선 감지 (${score.toFixed(1)}%) - 음성 즉시 중단`);
        stopSpeech('감정 개선됨');
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('approved');
        setLockTimer(0);
        
        // 출입 허가 음성 메시지
        if ('speechSynthesis' in window && isSpeechEnabled) {
          const approvalUtterance = new SpeechSynthesisUtterance('감정 상태가 적절합니다. 시민 출입을 허가합니다. 건전한 하루 되세요.');
          approvalUtterance.lang = 'ko-KR';
          approvalUtterance.rate = 0.9;
          approvalUtterance.pitch = 1.0;
          window.speechSynthesis.speak(approvalUtterance);
        }
      }
    } else {
      if (gateStatus === 'approved' || gateStatus === 'denied' || gateStatus === 'locked') {
        // 중립 상태로 변경 시에도 음성 중단
        console.log(`⚠️ 중립 상태 감지 (${score.toFixed(1)}%) - 음성 중단`);
        stopSpeech('중립 상태');
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('analyzing');
        setLockTimer(0);
      }
    }
  }, [gateStatus, playDeniedMessage, stopSpeech, isSpeechEnabled]);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    cleanupVideo();
    cleanupDeepAR();
    
    // 강화된 음성 중단
    stopSpeech('컴포넌트 정리');
    
    // 락 타이머 정리
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
  }, [stopDetectionInterval, cleanupVideo, cleanupDeepAR, stopSpeech]);

  // Effects
  useEffect(() => {
    console.log('컴포넌트 마운트됨');
    updateDimensions();
    loadModels();
    
    // 시민ID 생성 (클라이언트에서만)
    setCitizenId(Date.now().toString().slice(-6));
    
    // 간단한 지연 후 비디오 시작
    setTimeout(() => {
      console.log('지연 후 비디오 시작 시도');
      startVideo();
    }, 1000);
    
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isModelLoaded && isCameraReady && !isScreenshotQRVisible) {
      console.log('🔍 감정 감지 시작');
      startDetectionInterval();
    } else {
      if (isScreenshotQRVisible) {
        console.log('📸 스크린샷 모달 열림 - 감정 감지 중지');
      }
      stopDetectionInterval();
    }
    
    return stopDetectionInterval;
  }, [isModelLoaded, isCameraReady, isScreenshotQRVisible, startDetectionInterval, stopDetectionInterval]);

  useEffect(() => {
    updateDeepARCanvasSize();
  }, [updateDeepARCanvasSize]);

  // 감정 스코어 변화에 따른 개찰구 처리
  useEffect(() => {
    if (emotionScore !== null && isModelLoaded && isCameraReady && !isScreenshotQRVisible) {
      processEmotionGate(emotionScore);
    }
  }, [emotionScore, isModelLoaded, isCameraReady, isScreenshotQRVisible, processEmotionGate]);

  // DeepAR 로드 시 초기 설정
  useEffect(() => {
    if (isDeepARLoaded && !isInitializedRef.current) {
      isInitializedRef.current = true;
      console.log('DeepAR 초기화 완료 - 모든 효과 제거');
      
      // 초기에 모든 효과 제거하여 깔끔한 상태로 시작
      setTimeout(() => {
        applyEffect(null);
      }, 500);
    }
  }, [isDeepARLoaded, applyEffect]);

  // 감정 개찰구 시스템에 따른 자동 효과 적용
  useEffect(() => {
    if (!isDeepARLoaded || !emotionScore || isScreenshotQRVisible) {
      // 모달이 열렸을 때는 효과 적용 중지
      if (isScreenshotQRVisible) {
        console.log('📸 스크린샷 모달 열림 - 효과 적용 중지');
      }
      return;
    }
    
    // 스코어 값 검증 (-100~100 범위 확인)
    if (emotionScore < -100 || emotionScore > 100) {
      console.warn(`비정상적인 감정 점수: ${emotionScore}, 무시됨`);
      return;
    }

    // 100점 달성 감지 로직
    if (emotionScore >= 100 && lastScoreRef.current < 100 && !hasReached100) {
      console.log('🎉 100점 달성! 스크린샷 QR 모달 표시');
      setHasReached100(true);
      setIsScreenshotQRVisible(true);
      
      // 축하 효과나 소리 등 추가 가능
      if ('speechSynthesis' in window && isSpeechEnabled) {
        const congratsUtterance = new SpeechSynthesisUtterance('완벽한 미소입니다! 스크린샷이 촬영되었습니다!');
        congratsUtterance.lang = 'ko-KR';
        congratsUtterance.rate = 0.9;
        congratsUtterance.pitch = 1.2;
        window.speechSynthesis.speak(congratsUtterance);
      }
    }
    
    // 점수가 90 아래로 떨어지면 100점 달성 상태 리셋 (재도전 허용)
    if (emotionScore < 90 && hasReached100) {
      setHasReached100(false);
      console.log('📊 점수 하락으로 100점 달성 상태 리셋');
    }
    
    // 이전 점수 저장
    lastScoreRef.current = emotionScore;
    
    // 안정적인 디바운싱을 위한 타이머
    const debounceTimer = setTimeout(() => {
      // 감정 점수를 -1~1 범위로 정규화 (-100~100 -> -1~1)
      const normalizedEmotion = Math.max(-100, Math.min(100, emotionScore)) / 100;
      
      if (normalizedEmotion < -0.2) {
        // 매우 부정적 감정 - 진입 허가하지만 효과 없음
        if (activeEffect === 'beauty') {
          console.log(`😔 매우 부정적 (${emotionScore.toFixed(1)}%) - 진입 허가, 효과 제거`);
          applyEffect(null);
        }
      } else if (normalizedEmotion >= -0.2 && normalizedEmotion < 0.1) {
        // 부정적 감정 - 입장 거부 및 왜곡 효과
        if (activeEffect !== 'beauty' || Math.abs(Date.now() % 5000) < 100) { // 5초마다 로그
          console.log(`🚫 감정 불안정 (${emotionScore.toFixed(1)}%) - 입장 거부, 왜곡 효과 적용`);
        }
        applyEffect('beauty', normalizedEmotion);
      } else if (normalizedEmotion >= 0.1 && normalizedEmotion < 0.4) {
        // 중립 감정 - 관찰 모드 (효과 없음)
        if (activeEffect === 'beauty') {
          console.log(`⚠️ 감정 상태 확인 중 (${emotionScore.toFixed(1)}%) - 대기 모드, 효과 제거`);
          applyEffect(null);
        }
      } else {
        // 긍정적 감정 - 입장 허가 (효과 없음)
        if (activeEffect === 'beauty') {
          console.log(`✅ 감정 안정적 (${emotionScore.toFixed(1)}%) - 입장 허가, 효과 제거`);
          applyEffect(null);
        }
      }
    }, 200); // 200ms 디바운싱으로 반응성 향상
    
    return () => clearTimeout(debounceTimer);
  }, [emotionScore, isDeepARLoaded, activeEffect, applyEffect, hasReached100, isSpeechEnabled, isScreenshotQRVisible]);

  // 락 타이머 카운트다운
  useEffect(() => {
    if (lockTimer > 0) {
      const timer = setTimeout(() => {
        setLockTimer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (lockTimer === 0 && gateStatus === 'locked') {
      setGateStatus('analyzing');
    }
  }, [lockTimer, gateStatus]);

  // iOS 음성 디버깅용 useEffect
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // 음성 목록 로드 모니터링
      const logVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('🎙️ 음성 목록 업데이트:', {
          count: voices.length,
          korean: voices.filter(v => v.lang.includes('ko')).length,
          default: voices.filter(v => v.default).length,
          local: voices.filter(v => v.localService).length
        });
        
        if (voices.length > 0) {
          const koreanVoices = voices.filter(v => v.lang.includes('ko'));
          if (koreanVoices.length > 0) {
            console.log('🇰🇷 한국어 음성 발견:', koreanVoices.map(v => `${v.name} (${v.lang})`));
          }
        }
      };
      
      // 초기 음성 체크
      logVoices();
      
      // 음성 변경 이벤트 모니터링
      window.speechSynthesis.onvoiceschanged = logVoices;
      
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, []);

  // 게이트 상태에 따른 스타일 결정
  const getGateStyles = () => {
    switch (gateStatus) {
      case 'denied':
        return {
          overlay: 'bg-red-500 bg-opacity-30',
          border: 'border-red-500 border-4',
          filter: 'contrast(120%) saturate(150%) hue-rotate(10deg)'
        };
      case 'locked':
        return {
          overlay: 'bg-red-700 bg-opacity-50',
          border: 'border-red-700 border-8 animate-pulse',
          filter: 'contrast(150%) saturate(200%) hue-rotate(20deg) blur(1px)'
        };
      case 'approved':
        return {
          overlay: 'bg-green-500 bg-opacity-20',
          border: 'border-green-500 border-2',
          filter: 'contrast(110%) saturate(120%) brightness(110%)'
        };
      default:
        return {
          overlay: 'bg-blue-500 bg-opacity-10',
          border: 'border-blue-300 border-2',
          filter: 'none'
        };
    }
  };

  const gateStyles = getGateStyles();

  return (
    <div 
      className="w-screen h-screen overflow-hidden relative" 
      ref={containerRef}
      onTouchStart={enableSpeechOnTouch}
      onClick={enableSpeechOnTouch}
    >
      <Head>
        <title>감정 조응 도시 - The Compliance of Happiness</title>
        <meta name="description" content="감정 인식 기반 출입 통제 시스템. 모든 시민의 행복을 위한 과학적 감정 관리." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 개찰구 프레임 */}
      <div className={`absolute inset-0 z-10 ${gateStyles.border} pointer-events-none`}>
        {/* 상단 헤더 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-b-lg border-2 border-gray-700 shadow-lg">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-1">🚇 감정 조응 도시</h1>
            <div className={`text-sm font-medium ${
              gateStatus === 'analyzing' ? 'text-blue-300' :
              gateStatus === 'approved' ? 'text-green-300' :
              gateStatus === 'denied' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              {gateStatus === 'analyzing' && '📊 감정 스캔 중...'}
              {gateStatus === 'approved' && '✅ 시민 출입 허가됨'}
              {gateStatus === 'denied' && '⚠️ 감정 부적절 - 출입 거부'}
              {gateStatus === 'locked' && `🔒 출입 일시 제한 (${lockTimer}초)`}
            </div>
          </div>
        </div>

        {/* 좌우 기둥 */}
        <div className="absolute left-0 top-1/4 w-8 h-1/2 bg-gray-800 border-r-2 border-gray-600"></div>
        <div className="absolute right-0 top-1/4 w-8 h-1/2 bg-gray-800 border-l-2 border-gray-600"></div>

        {/* 하단 바 */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2/3 h-4 bg-gray-800 border-2 border-gray-600 rounded-t-lg">
          <div className={`h-full rounded-t-lg transition-colors duration-300 ${
            gateStatus === 'approved' ? 'bg-green-500' :
            gateStatus === 'denied' ? 'bg-yellow-500' :
            gateStatus === 'locked' ? 'bg-red-500' :
            'bg-blue-500'
          }`}>
            {/* LED 표시등 */}
            <div className="flex justify-center items-center h-full space-x-1">
              {[...Array(8)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-1 h-1 rounded-full ${
                    gateStatus === 'approved' ? 'bg-green-200' :
                    gateStatus === 'denied' ? 'bg-yellow-200' :
                    gateStatus === 'locked' ? 'bg-red-200 animate-pulse' :
                    'bg-blue-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 감정 기반 왜곡 오버레이 */}
      <EmotionGateOverlay gateStatus={gateStatus} lockTimer={lockTimer} />

      {/* 상태 오버레이 */}
      <div className={`absolute inset-0 z-5 ${gateStyles.overlay} pointer-events-none transition-all duration-500`} />

      {/* AR 효과 상태 표시 */}
      <div className="fixed top-4 right-4 z-50">
        <AREffectButtons
          isDeepARLoaded={isDeepARLoaded}
          activeEffect={activeEffect}
        />
      </div>

      {/* 스코어 표시 */}
      <Score 
        score={emotionScore}
      />

      {/* 음성 상태 표시기 */}
      <div className="absolute top-4 right-4 z-50">
        <div className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all duration-300 ${
          !isSpeechEnabled 
            ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-xl'
            : isSpeechPlaying
            ? 'bg-orange-500 text-white border-orange-400 animate-pulse shadow-lg'
            : 'bg-green-500 text-white border-green-400 shadow-lg'
        }`}>
          {!isSpeechEnabled ? (
            <div className="flex flex-col items-center space-y-1">
              <div className="flex items-center space-x-2">
                <span>🔇</span>
                <span>음성 비활성</span>
              </div>
              <div className="text-xs opacity-90">화면 터치 필요</div>
            </div>
          ) : isSpeechPlaying ? (
            <div className="flex items-center space-x-2">
              <span>🎵</span>
              <span>음성 재생 중</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>🔊</span>
              <span>음성 대기</span>
            </div>
          )}
        </div>
      </div>

      <main className="relative w-full h-full bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            objectPosition: 'center top',
            opacity: videoOpacity,
            zIndex: '0',
            filter: gateStyles.filter,
            transition: 'filter 0.3s ease-in-out'
          }}
        />
        
        {/* DeepAR 캔버스 */}
        <canvas
          ref={deepARCanvasRef}
          style={{
            display: isDeepARLoaded ? 'block' : 'none',
            filter: gateStyles.filter,
            transition: 'filter 0.3s ease-in-out'
          }}
        />
        
        {/* Face API 캔버스 - 표정 감지용으로만 사용, 화면에 표시하지 않음 */}
        <canvas
          ref={faceAPICanvasRef}
          style={{
            display: 'none'
          }}
        />
        
        {/* 거부 메시지 표시 - 화면 하단 중앙 정렬 */}
        {deniedMessage && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center pb-20 pointer-events-none">
            <div className="bg-red-600 text-white px-8 py-4 rounded-lg text-center max-w-md animate-bounce shadow-2xl border-2 border-red-400 pointer-events-auto">
              <div className="flex items-center justify-center space-x-2">
                <span className="text-2xl">🚨</span>
                <p className="text-lg font-semibold">{deniedMessage}</p>
              </div>
              <div className="text-xs mt-2 opacity-90">
                시민 행복 지수 향상을 위해 협조해주세요
              </div>
            </div>
          </div>
        )}
        
        {/* 시스템 상태 표시 */}
        <div className="fixed bottom-4 left-4 z-40 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
          <div>감정 점수: {emotionScore?.toFixed(1) || '스캔중'}</div>
          <div>시스템: {isModelLoaded && isCameraReady ? '온라인' : '오프라인'}</div>
          <div className="text-xs text-blue-300">시민ID: {citizenId}</div>
        </div>
        
        <LoadingMessages
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          isDeepARLoaded={isDeepARLoaded}
        />
      </main>

      {/* 100점 달성 시 스크린샷 QR 모달 */}
      <ScreenshotQR
        isVisible={isScreenshotQRVisible}
        videoRef={videoRef}
        deepARCanvasRef={deepARCanvasRef}
        takeDeepARScreenshot={takeDeepARScreenshot}
        onClose={() => setIsScreenshotQRVisible(false)}
      />
    </div>
  );
} 