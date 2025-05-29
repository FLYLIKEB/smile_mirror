import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface UploadPhotoRequest {
  imageData: string; // Base64 이미지 데이터
}

interface UploadPhotoResponse {
  success: boolean;
  photoId?: string;
  downloadUrl?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadPhotoResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '메서드가 허용되지 않습니다' });
  }

  try {
    const { imageData }: UploadPhotoRequest = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, error: '이미지 데이터가 필요합니다' });
    }

    // Base64 데이터에서 헤더 제거 (data:image/png;base64, 부분)
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    
    // 고유 ID 생성 (현재 시간 + 랜덤 문자열)
    const photoId = `smile_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // 파일 저장 경로
    const photosDir = path.join(process.cwd(), 'public', 'photos');
    
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }
    
    const filePath = path.join(photosDir, `${photoId}.png`);
    
    // Base64 데이터를 파일로 저장
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    console.log(`✅ 사진 저장 완료: ${photoId}`);
    
    // 다운로드 URL 생성
    const downloadUrl = `/api/download-photo/${photoId}`;
    
    return res.status(200).json({
      success: true,
      photoId,
      downloadUrl
    });

  } catch (error) {
    console.error('❌ 사진 업로드 실패:', error);
    return res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
} 