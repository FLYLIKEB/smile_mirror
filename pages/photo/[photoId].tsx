import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

interface PhotoInfo {
  photoId: string;
  exists: boolean;
  downloadUrl: string;
  timestamp: string;
}

export default function PhotoPage() {
  const router = useRouter();
  const { photoId } = router.query;
  const [photoInfo, setPhotoInfo] = useState<PhotoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (photoId && typeof photoId === 'string') {
      checkPhotoExists(photoId);
    }
  }, [photoId]);

  const checkPhotoExists = async (id: string) => {
    try {
      // 간단히 이미지 로드를 시도해서 존재 여부 확인
      const img = new Image();
      img.onload = () => {
        setPhotoInfo({
          photoId: id,
          exists: true,
          downloadUrl: `/api/download-photo/${id}`,
          timestamp: extractTimestamp(id)
        });
        setLoading(false);
      };
      img.onerror = () => {
        setPhotoInfo({
          photoId: id,
          exists: false,
          downloadUrl: '',
          timestamp: extractTimestamp(id)
        });
        setLoading(false);
      };
      img.src = `/photos/${id}.png`;
    } catch (error) {
      console.error('사진 확인 실패:', error);
      setLoading(false);
    }
  };

  const extractTimestamp = (id: string): string => {
    try {
      const parts = id.split('_');
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1]);
        return new Date(timestamp).toLocaleString('ko-KR');
      }
    } catch (error) {
      console.error('타임스탬프 추출 실패:', error);
    }
    return '알 수 없음';
  };

  const handleDownload = async () => {
    if (!photoInfo?.exists) return;
    
    setDownloading(true);
    try {
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = photoInfo.downloadUrl;
      link.download = `smile-mirror-${photoInfo.photoId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('📥 다운로드 시작:', photoInfo.photoId);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Head>
          <title>스마일 미러 - 사진 로딩 중</title>
        </Head>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl">사진을 확인하는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!photoInfo?.exists) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Head>
          <title>스마일 미러 - 사진을 찾을 수 없음</title>
        </Head>
        <div className="text-center text-white max-w-md mx-4">
          <div className="text-6xl mb-6">😔</div>
          <h1 className="text-3xl font-bold mb-4">사진을 찾을 수 없습니다</h1>
          <p className="text-gray-300 mb-6">
            요청하신 사진이 존재하지 않거나 만료되었을 수 있습니다.
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Head>
        <title>스마일 미러 - 사진 다운로드</title>
        <meta name="description" content="스마일 미러에서 촬영된 멋진 사진을 다운로드하세요!" />
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              🎉 스마일 미러 사진
            </h1>
            <p className="text-gray-300 text-lg">
              완벽한 미소가 포착되었습니다!
            </p>
            <p className="text-gray-400 text-sm mt-2">
              촬영 시간: {photoInfo.timestamp}
            </p>
          </div>

          {/* 사진 미리보기 */}
          <div className="bg-white rounded-2xl p-6 shadow-2xl mb-8">
            <div className="relative">
              <img
                src={`/photos/${photoInfo.photoId}.png`}
                alt="스마일 미러 사진"
                className="w-full rounded-xl shadow-lg"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.png';
                  e.currentTarget.alt = '이미지 로드 실패';
                }}
              />
              <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                ✨ 100점 달성!
              </div>
            </div>
          </div>

          {/* 다운로드 섹션 */}
          <div className="bg-black bg-opacity-30 backdrop-blur rounded-2xl p-6 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              📱 사진 다운로드
            </h2>
            <p className="text-gray-300 mb-6">
              아래 버튼을 눌러 고화질 사진을 다운로드하세요
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                  downloading
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                } text-white`}
              >
                {downloading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>다운로드 중...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <span>📥</span>
                    <span>사진 다운로드</span>
                  </div>
                )}
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
                >
                  🏠 홈으로
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-xl font-semibold transition-colors"
                >
                  🔄 새로고침
                </button>
              </div>
            </div>
          </div>

          {/* 추가 정보 */}
          <div className="mt-8 text-center text-gray-400 text-sm">
            <p>💡 팁: 사진을 친구들과 공유하고 싶다면 이 페이지 URL을 복사해서 보내주세요!</p>
            <p className="mt-2">Photo ID: {photoInfo.photoId}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 