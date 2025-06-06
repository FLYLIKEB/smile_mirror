import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Head from 'next/head';
import Score from '../components/Score';
import AREffectButtons from '../components/AREffectButtons';
import LoadingMessages from '../components/LoadingMessages';
import EmotionGateOverlay from '../components/EmotionGateOverlay';
import FutureAccessModal from '../components/FutureAccessModal';
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

  // 감정 처리 디바운싱을 위한 상태 추가
  const emotionProcessingRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmotionChangeRef = useRef<number>(Date.now());
  const isProcessingEmotionRef = useRef<boolean>(false);

  // 시민ID 상태 관리 (hydration 오류 방지)
  const [citizenId, setCitizenId] = useState<string>('------');

  // 미래형 출입 허용 팝업 상태 관리
  const [showAccessModal, setShowAccessModal] = useState<boolean>(false);
  const [lastApprovalTime, setLastApprovalTime] = useState<number>(0);
  const accessModalTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 클라이언트 측에서만 시민ID 생성
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const randomId = `SM${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      setCitizenId(randomId);
    }
  }, []);

  // 정리 함수
  const cleanup = useCallback(() => {
    stopDetectionInterval();
    cleanupVideo();
    cleanupDeepAR();
    
    // 음성 중단
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // 락 타이머 정리
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    
    // 팝업 타이머 정리
    if (accessModalTimeoutRef.current) {
      clearTimeout(accessModalTimeoutRef.current);
      accessModalTimeoutRef.current = null;
    }
  }, [stopDetectionInterval, cleanupVideo, cleanupDeepAR]);

  // Effects
  useEffect(() => {
    console.log('컴포넌트 마운트됨');
    updateDimensions();
    loadModels();
    
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
    if (isModelLoaded && isCameraReady) {
      console.log('🔍 감정 감지 시작');
      startDetectionInterval();
    } else {
      stopDetectionInterval();
    }
    
    return stopDetectionInterval;
  }, [isModelLoaded, isCameraReady, startDetectionInterval, stopDetectionInterval]);

  useEffect(() => {
    updateDeepARCanvasSize();
  }, [updateDeepARCanvasSize]);

  // iOS에서 사용자 터치 시 음성 활성화
  const enableSpeechOnTouch = useCallback(() => {
    // 즉시 간단한 테스트 음성 재생
    console.log('🧪 즉시 테스트 음성 재생 시도');
    if ('speechSynthesis' in window) {
      const testMsg = new SpeechSynthesisUtterance('테스트');
      testMsg.volume = 1.0;
      testMsg.rate = 1.0;
      testMsg.lang = 'ko-KR';
      
      testMsg.onstart = () => console.log('🔊 테스트 음성 시작됨');
      testMsg.onend = () => console.log('✅ 테스트 음성 완료됨');
      testMsg.onerror = (e) => console.error('❌ 테스트 음성 오류:', e.error);
      
      window.speechSynthesis.speak(testMsg);
    }
    
    if (!isSpeechEnabled && 'speechSynthesis' in window) {
      // 디바이스 정보 로깅
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent);
      const isChrome = /Chrome/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
      
      console.log('📱 디바이스 정보:', {
        isIOS,
        isMac,
        isChrome,
        isSafari,
        userAgent: navigator.userAgent,
        speechSynthesis: !!window.speechSynthesis,
        voices: window.speechSynthesis?.getVoices?.()?.length || 0,
        platform: navigator.platform
      });

      // 추가 음성 시스템 정보
      console.log('🎙️ 상세 음성 시스템 정보:', {
        speechSynthesisReady: window.speechSynthesis ? true : false,
        speaking: window.speechSynthesis?.speaking || false,
        pending: window.speechSynthesis?.pending || false,
        paused: window.speechSynthesis?.paused || false,
        getVoicesLength: window.speechSynthesis?.getVoices?.()?.length || 0
      });

      // 맥북 크롬용 강화된 음성 권한 획득
      try {
        // 먼저 음성 목록 확인
        const initialVoices = window.speechSynthesis.getVoices();
        console.log('🎙️ 초기 음성 목록:', initialVoices.length, '개');
        
        // 음성 테스트 함수
        const testSpeech = () => {
          const testUtterance = new SpeechSynthesisUtterance('안녕');
          testUtterance.volume = 0.01;
          testUtterance.rate = 3.0;
          testUtterance.lang = 'ko-KR';
          
          const voices = window.speechSynthesis.getVoices();
          const koreaVoice = voices.find(voice => 
            voice.lang.includes('ko') || 
            voice.name.includes('Yuna') || 
            voice.name.includes('지연')
          );
          
          if (koreaVoice) {
            testUtterance.voice = koreaVoice;
            console.log('🇰🇷 한국어 음성 선택:', koreaVoice.name);
          }

          let permissionGranted = false;

          testUtterance.onstart = () => {
            console.log('✅ 음성 권한 획득 성공');
            permissionGranted = true;
            setIsSpeechEnabled(true);
          };
          
          testUtterance.onerror = (event) => {
            if (event.error === 'canceled') {
              console.log('⚠️ 테스트 음성 중단됨 - 권한은 획득됨');
            } else if (event.error === 'not-allowed') {
              console.error('🚫 음성 권한 거부됨');
              alert('음성 권한이 필요합니다. 브라우저 설정을 확인해주세요.');
              return;
            }
            setIsSpeechEnabled(true);
            permissionGranted = true;
          };

          testUtterance.onend = () => {
            console.log('✅ 음성 테스트 완료');
            if (!permissionGranted) {
              setIsSpeechEnabled(true);
            }
          };
          
          console.log('🎵 음성 테스트 시작...');
          window.speechSynthesis.speak(testUtterance);
          
          setTimeout(() => {
            if (!permissionGranted) {
              console.log('⏰ 타이머로 음성 활성화');
              setIsSpeechEnabled(true);
            }
          }, 2000);
        };
        
        if (initialVoices.length === 0) {
          // 음성 목록 로딩 대기
          window.speechSynthesis.onvoiceschanged = () => {
            console.log('✅ 음성 목록 로드 완료');
            testSpeech();
            window.speechSynthesis.onvoiceschanged = null;
          };
          setTimeout(testSpeech, 3000); // 백업 타이머
        } else {
          testSpeech();
        }
        
      } catch (error) {
        console.error('❌ 음성 초기화 실패:', error);
        setIsSpeechEnabled(true);
      }
    } else if (isSpeechEnabled) {
      console.log('🔊 음성이 이미 활성화되어 있습니다.');
    } else {
      console.error('❌ Web Speech API가 지원되지 않습니다.');
    }
  }, [isSpeechEnabled]);

  // 강화된 음성 중단 함수
  const stopSpeech = useCallback((reason: string = '사용자 요청') => {
    console.log(`🔇 음성 중단 시도: ${reason}`);
    
    // 음성이 재생 중이고 중립 상태 변화로 인한 중단이라면 잠시 대기
    if (isSpeechPlaying && reason === '중립 상태' && currentUtteranceRef.current) {
      console.log('⏳ 음성 재생 중 - 중립 상태 중단을 3초 지연');
      setTimeout(() => {
        // 3초 후에도 여전히 중립이고 음성이 재생 중이면 중단
        if (isSpeechPlaying && currentUtteranceRef.current) {
          console.log('🔇 지연된 음성 중단 실행');
          performSpeechStop(reason);
        }
      }, 3000);
      return;
    }
    
    // 즉시 중단이 필요한 경우들
    if (reason === '감정 개선됨' || reason === '새 음성 재생 준비' || reason === '사용자 요청') {
      performSpeechStop(reason);
    } else {
      // 기타 경우는 즉시 중단
      performSpeechStop(reason);
    }
  }, [isSpeechPlaying]);

  const performSpeechStop = useCallback((reason: string) => {
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
    console.log('🎵 playDeniedMessage 호출됨:', message.substring(0, 30) + '...');
    console.log('🔊 현재 음성 상태:', { isSpeechEnabled, isSpeechPlaying });
    
    // Audio 컨텍스트 테스트 (백업 시스템)
    try {
      console.log('🎵 Audio 컨텍스트 테스트 시작');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.1;
      oscillator.frequency.value = 440; // A4 음
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
      
      console.log('✅ Audio 컨텍스트 테스트 성공');
    } catch (audioError) {
      console.error('❌ Audio 컨텍스트 테스트 실패:', audioError);
    }
    
    // 이미 재생 중이면 먼저 중단
    if (isSpeechPlaying) {
      console.log('🔄 기존 음성 중단 후 새 음성 재생');
      stopSpeech('새 음성 재생 준비');
    }
    
    // 음성이 비활성화되어 있으면 터치 안내
    if (!isSpeechEnabled) {
      console.warn('⚠️ 음성이 비활성화됨 - 화면을 터치해주세요');
      setDeniedMessage(message);
      return;
    }
    
    setDeniedMessage(message);
    setIsSpeechPlaying(true);
    
    // Web Speech API를 사용한 음성 메시지 - 맥북 크롬 최적화
    if ('speechSynthesis' in window) {
      console.log('🎙️ Web Speech API 사용 가능');
      
      // 즉시 음성 재생 시도
      const voices = window.speechSynthesis.getVoices();
      console.log('🎙️ 사용 가능한 음성:', voices.length, '개');
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'ko-KR';
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.volume = 1.0;
      
      // 현재 utterance 참조 저장
      currentUtteranceRef.current = utterance;
      
      // 한국어 음성 선택 (맥북에서 유나 우선)
      const koreaVoice = voices.find(voice => 
        voice.name.includes('유나') || 
        voice.name.includes('Yuna') ||
        voice.lang.includes('ko')
      );
      
      if (koreaVoice) {
        utterance.voice = koreaVoice;
        console.log('🇰🇷 한국어 음성 선택:', koreaVoice.name);
      } else {
        console.log('⚠️ 한국어 음성 없음, 기본 음성 사용');
      }

      utterance.onstart = () => {
        console.log('✅ 음성 재생 시작:', message.substring(0, 20) + '...');
        setIsSpeechPlaying(true);
      };
      
      utterance.onerror = (event) => {
        console.error(`❌ 음성 오류 (${event.error}):`, message.substring(0, 30) + '...');
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
        
        if (event.error === 'not-allowed') {
          console.error('❌ 음성 재생 권한 없음 - 다시 터치해주세요');
          setIsSpeechEnabled(false);
        } else if (event.error === 'canceled') {
          console.warn('⚠️ 음성 재생 중단됨 (정상적인 중단)');
        } else {
          console.error('❓ 알 수 없는 음성 오류:', event.error);
        }
      };

      utterance.onend = () => {
        console.log('✅ 음성 재생 완료');
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
        speechTimeoutRef.current = null;
      };
      
      // 맥북 크롬에서 안전한 재생
      try {
        console.log('🎵 음성 재생 시작 시도:', message.substring(0, 20) + '...');
        
        // 실제 음성 재생 함수
        const actuallyPlaySpeech = () => {
          window.speechSynthesis.speak(utterance);
          
          // 재생 확인을 더 자주 체크
          let checkCount = 0;
          const checkInterval = setInterval(() => {
            checkCount++;
            console.log(`🔍 음성 재생 상태 체크 #${checkCount}:`, {
              speaking: window.speechSynthesis.speaking,
              pending: window.speechSynthesis.pending,
              paused: window.speechSynthesis.paused
            });
            
            if (window.speechSynthesis.speaking) {
              console.log('✅ 음성 재생 확인됨 - 모니터링 중단');
              clearInterval(checkInterval);
            } else if (checkCount >= 5) {
              console.log('❌ 음성 재생 실패 - 재시도');
              window.speechSynthesis.speak(utterance);
              clearInterval(checkInterval);
            }
          }, 200);
        };
        
        // 이전 음성이 있다면 완전히 정리하고 충분히 기다림
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          console.log('🔄 이전 음성 중단 중...');
          window.speechSynthesis.cancel();
          
          // 이전 음성 완전 중단 확인 후 재생
          const waitForComplete = () => {
            setTimeout(() => {
              if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                console.log('⏳ 아직 이전 음성이 중단되지 않음 - 재확인...');
                window.speechSynthesis.cancel();
                waitForComplete(); // 재귀적으로 다시 확인
              } else {
                console.log('✅ 이전 음성 완전 중단 확인 - 새 음성 재생 시작');
                actuallyPlaySpeech();
              }
            }, 200);
          };
          
          waitForComplete();
        } else {
          console.log('🎵 이전 음성 없음 - 직접 재생');
          actuallyPlaySpeech();
        }
        
      } catch (error) {
        console.error('❌ 음성 재생 실패:', error);
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
      }
    } else {
      console.error('❌ Web Speech API가 지원되지 않습니다.');
      setIsSpeechPlaying(false);
    }
  }, [isSpeechEnabled, isSpeechPlaying, stopSpeech]);

  // 락 타이머 관리
  useEffect(() => {
    if (gateStatus === 'locked' && lockTimer > 0) {
      const timer = setTimeout(() => {
        setLockTimer(prev => {
          const newTimer = prev - 1;
          if (newTimer <= 0) {
            console.log('🔓 락 해제 - 분석 모드로 복귀');
            setGateStatus('analyzing');
            return 0;
          }
          return newTimer;
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [gateStatus, lockTimer]);

  // 감정 개찰구 로직
  const processEmotionGate = useCallback((score: number) => {
    const NEGATIVE_THRESHOLD = -10; // 부정적 감정 임계값
    const POSITIVE_THRESHOLD = 12;  // 긍정적 감정 임계값 (15 → 12로 더 낮춤)
    
    // 감정 변화 시간 체크
    const now = Date.now();
    const timeSinceLastChange = now - lastEmotionChangeRef.current;
    
    // 긍정적 감정의 경우 디바운싱 시간을 짧게 (1초)
    const isPositive = score >= POSITIVE_THRESHOLD;
    const debounceTime = isPositive ? 1000 : 2000; // 긍정적 감정은 1초, 그외는 2초
    
    // 음성 재생 중일 때는 긍정적 감정만 처리 (팝업 표시 허용)
    if (isSpeechPlaying && !isPositive) {
      console.log(`🔇 음성 재생 중 - 부정적 감정 처리만 차단 (${score.toFixed(1)}%)`);
      return;
    }
    
    // 감정 처리 중이면 스킵 (디바운싱) - 단, 긍정적 감정은 예외
    if (isProcessingEmotionRef.current && !isPositive) {
      console.log(`⏳ 감정 처리 중 - 부정적 감정만 스킵 (${score.toFixed(1)}%)`);
      return;
    }
    
    if (timeSinceLastChange < debounceTime) {
      console.log(`⏳ 감정 변화 디바운싱 (${timeSinceLastChange}ms < ${debounceTime}ms)`);
      return;
    }
    
    // 처리 중 플래그 설정
    isProcessingEmotionRef.current = true;
    lastEmotionChangeRef.current = now;
    
    console.log(`🎭 감정 처리 시작: ${score.toFixed(1)}% (상태: ${gateStatus})`);
    
    if (score <= NEGATIVE_THRESHOLD) {
      if (gateStatus !== 'denied' && gateStatus !== 'locked') {
        console.log(`🚫 부정적 감정 감지 (${score.toFixed(1)}%) - denied 상태로 전환`);
        
        // 기존 타이머들 정리
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('denied');
        playDeniedMessage('감정이 불안정하신 것 같아요. 한김 식히고 오세요 :)');
        
        // 3초 후 락 상태로 전환
        lockTimeoutRef.current = setTimeout(() => {
          console.log(`⏰ 3초 경과 - 락 상태로 전환 (현재 상태: ${gateStatus})`);
          
          // 2단계 더 극한 경고 메시지 먼저 재생
          playDeniedMessage('공공안전을 위해 출입이 제한됩니다. 적절한 감정 상태로 조정 후 다시 시도해주세요.');
          
          // 음성과 동시에 락 상태와 타이머 설정 (동시 업데이트)
          setGateStatus('locked');
          setLockTimer(5); // 5초 카운트다운
        }, 3000);
      }
    } else if (score >= POSITIVE_THRESHOLD) {
      console.log(`🚀 긍정적 감정 감지 (${score.toFixed(1)}%) - 승인 처리 시작`);
      
      if (gateStatus !== 'approved') {
        // 감정이 개선되면 즉시 음성 중단 (denied/locked 상태에서)
        console.log(`✅ 감정 개선 감지 (${score.toFixed(1)}%) - 음성 즉시 중단`);
        stopSpeech('감정 개선됨');
        
        // 진행 중인 락 타이머 강제 취소 (여러 번 확인)
        if (lockTimeoutRef.current) {
          console.log('🔄 기존 락 타이머 취소 중...');
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        // 혹시 모를 추가 타이머들도 정리
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
          speechTimeoutRef.current = null;
        }
        
        // 상태 즉시 업데이트
        setGateStatus('approved');
        setLockTimer(0);
        setDeniedMessage(''); // 기존 메시지도 즉시 제거
        
        console.log(`🎉 감정 승인 완료: ${score.toFixed(1)}% - 모든 타이머 정리됨`);
      }
      
      // 팝업 표시 로직 (approved 상태와 무관하게 체크)
      const popupNow = Date.now();
      const timeSinceLastPopup = popupNow - lastApprovalTime;
      console.log(`🎭 팝업 표시 체크: 마지막 팝업으로부터 ${timeSinceLastPopup}ms 경과 (5초 = 5000ms)`);
      
      if (timeSinceLastPopup > 5000) { // 2초 → 5초로 증가
        console.log(`🎉 팝업 표시 조건 만족 - 미래형 출입 허용 팝업 표시!`);
        setLastApprovalTime(popupNow);
        setShowAccessModal(true);
        
        // 팝업이 자동으로 닫힐 때까지 기다린 후 정리
        if (accessModalTimeoutRef.current) {
          clearTimeout(accessModalTimeoutRef.current);
        }
        accessModalTimeoutRef.current = setTimeout(() => {
          setShowAccessModal(false);
        }, 6500); // 5초 유지 + 0.5초 닫기 애니메이션 + 1초 여유
        
        // 승인 음성 메시지
        if ('speechSynthesis' in window && isSpeechEnabled) {
          const approvalUtterance = new SpeechSynthesisUtterance('완벽한 미소입니다! 아름다운 하루 되세요.');
          approvalUtterance.lang = 'ko-KR';
          approvalUtterance.rate = 0.9;
          approvalUtterance.pitch = 1.0;
          window.speechSynthesis.speak(approvalUtterance);
        }
      } else {
        console.log(`⏰ 팝업 대기 중 - 아직 ${5000 - timeSinceLastPopup}ms 남음`);
      }
    } else {
      if (gateStatus === 'approved' || gateStatus === 'denied' || gateStatus === 'locked') {
        // 중립 상태로 변경 시 - 조건부 처리
        console.log(`⚠️ 중립 상태 감지 (${score.toFixed(1)}%) - 분석 모드로 전환`);
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          console.log('🔄 중립 상태 - 락 타이머 취소');
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        // 음성 중단
        stopSpeech('중립 상태');
        
        setGateStatus('analyzing');
        setLockTimer(0);
        setDeniedMessage(''); // 기존 메시지 제거
      }
    }
    
    // 처리 완료 후 플래그 해제 (긍정적 감정은 0.5초, 그외는 1초)
    const processingDelay = isPositive ? 500 : 1000;
    setTimeout(() => {
      isProcessingEmotionRef.current = false;
      console.log(`✅ 감정 처리 완료: ${score.toFixed(1)}% (${processingDelay}ms 후)`);
    }, processingDelay);
    
  }, [gateStatus, playDeniedMessage, stopSpeech, isSpeechEnabled, isSpeechPlaying]);

  // 감정 스코어 변화에 따른 개찰구 처리 - processEmotionGate 정의 후 실행
  useEffect(() => {
    if (emotionScore !== null && isModelLoaded && isCameraReady) {
      processEmotionGate(emotionScore);
    }
  }, [emotionScore, isModelLoaded, isCameraReady, processEmotionGate]);

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

  // 페이지 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 모든 타이머 정리
      if (lockTimeoutRef.current) {
        clearTimeout(lockTimeoutRef.current);
      }
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
      }
      if (emotionProcessingRef.current) {
        clearTimeout(emotionProcessingRef.current);
      }
      if (accessModalTimeoutRef.current) {
        clearTimeout(accessModalTimeoutRef.current);
      }
      
      // 음성 중단
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      
      // 플래그 초기화
      isProcessingEmotionRef.current = false;
    };
  }, []);

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
    if (!isDeepARLoaded || !emotionScore) {
      return;
    }
    
    // 스코어 값 검증 (-100~100 범위 확인)
    if (emotionScore < -100 || emotionScore > 100) {
      console.warn(`비정상적인 감정 점수: ${emotionScore}, 무시됨`);
      return;
    }
    
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
  }, [emotionScore, isDeepARLoaded, activeEffect, applyEffect, isSpeechEnabled]);

  // 캔버스 치수 계산
  const canvasDimensions: CanvasDimensions = useMemo(() => {
    if (!dimensions.width || !dimensions.height) {
      return {
        width: 640,
        height: 480,
        displayWidth: 640,
        displayHeight: 480,
        aspectRatio: 4/3
      };
    }

    const aspectRatio = dimensions.width / dimensions.height;
    
    return {
      width: dimensions.width,
      height: dimensions.height,
      displayWidth: dimensions.width,
      displayHeight: dimensions.height,
      aspectRatio
    };
  }, [dimensions]);

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
          overlay: 'bg-red-700 bg-opacity-70',
          border: 'border-red-700 border-8 animate-pulse',
          filter: 'contrast(200%) saturate(300%) hue-rotate(30deg) blur(2px) brightness(80%)'
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
        <title>HappyGate - 감정 출입 통제 시스템</title>
        <meta name="description" content="공공안전을 위한 감정 상태 검증 및 출입 통제 시스템" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 개찰구 프레임 */}
      <div className={`absolute inset-0 z-10 ${gateStyles.border} pointer-events-none`}>
        {/* 상단 헤더 */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-8 py-3 rounded-b-lg border-2 border-gray-700 shadow-lg">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-1 font-mono">🏛️ HAPPY GATE</h1>
            <div className={`text-sm font-medium font-mono ${
              gateStatus === 'analyzing' ? 'text-blue-300' :
              gateStatus === 'approved' ? 'text-green-300' :
              gateStatus === 'denied' ? 'text-yellow-300' :
              'text-red-300'
            }`}>
              {gateStatus === 'analyzing' && '🔍 생체 스캔 진행 중'}
              {gateStatus === 'approved' && '✅ 출입 허가됨'}
              {gateStatus === 'denied' && '⚠️ 감정 조정 요구됨'}
              {gateStatus === 'locked' && `🚫 출입 제한 (${lockTimer}초)`}
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
              <div className="text-xs mt-2 opacity-90 font-mono">
                시스템 지시에 따라 적절한 감정을 표현해주세요
              </div>
            </div>
          </div>
        )}
        
        {/* 시스템 상태 표시 */}
        <div className="fixed bottom-4 left-4 z-40 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm">
          <div>감정 점수: {emotionScore?.toFixed(1) || '스캔중'}</div>
          <div>시스템: {isModelLoaded && isCameraReady ? '온라인' : '오프라인'}</div>
          <div className="text-xs text-blue-300">유저ID: {citizenId}</div>
        </div>
        
        <LoadingMessages
          isModelLoaded={isModelLoaded}
          isCameraReady={isCameraReady}
          isDeepARLoaded={isDeepARLoaded}
        />
      </main>

      {/* 미래형 출입 허용 팝업 */}
      <FutureAccessModal
        isVisible={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        emotionScore={emotionScore || 0}
        citizenId={citizenId}
      />
    </div>
  );
} 