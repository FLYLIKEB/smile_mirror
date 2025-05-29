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

      setScreenshotDataUrl(screenshot);

      // 고유 ID 생성 및 localStorage에 저장
      const photoId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const photoData = {
        id: photoId,
        imageData: screenshot,
        timestamp: new Date().toISOString(),
        title: `완벽한 미소 ${new Date().toLocaleString()}`
      };

      try {
        localStorage.setItem(`smile-mirror-${photoId}`, JSON.stringify(photoData));
        console.log('💾 사진 데이터 저장 완료:', photoId);
      } catch (storageError) {
        console.warn('⚠️ localStorage 저장 실패:', storageError);
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

  const copyToClipboard = async () => {
    if (!screenshotDataUrl) return;

    try {
      // Data URL을 Blob으로 변환
      const response = await fetch(screenshotDataUrl);
      const blob = await response.blob();
      
      // 클립보드에 이미지 복사
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      
      alert('📋 이미지가 클립보드에 복사되었습니다!\n\n다른 앱에서 붙여넣기(Ctrl+V 또는 Cmd+V)로 사용하세요.\n\n• 카카오톡, 텔레그램 등 메신저\n• 포토샵, 그림판 등 이미지 편집기\n• 워드, 파워포인트 등 문서 프로그램');
      console.log('📋 클립보드 복사 성공');
    } catch (error) {
      console.warn('❌ 클립보드 복사 실패:', error);
      
      // 폴백: 텍스트로 Data URL 복사
      try {
        await navigator.clipboard.writeText(screenshotDataUrl);
        alert('📋 이미지 데이터가 텍스트로 클립보드에 복사되었습니다.');
      } catch (textError) {
        console.error('❌ 텍스트 복사도 실패:', textError);
        alert('❌ 클립보드 복사에 실패했습니다. 직접 다운로드를 사용해주세요.');
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        {/* 헤더 */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            🎉 100점 달성!
          </h2>
          <p className="text-gray-600">
            완벽한 미소를 포착했습니다!
          </p>
          <div className="mt-3 text-lg font-semibold text-red-500">
            ⏰ {timeLeft}초 후 자동 닫힘
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
              📱 QR 코드로 사진 보기
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <img 
                src={qrCodeDataUrl} 
                alt="QR 코드"
                className="w-32 h-32 mx-auto"
              />
              <p className="text-sm text-gray-600 mt-2">
                스마트폰으로 스캔하면 전용 페이지에서 사진을 볼 수 있습니다
              </p>
              <p className="text-xs text-gray-500 mt-1">
                링크를 공유하여 다른 사람과도 사진을 나눌 수 있어요!
              </p>
            </div>
          </div>
        )}

        {/* 버튼들 */}
        <div className="flex flex-col gap-3 justify-center">
          {screenshotDataUrl && (
            <button
              onClick={copyToClipboard}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors text-lg shadow-lg"
            >
              📋 클립보드에 복사하기
            </button>
          )}
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