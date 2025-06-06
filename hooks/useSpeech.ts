import { useState, useRef, useCallback } from 'react';
import { SPEECH_CONFIG } from '../constants/emotionGate';

export function useSpeech() {
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(false);
  const [isSpeechPlaying, setIsSpeechPlaying] = useState<boolean>(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 음성 시스템 초기화 및 권한 획득
  const enableSpeech = useCallback(() => {
    console.log('🧪 즉시 테스트 음성 재생 시도');
    if ('speechSynthesis' in window) {
      const testMsg = new SpeechSynthesisUtterance('테스트');
      testMsg.volume = 1.0;
      testMsg.rate = 1.0;
      testMsg.lang = SPEECH_CONFIG.LANG;
      
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

      try {
        const initialVoices = window.speechSynthesis.getVoices();
        console.log('🎙️ 초기 음성 목록:', initialVoices.length, '개');
        
        const testSpeech = () => {
          const testUtterance = new SpeechSynthesisUtterance('안녕');
          testUtterance.volume = 0.01;
          testUtterance.rate = 3.0;
          testUtterance.lang = SPEECH_CONFIG.LANG;
          
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
          window.speechSynthesis.onvoiceschanged = () => {
            console.log('✅ 음성 목록 로드 완료');
            testSpeech();
            window.speechSynthesis.onvoiceschanged = null;
          };
          setTimeout(testSpeech, 3000);
        } else {
          testSpeech();
        }
        
      } catch (error) {
        console.error('❌ 음성 초기화 실패:', error);
        setIsSpeechEnabled(true);
      }
    }
  }, [isSpeechEnabled]);

  // 음성 중단 함수
  const stopSpeech = useCallback((reason: string = '사용자 요청') => {
    console.log(`🔇 음성 중단 시도: ${reason}`);
    
    if (isSpeechPlaying && reason === '중립 상태' && currentUtteranceRef.current) {
      console.log('⏳ 음성 재생 중 - 중립 상태 중단을 3초 지연');
      setTimeout(() => {
        if (isSpeechPlaying && currentUtteranceRef.current) {
          console.log('🔇 지연된 음성 중단 실행');
          performSpeechStop(reason);
        }
      }, 3000);
      return;
    }
    
    if (reason === '감정 개선됨' || reason === '새 음성 재생 준비' || reason === '사용자 요청') {
      performSpeechStop(reason);
    } else {
      performSpeechStop(reason);
    }
  }, [isSpeechPlaying]);

  const performSpeechStop = useCallback((reason: string) => {
    setIsSpeechPlaying(false);
    
    if (currentUtteranceRef.current) {
      currentUtteranceRef.current = null;
    }
    
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        
        setTimeout(() => {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            console.log('🔄 음성이 아직 재생 중 - 강제 중단 재시도');
            window.speechSynthesis.cancel();
            
            setTimeout(() => {
              try {
                window.speechSynthesis.cancel();
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

  // 음성 메시지 재생
  const playMessage = useCallback((message: string) => {
    console.log('🎵 음성 메시지 재생:', message.substring(0, 30) + '...');
    
    if (isSpeechPlaying) {
      console.log('🔄 기존 음성 중단 후 새 음성 재생');
      stopSpeech('새 음성 재생 준비');
    }
    
    if (!isSpeechEnabled) {
      console.warn('⚠️ 음성이 비활성화됨 - 화면을 터치해주세요');
      return message;
    }
    
    setIsSpeechPlaying(true);
    
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(message);
      
      utterance.lang = SPEECH_CONFIG.LANG;
      utterance.rate = SPEECH_CONFIG.RATE;
      utterance.pitch = SPEECH_CONFIG.PITCH;
      utterance.volume = SPEECH_CONFIG.VOLUME;
      
      currentUtteranceRef.current = utterance;
      
      const koreaVoice = voices.find(voice => 
        voice.name.includes('유나') || 
        voice.name.includes('Yuna') ||
        voice.lang.includes('ko')
      );
      
      if (koreaVoice) {
        utterance.voice = koreaVoice;
        console.log('🇰🇷 한국어 음성 선택:', koreaVoice.name);
      }

      utterance.onstart = () => {
        console.log('✅ 음성 재생 시작');
        setIsSpeechPlaying(true);
      };
      
      utterance.onerror = (event) => {
        console.error(`❌ 음성 오류 (${event.error})`);
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
        
        if (event.error === 'not-allowed') {
          setIsSpeechEnabled(false);
        }
      };

      utterance.onend = () => {
        console.log('✅ 음성 재생 완료');
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
        speechTimeoutRef.current = null;
      };
      
      try {
        const actuallyPlaySpeech = () => {
          window.speechSynthesis.speak(utterance);
        };
        
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          console.log('🔄 이전 음성 중단 중...');
          window.speechSynthesis.cancel();
          
          const waitForComplete = () => {
            setTimeout(() => {
              if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                window.speechSynthesis.cancel();
                waitForComplete();
              } else {
                actuallyPlaySpeech();
              }
            }, 200);
          };
          
          waitForComplete();
        } else {
          actuallyPlaySpeech();
        }
        
      } catch (error) {
        console.error('❌ 음성 재생 실패:', error);
        setIsSpeechPlaying(false);
        currentUtteranceRef.current = null;
      }
    }
    
    return message;
  }, [isSpeechEnabled, isSpeechPlaying, stopSpeech]);

  // 승인 음성 재생
  const playApprovalMessage = useCallback((message: string) => {
    if ('speechSynthesis' in window && isSpeechEnabled) {
      const approvalUtterance = new SpeechSynthesisUtterance(message);
      approvalUtterance.lang = SPEECH_CONFIG.LANG;
      approvalUtterance.rate = SPEECH_CONFIG.APPROVAL_RATE;
      approvalUtterance.pitch = SPEECH_CONFIG.APPROVAL_PITCH;
      window.speechSynthesis.speak(approvalUtterance);
    }
  }, [isSpeechEnabled]);

  // 정리 함수
  const cleanup = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
  }, []);

  return {
    isSpeechEnabled,
    isSpeechPlaying,
    enableSpeech,
    stopSpeech,
    playMessage,
    playApprovalMessage,
    cleanup
  };
} 