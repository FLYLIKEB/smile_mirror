# 스마일 미러 (Smile Mirror)

웹캠을 통해 실시간으로 사용자의 표정을 감지하고 감정 점수를 계산하는 애플리케이션입니다.

## 주요 기능

- 웹캠을 통한 실시간 얼굴 감지
- 표정 인식 (happy, sad, angry, disgusted)
- 감정 점수 계산 및 표시
- 감정 상태에 따른 시각적 피드백

## 기술 스택

- Next.js
- TypeScript
- TailwindCSS
- face-api.js

## 실행 방법

1. 프로젝트 클론
```bash
git clone https://github.com/FLYLIKEB/smile_mirror.git
cd smile_mirror
```

2. 의존성 설치
```bash
npm install
```

3. 개발 서버 실행
```bash
npm run dev
```

4. 브라우저에서 `http://localhost:3000` 접속

## 감정 점수 계산 방식

감정 점수는 다음 공식으로 계산됩니다:
```
감정 점수 = happy - (sad + angry + disgusted)
```

점수가 양수면 긍정적인 감정 상태, 음수면 부정적인 감정 상태를 의미합니다. 