# 스마일 미러 AR (Smile Mirror AR)

웹캠을 통해 실시간으로 사용자의 표정을 감지하고 감정 점수를 계산하며, DeepAR을 통한 AR 효과를 제공하는 애플리케이션입니다.

## 주요 기능

- 웹캠을 통한 실시간 얼굴 감지
- 표정 인식 (happy, sad, angry, disgusted)
- 감정 점수 계산 및 표시
- DeepAR을 통한 실시간 AR 효과
  - 배경 블러
  - 배경 교체
  - 선글라스 효과
- 감정 상태에 따른 시각적 피드백

## 기술 스택

- Next.js
- TypeScript
- TailwindCSS
- face-api.js
- DeepAR Web SDK

## 설정 방법

### 1. 프로젝트 클론
```bash
git clone https://github.com/FLYLIKEB/smile_mirror.git
cd smile_mirror
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
DeepAR 라이센스 키가 이미 `.env` 파일에 설정되어 있습니다.

만약 다른 라이센스 키를 사용하려면 `.env` 파일을 수정하세요:
```bash
NEXT_PUBLIC_DEEPAR_LICENSE_KEY=your_actual_license_key_here
```

#### DeepAR 라이센스 키 발급 방법:
1. [DeepAR 개발자 포털](https://developer.deepar.ai/)에 가입
2. 새 프로젝트 생성
3. 웹 앱 추가 (도메인: `localhost` 또는 배포할 도메인)
4. 발급받은 라이센스 키를 `.env` 파일에 입력

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 브라우저에서 접속
`http://localhost:3000`에 접속하여 애플리케이션을 사용할 수 있습니다.

## 사용 방법

1. 웹페이지 접속 시 카메라 권한을 허용해주세요
2. 얼굴이 인식되면 실시간으로 감정 점수가 표시됩니다
3. DeepAR이 로드되면 우측 상단에 AR 효과 버튼들이 나타납니다
4. 각 버튼을 클릭하여 다양한 AR 효과를 체험해보세요

## 감정 점수 계산 방식

감정 점수는 다음 공식으로 계산됩니다:
```
감정 점수 = happy - (sad + angry + disgusted)
```

점수가 양수면 긍정적인 감정 상태, 음수면 부정적인 감정 상태를 의미합니다.

## 환경 변수

| 변수명 | 설명 | 필수 여부 |
|--------|------|-----------|
| `NEXT_PUBLIC_DEEPAR_LICENSE_KEY` | DeepAR 라이센스 키 | 필수 |

## 주의사항

- 카메라 권한이 필요합니다
- HTTPS 환경에서 더 안정적으로 작동합니다
- DeepAR 라이센스 키는 도메인별로 발급되므로, 배포 시 해당 도메인으로 새로 발급받아야 합니다 