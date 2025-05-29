import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';

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

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadPhotoData(id);
    }
  }, [id]);

  const loadPhotoData = async (photoId: string) => {
    try {
      setIsLoading(true);
      
      // localStorage에서 사진 데이터 로드
      const storedData = localStorage.getItem(`smile-mirror-${photoId}`);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        setPhotoData(data);
        console.log('📷 사진 데이터 로드 성공:', photoId);
      } else {
        // localStorage에 없으면 더미 데이터 또는 에러 표시
        setError('사진을 찾을 수 없습니다. 링크가 만료되었거나 올바르지 않습니다.');
        console.warn('❌ 사진 데이터 없음:', photoId);
      }
    } catch (err) {
      console.error('❌ 사진 로드 실패:', err);
      setError('사진을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (photoData?.imageData) {
      const link = document.createElement('a');
      link.download = `smile-mirror-${photoData.id}.png`;
      link.href = photoData.imageData;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        <title>스마일 미러 - {photoData.title}</title>
        <meta name="description" content="스마일 미러에서 촬영된 완벽한 미소 사진입니다!" />
        <meta property="og:title" content={`스마일 미러 - ${photoData.title}`} />
        <meta property="og:description" content="스마일 미러에서 촬영된 완벽한 미소 사진입니다!" />
        <meta property="og:image" content={photoData.imageData} />
        <meta property="og:type" content="website" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎉 스마일 미러
          </h1>
          <p className="text-gray-600 text-lg">
            완벽한 미소가 포착되었습니다!
          </p>
          <div className="text-sm text-gray-500 mt-2">
            촬영 시간: {new Date(photoData.timestamp).toLocaleString()}
          </div>
        </div>

        {/* 메인 이미지 */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <img 
              src={photoData.imageData}
              alt={photoData.title}
              className="w-full rounded-lg shadow-lg"
            />
            <div className="mt-4 text-center">
              <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
                <span className="text-lg mr-2">✨</span>
                <span className="font-semibold">감정 점수 100점 달성!</span>
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="max-w-md mx-auto space-y-4">
          <button
            onClick={downloadImage}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors text-lg shadow-lg"
          >
            📥 이미지 다운로드
          </button>
        </div>

        {/* 하단 설명 */}
        <div className="text-center mt-12 text-gray-500">
          <p className="text-sm">
            스마일 미러는 감정 인식 기술을 사용하여<br/>
            완벽한 미소 순간을 포착합니다
          </p>
        </div>
      </div>
    </div>
  );
} 