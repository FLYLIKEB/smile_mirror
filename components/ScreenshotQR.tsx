import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

interface ScreenshotQRProps {
  isVisible: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  deepARCanvasRef: React.RefObject<HTMLCanvasElement>;
  takeDeepARScreenshot: () => Promise<string | null>;
  onClose: () => void;
}

const ScreenshotQR: React.FC<ScreenshotQRProps> = ({
  isVisible,
  videoRef,
  deepARCanvasRef,
  takeDeepARScreenshot,
  onClose
}) => {
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTimerRunning = useRef<boolean>(false);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isVisible) {
      console.log('🔄 모달 열림 - 상태 초기화');
      setTimeLeft(10);
      setScreenshotDataUrl('');
      setQrCodeDataUrl('');
      setIsGenerating(false);
      
      // 스크린샷 촬영 시작
      console.log('📸 모달이 열렸습니다. 스크린샷 촬영 시작');
      takeScreenshot();
    }
  }, [isVisible]);

  // 타이머 시작 (모달이 열렸을 때만)
  useEffect(() => {
    if (isVisible) {
      console.log('⏰ 10초 타이머 시작');
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          console.log(`⏰ 타이머: ${prev} -> ${prev - 1}`);
          if (prev <= 1) {
            console.log('🔚 시간 만료로 모달 닫기');
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        console.log('🧹 타이머 정리');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isVisible, onClose]);

  const takeScreenshot = async () => {
    setIsGenerating(true);
    try {
      let screenshot: string = '';

      // 1순위: DeepAR API 사용 (가장 고품질)
      try {
        const deepARScreenshot = await takeDeepARScreenshot();
        if (deepARScreenshot) {
          screenshot = deepARScreenshot;
          console.log('📸 DeepAR API로 고품질 스크린샷 촬영 성공');
        }
      } catch (deepARError) {
        console.warn('⚠️ DeepAR API 스크린샷 실패, 다른 방법 시도:', deepARError);
      }

      // 2순위: DeepAR 캔버스 직접 캡처
      if (!screenshot && deepARCanvasRef.current) {
        try {
          const canvas = deepARCanvasRef.current;
          screenshot = canvas.toDataURL('image/png', 1.0);
          console.log('📸 DeepAR 캔버스에서 스크린샷 촬영');
        } catch (canvasError) {
          console.warn('⚠️ DeepAR 캔버스 캡처 실패:', canvasError);
        }
      }

      // 3순위: 비디오 요소 캡처
      if (!screenshot && videoRef.current) {
        try {
          const video = videoRef.current;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          canvas.width = video.videoWidth || video.clientWidth;
          canvas.height = video.videoHeight || video.clientHeight;
          
          if (ctx && canvas.width > 0 && canvas.height > 0) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            screenshot = canvas.toDataURL('image/png', 1.0);
            console.log('📸 비디오에서 스크린샷 촬영');
          }
        } catch (videoError) {
          console.warn('⚠️ 비디오 캡처 실패:', videoError);
        }
      }

      // 4순위: 전체 화면 캡처 (최후의 수단)
      if (!screenshot) {
        try {
          const element = document.body;
          const canvas = await html2canvas(element, {
            allowTaint: true,
            useCORS: true,
            scale: 1,
            backgroundColor: null
          });
          screenshot = canvas.toDataURL('image/png', 1.0);
          console.log('📸 전체 화면 스크린샷 촬영 (최후 수단)');
        } catch (html2canvasError) {
          console.error('❌ html2canvas도 실패:', html2canvasError);
        }
      }

      if (!screenshot) {
        throw new Error('모든 스크린샷 방법이 실패했습니다.');
      }

      // 이미지 크기 최적화 함수
      const optimizeImage = (dataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 최대 해상도 제한 (800px)
            const maxSize = 800;
            let { width, height } = img;
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              // JPEG로 변환하여 크기 대폭 감소 (품질 0.7)
              const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
              console.log('🔧 이미지 최적화 완료:', {
                original: dataUrl.length,
                optimized: optimizedDataUrl.length,
                reduction: `${((1 - optimizedDataUrl.length / dataUrl.length) * 100).toFixed(1)}%`
              });
              resolve(optimizedDataUrl);
            } else {
              resolve(dataUrl);
            }
          };
          img.src = dataUrl;
        });
      };

      // 이미지 최적화 실행
      const optimizedScreenshot = await optimizeImage(screenshot);
      setScreenshotDataUrl(optimizedScreenshot);

      // localStorage 정리 함수
      const cleanupOldPhotos = () => {
        try {
          const allKeys = Object.keys(localStorage);
          const smileKeys = allKeys.filter(key => key.startsWith('smile-mirror-'));
          
          // 5개 이상이면 오래된 것부터 삭제
          if (smileKeys.length >= 5) {
            // 키에서 타임스탬프 추출하여 정렬
            const sortedKeys = smileKeys.sort((a, b) => {
              const timestampA = parseInt(a.split('-')[2]) || 0;
              const timestampB = parseInt(b.split('-')[2]) || 0;
              return timestampA - timestampB;
            });
            
            // 오래된 것부터 절반 삭제
            const keysToDelete = sortedKeys.slice(0, Math.floor(sortedKeys.length / 2));
            keysToDelete.forEach(key => {
              localStorage.removeItem(key);
              console.log('🗑️ 오래된 사진 삭제:', key);
            });
            
            console.log('🧹 localStorage 정리 완료:', {
              deleted: keysToDelete.length,
              remaining: smileKeys.length - keysToDelete.length
            });
          }
        } catch (cleanupError) {
          console.warn('⚠️ localStorage 정리 실패:', cleanupError);
        }
      };

      // 기존 데이터 정리
      cleanupOldPhotos();

      // 고유 ID 생성 및 localStorage에 저장
      const photoId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const photoData = {
        id: photoId,
        imageData: optimizedScreenshot,
        timestamp: new Date().toISOString(),
        title: `완벽한 미소 ${new Date().toLocaleString()}`
      };

      try {
        const dataString = JSON.stringify(photoData);
        const storageKey = `smile-mirror-${photoId}`;
        
        console.log('💾 localStorage 저장 시도 (최적화됨):', {
          photoId,
          storageKey,
          dataSize: dataString.length,
          dataSizeMB: (dataString.length / 1024 / 1024).toFixed(2) + 'MB',
          timestamp: photoData.timestamp
        });
        
        localStorage.setItem(storageKey, dataString);
        
        // 저장 확인
        const savedData = localStorage.getItem(storageKey);
        if (savedData) {
          console.log('✅ localStorage 저장 및 확인 완료:', {
            saved: true,
            keyExists: !!savedData,
            savedSize: savedData.length,
            savedSizeMB: (savedData.length / 1024 / 1024).toFixed(2) + 'MB',
            isEqual: dataString === savedData
          });
        } else {
          console.error('❌ localStorage 저장 실패 - 저장된 데이터를 찾을 수 없음');
        }
        
        // localStorage 전체 상태 확인
        const allKeys = Object.keys(localStorage);
        const smileKeys = allKeys.filter(key => key.startsWith('smile-mirror-'));
        const totalSize = JSON.stringify(localStorage).length;
        console.log('📦 localStorage 현재 상태:', {
          totalKeys: allKeys.length,
          smileKeys: smileKeys.length,
          smileKeysList: smileKeys,
          totalSize: totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2) + 'MB'
        });
        
      } catch (storageError) {
        console.error('❌ localStorage 저장 실패:', storageError);
        
        // 저장소 용량 확인
        try {
          const totalSize = JSON.stringify(localStorage).length;
          const errorMessage = storageError instanceof Error ? storageError.message : String(storageError);
          console.log('📊 localStorage 사용량:', {
            totalSize,
            totalSizeMB: (totalSize / 1024 / 1024).toFixed(2) + 'MB',
            maxSize: '약 5-10MB (브라우저별 상이)',
            error: errorMessage
          });
          
          // 긴급 정리 시도
          if (errorMessage.includes('quota') || errorMessage.includes('QuotaExceededError')) {
            console.log('🚨 용량 초과로 긴급 정리 시도');
            cleanupOldPhotos();
            
            // 다시 한 번 저장 시도
            try {
              const retryStorageKey = `smile-mirror-${photoId}`;
              localStorage.setItem(retryStorageKey, JSON.stringify(photoData));
              console.log('✅ 긴급 정리 후 저장 성공');
            } catch (retryError) {
              console.error('❌ 긴급 정리 후에도 저장 실패:', retryError);
            }
          }
        } catch (sizeError) {
          console.log('📊 localStorage 사용량 확인 실패:', sizeError);
        }
      }

      // QR 코드 생성 - 웹 페이지 링크
      try {
        const baseUrl = window.location.origin;
        const photoPageUrl = `${baseUrl}/qr/${photoId}`;
        
        const qrCodeUrl = await QRCode.toDataURL(photoPageUrl, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        setQrCodeDataUrl(qrCodeUrl);
        console.log('📱 QR 코드 생성 완료 (웹 페이지 링크):', photoPageUrl);
      } catch (qrError) {
        console.error('❌ QR 코드 생성 실패:', qrError);
        // QR 코드 실패해도 스크린샷은 사용 가능
      }

    } catch (error) {
      console.error('❌ 스크린샷/QR 코드 생성 실패:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        {/* 헤더 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🎫 시민 출입증 발급
          </h2>
          <p className="text-gray-600">
            감정 상태가 적절합니다. 출입증을 발급합니다.
          </p>
          <div className="mt-3 text-lg font-semibold text-red-500">
            ⏰ {timeLeft}초 후 자동 종료
          </div>
        </div>

        {/* 로딩 중 */}
        {isGenerating && (
          <div className="mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
            <p className="text-gray-600">
              스크린샷 촬영 및 QR 코드 생성 중...
            </p>
          </div>
        )}

        {/* 스크린샷 미리보기 */}
        {screenshotDataUrl && !isGenerating && (
          <div className="mb-6">
            <div className="relative">
              <img 
                src={screenshotDataUrl} 
                alt="스크린샷 미리보기"
                className="w-full max-w-xs mx-auto rounded-lg shadow-lg border-2 border-gray-200"
              />
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                ✓ 촬영완료
              </div>
            </div>
          </div>
        )}

        {/* QR 코드 */}
        {qrCodeDataUrl && !isGenerating && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              📱 디지털 출입증
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <img 
                src={qrCodeDataUrl} 
                alt="QR 코드"
                className="w-32 h-32 mx-auto"
              />
              <p className="text-sm text-gray-600 mt-2">
                스마트폰으로 스캔하면 출입증을 확인할 수 있습니다
              </p>
              <p className="text-xs text-gray-500 mt-1">
                발급일시, 감정점수, 시민ID가 포함됩니다
              </p>
            </div>
          </div>
        )}

        {/* 버튼들 */}
        <div className="flex flex-col gap-3 justify-center">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 진행 바 */}
        <div className="mt-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-red-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((10 - timeLeft) / 10) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotQR; 