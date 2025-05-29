import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { photoId } = req.query;

  if (!photoId || typeof photoId !== 'string') {
    return res.status(400).json({ error: '유효하지 않은 사진 ID입니다' });
  }

  try {
    // 파일 경로 확인
    const filePath = path.join(process.cwd(), 'public', 'photos', `${photoId}.png`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '사진을 찾을 수 없습니다' });
    }

    // 파일 정보
    const stats = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    
    console.log(`📥 사진 다운로드 요청: ${photoId}`);

    // 파일 다운로드 헤더 설정
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="smile-mirror-${photoId}.png"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1일 캐시
    
    // 파일 전송
    res.status(200).send(fileBuffer);
    
  } catch (error) {
    console.error('❌ 사진 다운로드 실패:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
} 