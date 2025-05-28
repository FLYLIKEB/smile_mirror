import React from 'react';

interface LoadingMessagesProps {
  isModelLoaded: boolean;
  isCameraReady: boolean;
  isDeepARLoaded: boolean;
}

const LoadingMessages: React.FC<LoadingMessagesProps> = ({
  isModelLoaded,
  isCameraReady,
  isDeepARLoaded
}) => {
  return (
    <>
      {!isModelLoaded && (
        <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
          모델을 로드하는 중입니다...
        </p>
      )}
      
      {!isCameraReady && isModelLoaded && (
        <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
          카메라를 시작하는 중입니다...
        </p>
      )}
      
      {!isDeepARLoaded && isCameraReady && (
        <p className="absolute top-4 left-0 right-0 text-center text-yellow-600 bg-black bg-opacity-50 py-2 z-10">
          DeepAR을 로드하는 중입니다...
        </p>
      )}
    </>
  );
};

export default LoadingMessages; 