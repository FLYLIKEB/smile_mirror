import { useState, useRef, useCallback } from 'react';
import { 
  EMOTION_THRESHOLDS, 
  DEBOUNCE_TIMES, 
  TIMERS, 
  MESSAGES,
  type EmotionGateStatus 
} from '../constants/emotionGate';

interface UseEmotionGateProps {
  playMessage: (message: string) => string;
  playApprovalMessage: (message: string) => void;
  stopSpeech: (reason: string) => void;
  isSpeechPlaying: boolean;
  showAccessModal: boolean;
}

export function useEmotionGate({
  playMessage,
  playApprovalMessage,
  stopSpeech,
  isSpeechPlaying,
  showAccessModal
}: UseEmotionGateProps) {
  const [gateStatus, setGateStatus] = useState<EmotionGateStatus>('analyzing');
  const [deniedMessage, setDeniedMessage] = useState<string>('');
  const [lockTimer, setLockTimer] = useState<number>(0);
  const [lastApprovalTime, setLastApprovalTime] = useState<number>(0);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);

  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accessModalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emotionProcessingRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmotionChangeRef = useRef<number>(Date.now());
  const isProcessingEmotionRef = useRef<boolean>(false);

  // 락 타이머 관리
  const updateLockTimer = useCallback(() => {
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

  // 감정 개찰구 처리
  const processEmotionGate = useCallback((score: number) => {
    const now = Date.now();
    const timeSinceLastChange = now - lastEmotionChangeRef.current;
    
    const isPositive = score >= EMOTION_THRESHOLDS.POSITIVE;
    const debounceTime = isPositive ? DEBOUNCE_TIMES.POSITIVE_EMOTION : DEBOUNCE_TIMES.OTHER_EMOTION;
    
    // 팝업이 표시되는 동안 모든 감정 처리 차단
    if (showAccessModal) {
      console.log(`🎉 출입허가 팝업 표시 중 - 모든 감정 처리 차단 (${score.toFixed(1)}%)`);
      return;
    }

    // 음성 재생 중일 때는 긍정적 감정만 처리
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
    
    if (score <= EMOTION_THRESHOLDS.NEGATIVE) {
      if (gateStatus !== 'denied' && gateStatus !== 'locked') {
        console.log(`🚫 부정적 감정 감지 (${score.toFixed(1)}%) - denied 상태로 전환`);
        
        // 기존 타이머들 정리
        if (lockTimeoutRef.current) {
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        setGateStatus('denied');
        const message = playMessage(MESSAGES.DENIAL);
        setDeniedMessage(message);
        
        // 3초 후 락 상태로 전환
        lockTimeoutRef.current = setTimeout(() => {
          console.log(`⏰ 3초 경과 - 락 상태로 전환`);
          
          const lockMessage = playMessage(MESSAGES.LOCK);
          setDeniedMessage(lockMessage);
          setGateStatus('locked');
          setLockTimer(TIMERS.LOCK_DURATION);
        }, TIMERS.DENIAL_TO_LOCK);
      }
    } else if (score >= EMOTION_THRESHOLDS.POSITIVE) {
      console.log(`🚀 긍정적 감정 감지 (${score.toFixed(1)}%) - 승인 처리 시작`);
      
      if (gateStatus !== 'approved') {
        console.log(`✅ 감정 개선 감지 (${score.toFixed(1)}%) - 음성 즉시 중단`);
        stopSpeech('감정 개선됨');
        
        // 진행 중인 락 타이머 강제 취소
        if (lockTimeoutRef.current) {
          console.log('🔄 기존 락 타이머 취소 중...');
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        // 상태 즉시 업데이트
        setGateStatus('approved');
        setLockTimer(0);
        setDeniedMessage('');
        
        console.log(`🎉 감정 승인 완료: ${score.toFixed(1)}% - 모든 타이머 정리됨`);
      }
      
      // 팝업 표시 로직
      const popupNow = Date.now();
      const timeSinceLastPopup = popupNow - lastApprovalTime;
      
      if (timeSinceLastPopup > TIMERS.POPUP_INTERVAL) {
        console.log(`🎉 팝업 표시 조건 만족 - 미래형 출입 허용 팝업 표시!`);
        setLastApprovalTime(popupNow);
        setShowApprovalModal(true);
        
        // 팝업이 자동으로 닫힐 때까지 기다린 후 정리
        if (accessModalTimeoutRef.current) {
          clearTimeout(accessModalTimeoutRef.current);
        }
        accessModalTimeoutRef.current = setTimeout(() => {
          setShowApprovalModal(false);
        }, TIMERS.POPUP_DURATION);
        
        // 승인 음성 메시지
        playApprovalMessage(MESSAGES.APPROVAL);
      }
    } else {
      if (gateStatus === 'approved' || gateStatus === 'denied' || gateStatus === 'locked') {
        console.log(`⚠️ 중립 상태 감지 (${score.toFixed(1)}%) - 분석 모드로 전환`);
        
        // 진행 중인 락 타이머 취소
        if (lockTimeoutRef.current) {
          console.log('🔄 중립 상태 - 락 타이머 취소');
          clearTimeout(lockTimeoutRef.current);
          lockTimeoutRef.current = null;
        }
        
        stopSpeech('중립 상태');
        setGateStatus('analyzing');
        setLockTimer(0);
        setDeniedMessage('');
      }
    }
    
    // 처리 완료 후 플래그 해제
    const processingDelay = isPositive ? 500 : 1000;
    setTimeout(() => {
      isProcessingEmotionRef.current = false;
      console.log(`✅ 감정 처리 완료: ${score.toFixed(1)}% (${processingDelay}ms 후)`);
    }, processingDelay);
    
  }, [
    gateStatus, 
    playMessage, 
    playApprovalMessage, 
    stopSpeech, 
    isSpeechPlaying, 
    showAccessModal,
    lastApprovalTime
  ]);

  // 정리 함수
  const cleanup = useCallback(() => {
    if (lockTimeoutRef.current) {
      clearTimeout(lockTimeoutRef.current);
      lockTimeoutRef.current = null;
    }
    if (accessModalTimeoutRef.current) {
      clearTimeout(accessModalTimeoutRef.current);
      accessModalTimeoutRef.current = null;
    }
    if (emotionProcessingRef.current) {
      clearTimeout(emotionProcessingRef.current);
      emotionProcessingRef.current = null;
    }
    isProcessingEmotionRef.current = false;
  }, []);

  return {
    gateStatus,
    deniedMessage,
    lockTimer,
    showApprovalModal,
    setShowApprovalModal,
    processEmotionGate,
    updateLockTimer,
    cleanup
  };
} 