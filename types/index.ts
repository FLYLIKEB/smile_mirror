// 캔버스 크기 관련 타입
export interface CanvasDimensions {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  aspectRatio: number;
}

// 비디오 제약 조건 타입
export interface VideoConstraints {
  video: {
    facingMode: string;
    width: { ideal: number };
    height: { ideal: number };
  };
}

// 화면 크기 타입
export interface Dimensions {
  width: number;
  height: number;
}

// AR 효과 타입 - beauty 효과로 변경
export type EffectType = 'beauty' | null;

// DeepAR 전역 타입
declare global {
  interface Window {
    deepar: any;
  }
} 