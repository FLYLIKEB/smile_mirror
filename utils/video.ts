import { VideoConstraints } from '../types';

// 비디오 제약 조건 생성
export const createVideoConstraints = (containerHeight: number): VideoConstraints => ({
  video: {
    facingMode: 'user',
    width: { ideal: containerHeight * (4/3) },
    height: { ideal: containerHeight }
  }
}); 