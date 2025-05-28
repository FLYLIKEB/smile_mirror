import { useCallback, useRef, useEffect } from 'react';
import { Dimensions } from '../types';
import { createVideoConstraints } from '../utils/video';
import { FRAME_STABILIZATION_DELAY } from '../constants';

export const useVideo = (
  videoRef: React.RefObject<HTMLVideoElement>,
  dimensions: Dimensions,
  onCameraReady: (ready: boolean) => void,
  onVideoPlaying: () => void
) => {
  const isVideoStartedRef = useRef<boolean>(false);
  const dimensionsRef = useRef<Dimensions>(dimensions);

  // dimensions를 ref에 업데이트
  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  // 비디오 스트림 정리
  const cleanupVideo = useCallback(() => {
    console.log('비디오 스트림 정리 시작');
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      console.log('기존 비디오 스트림 정리 완료');
    }
    isVideoStartedRef.current = false;
  }, [videoRef]);

  // 웹캠 시작
  const startVideo = useCallback(async () => {
    console.log('startVideo 호출됨, isVideoStarted:', isVideoStartedRef.current);
    
    if (!videoRef.current) {
      console.log('videoRef.current가 없음');
      return;
    }
    
    if (isVideoStartedRef.current) {
      console.log('비디오가 이미 시작됨, 건너뜀');
      return;
    }
    
    try {
      console.log('웹캠 액세스 시도, dimensions:', dimensionsRef.current);
      const constraints = createVideoConstraints(dimensionsRef.current.height);
      console.log('비디오 제약조건:', constraints);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('웹캠 스트림 획득 성공');
      
      if (!videoRef.current) {
        console.log('컴포넌트가 언마운트됨, 스트림 정리');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      videoRef.current.srcObject = stream;
      isVideoStartedRef.current = true;
      console.log('비디오 소스 설정 완료');
      
      videoRef.current.onloadedmetadata = () => {
        console.log('비디오 메타데이터 로드됨');
        onCameraReady(true);
      };
      
      videoRef.current.onplaying = () => {
        console.log('비디오 재생 시작됨');
        
        setTimeout(() => {
          if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            console.log('카메라가 완전히 준비되었습니다. DeepAR 초기화 시작');
            onVideoPlaying();
          } else {
            console.log('비디오 크기가 아직 유효하지 않음');
          }
        }, FRAME_STABILIZATION_DELAY);
      };
      
      videoRef.current.onerror = (error) => {
        console.error('비디오 오류:', error);
        isVideoStartedRef.current = false;
      };
      
    } catch (error) {
      console.error('웹캠 액세스 오류:', error);
      isVideoStartedRef.current = false;
    }
  }, [onCameraReady, onVideoPlaying, videoRef]);

  return {
    startVideo,
    cleanupVideo
  };
}; 