import { useState, useCallback } from 'react';
import { Dimensions } from '../types';

export const useDimensions = (containerRef: React.RefObject<HTMLDivElement>) => {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });

  // 화면 크기 조정
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    } else {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
  }, [containerRef]);

  return {
    dimensions,
    updateDimensions
  };
}; 