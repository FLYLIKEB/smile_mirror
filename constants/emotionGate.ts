// 감정 개찰구 관련 상수들
export const EMOTION_THRESHOLDS = {
  NEGATIVE: -10,  // 부정적 감정 임계값
  POSITIVE: 12,   // 긍정적 감정 임계값
} as const;

export const DEBOUNCE_TIMES = {
  POSITIVE_EMOTION: 1000,  // 긍정적 감정 디바운싱 시간 (1초)
  OTHER_EMOTION: 2000,     // 기타 감정 디바운싱 시간 (2초)
} as const;

export const TIMERS = {
  LOCK_DURATION: 5,        // 락 지속 시간 (초)
  DENIAL_TO_LOCK: 3000,    // denied에서 locked까지 시간 (ms)
  POPUP_INTERVAL: 5000,    // 팝업 표시 간격 (ms)
  POPUP_DURATION: 10500,   // 팝업 지속 시간 (ms)
} as const;

export const SPEECH_CONFIG = {
  LANG: 'ko-KR',
  RATE: 0.9,
  PITCH: 0.8,
  VOLUME: 1.0,
  APPROVAL_RATE: 0.9,
  APPROVAL_PITCH: 1.0,
} as const;

export const MESSAGES = {
  DENIAL: '감정이 불안정하신 것 같아요. 한김 식히고 오세요 :)',
  LOCK: '공공안전을 위해 출입이 제한됩니다. 적절한 감정 상태로 조정 후 다시 시도해주세요.',
  APPROVAL: '완벽한 미소입니다! 아름다운 하루 되세요.',
} as const;

export type EmotionGateStatus = 'analyzing' | 'approved' | 'denied' | 'locked'; 