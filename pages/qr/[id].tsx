import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import html2canvas from 'html2canvas';

interface PhotoData {
  id: string;
  imageData: string;
  timestamp: string;
  title: string;
}

export default function QRPage() {
  const router = useRouter();
  const { id } = router.query;
  const [photoData, setPhotoData] = useState<PhotoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const certificateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadPhotoData(id);
    }
  }, [id]);

  const loadPhotoData = async (photoId: string) => {
    try {
      setIsLoading(true);
      
      console.log('🔍 사진 데이터 로드 시도:', photoId);
      
      // localStorage 전체 키 확인
      const allKeys = Object.keys(localStorage);
      const smileKeys = allKeys.filter(key => key.startsWith('smile-mirror-'));
      console.log('📦 localStorage 전체 키:', allKeys.length, '개');
      console.log('😊 smile-mirror 키:', smileKeys);
      
      // localStorage에서 사진 데이터 로드
      const storageKey = `smile-mirror-${photoId}`;
      console.log('🔑 찾는 키:', storageKey);
      
      const storedData = localStorage.getItem(storageKey);
      
      if (storedData) {
        console.log('✅ 데이터 발견:', storedData.length, 'bytes');
        const data = JSON.parse(storedData);
        setPhotoData(data);
        console.log('📷 사진 데이터 로드 성공:', photoId);
      } else {
        console.warn('❌ 사진 데이터 없음 - 키를 찾을 수 없음:', storageKey);
        console.log('🔍 유사한 키 검색...');
        
        // 부분 일치 검색
        const similarKeys = smileKeys.filter(key => key.includes(photoId.split('-')[0]));
        console.log('🔍 유사한 키들:', similarKeys);
        
        setError('사진을 찾을 수 없습니다. 링크가 만료되었거나 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('❌ 사진 로드 실패:', err);
      setError('사진을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = async () => {
    if (!photoData || !certificateRef.current) return;

    try {
      setIsDownloading(true);
      console.log('📥 출입증 전체 다운로드 시작');

      // 전체 출입증 영역을 캡처
      const canvas = await html2canvas(certificateRef.current, {
        allowTaint: true,
        useCORS: true
      });

      // 캔버스를 이미지로 변환
      const imageDataUrl = canvas.toDataURL('image/png', 1.0);
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.download = `감정조응도시-출입증-${photoData.id}.png`;
      link.href = imageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ 출입증 전체 다운로드 완료');
    } catch (error) {
      console.error('❌ 출입증 다운로드 실패:', error);
      
      // 폴백: 원본 이미지만 다운로드
      if (photoData?.imageData) {
        const link = document.createElement('a');
        link.download = `smile-mirror-${photoData.id}.png`;
        link.href = photoData.imageData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('📥 폴백: 원본 이미지 다운로드 완료');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <Head>
          <title>스마일 미러 - 사진 로딩 중</title>
        </Head>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">사진을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <Head>
          <title>스마일 미러 - 오류</title>
        </Head>
        <div className="text-center max-w-md mx-4">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">사진을 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            🏠 홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!photoData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <Head>
        <title>감정 조응 도시 - 출입증 {photoData ? `#${photoData.id}` : '로딩중'}</title>
        <meta name="description" content="감정 조응 도시 공공시설 출입증입니다. 시민 감정 상태 적절 - 출입 허가" />
        {photoData && (
          <>
            <meta property="og:title" content={`감정 조응 도시 출입증 - ${photoData.title}`} />
            <meta property="og:description" content="시민 감정 상태 적절 - 출입 허가. 감정 점수 100% 달성으로 출입증이 발급되었습니다." />
            <meta property="og:image" content={photoData.imageData} />
            <meta property="og:type" content="website" />
          </>
        )}
      </Head>

      <div className="container mx-auto px-4 py-8">
        {photoData ? (
          <>
            {/* 출입증 전체 영역 */}
            <div ref={certificateRef} className="bg-gradient-to-br from-green-50 to-blue-50 p-8">
              {/* 헤더 */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  🎫 감정 조응 도시 출입증
                </h1>
                <p className="text-gray-600 text-lg">
                  시민 감정 상태 적절 - 출입 허가
                </p>
                <div className="text-sm text-gray-500 mt-2">
                  발급일시: {new Date(photoData.timestamp).toLocaleString()}
                </div>
                <div className="text-sm text-blue-600 mt-1 font-semibold">
                  시민ID: {photoData.id}
                </div>
              </div>

              {/* 메인 이미지 */}
              <div className="max-w-2xl mx-auto mb-8">
                <div className="bg-white rounded-2xl shadow-2xl p-6 border-l-4 border-green-500">
                  <img 
                    src={photoData.imageData}
                    alt={photoData.title}
                    className="w-full rounded-lg shadow-lg"
                  />
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
                      <span className="text-lg mr-2">✅</span>
                      <span className="font-semibold">감정 점수 100% - 출입 승인</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      본 출입증은 감정 조응 도시 공공시설 이용 시 필요합니다
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 설명 */}
              <div className="text-center text-gray-500">
                <p className="text-sm">
                  감정 조응 도시는 모든 시민의 정신 건강을 위해<br/>
                  과학적 감정 관리 시스템을 운영합니다
                </p>
                <div className="mt-4 text-xs text-gray-400 bg-gray-100 p-3 rounded-lg max-w-md mx-auto">
                  <p className="font-semibold mb-1">⚠️ 출입증 이용 약관</p>
                  <p>• 본 출입증은 발급일로부터 24시간 유효합니다</p>
                  <p>• 감정 점수 80 미만 시 출입이 제한될 수 있습니다</p>
                  <p>• 시민 행복 지수 향상을 위해 일일 감정 체크가 의무입니다</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">📋 출입증 로딩 중...</h1>
            <p className="text-gray-600">사진 데이터를 불러오고 있습니다.</p>
          </div>
        )}

        {/* 액션 버튼들 - 항상 표시 */}
        <div className="max-w-md mx-auto space-y-4 mt-8">
          <button
            onClick={downloadImage}
            disabled={isDownloading || !photoData}
            className={`w-full px-8 py-4 rounded-lg font-semibold transition-colors text-lg shadow-lg ${
              isDownloading || !photoData
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isDownloading ? (
              <>
                <span className="inline-block animate-spin mr-2">⚙️</span>
                출입증 생성 중...
              </>
            ) : !photoData ? (
              '📥 데이터 로딩 중...'
            ) : (
              '📥 완전한 출입증 다운로드'
            )}
          </button>
          
          {/* 디버깅 정보 */}
          <div className="text-center text-xs text-gray-500 mt-4">
            <p>디버그: photoData = {photoData ? '✅ 로드됨' : '❌ 없음'}</p>
            <p>디버그: isDownloading = {isDownloading ? '✅ 진행중' : '❌ 대기중'}</p>
            <p>디버그: ID = {id as string || '없음'}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 