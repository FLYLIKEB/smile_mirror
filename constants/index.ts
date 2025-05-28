// DeepAR 관련 상수
export const DEEPAR_LICENSE_KEY = process.env.NEXT_PUBLIC_DEEPAR_LICENSE_KEY || '421dfb74552bd0c2eb11b7a40eebb2419dbbe7a44d96eaa155e8658c20afe307e5aac445a210089f';

// 모델 관련 상수
export const MODEL_URL = '/models';

// 캔버스 크기 관련 상수
export const MIN_CANVAS_WIDTH = 320;
export const MIN_CANVAS_HEIGHT = 240;
export const DEFAULT_CANVAS_WIDTH = 640;
export const DEFAULT_CANVAS_HEIGHT = 480;

// 타이밍 관련 상수
export const DETECTION_INTERVAL = 200;
export const FRAME_STABILIZATION_DELAY = 2000;
export const DEEPAR_INIT_TIMEOUT = 5000;
export const DEEPAR_RETRY_DELAY = 5000; 