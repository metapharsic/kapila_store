import { useState, useEffect } from 'react';

// Standard breakpoints for Kapila IMS
export const breakpoints = {
  mobile: 767,
  tablet: 1023,
  laptop: 1439,
};

/**
 * Hook to get current responsive state
 * @returns {object} { isMobile, isTablet, isDesktop, width }
 */
export function useBreakpoint() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    function handleResize() {
      setWindowSize({ width: window.innerWidth });
    }
    
    window.addEventListener('resize', handleResize);
    // Call handler right away so state gets updated with initial window size
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const width = windowSize.width;
  
  return {
    width,
    isMobile: width <= breakpoints.mobile,
    isTablet: width > breakpoints.mobile && width <= breakpoints.tablet,
    isDesktop: width > breakpoints.tablet,
  };
}

/**
 * Helper to generate responsive grid styles
 * @param {number} cols Number of columns
 * @param {boolean} isMobile Whether it's mobile view
 * @param {gap} gap in px
 * @returns {object} Grid style object
 */
export const gridStyle = (cols, isMobile, gap = 16) => {
  if (isMobile) {
    return {
      display: 'flex',
      flexDirection: 'column',
      gap: `${gap}px`,
      width: '100%',
    };
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `${gap}px`,
    width: '100%',
  };
};

/**
 * Responsive padding for standard sections
 * @param {boolean} isMobile 
 * @returns {string} Padding value
 */
export const sectionPadding = (isMobile) => isMobile ? '16px' : '24px';

export default {
  breakpoints,
  useBreakpoint,
  gridStyle,
  sectionPadding
};
