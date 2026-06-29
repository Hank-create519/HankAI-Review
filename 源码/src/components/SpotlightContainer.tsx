import React from 'react';
import { useSpotlight } from '../hooks/useSpotlight';

interface SpotlightContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const SpotlightContainer: React.FC<SpotlightContainerProps> = ({
  children,
  className = '',
  style,
}) => {
  const { containerRef, handleMouseMove, handleMouseLeave } = useSpotlight();

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`spotlight-container ${className}`}
      style={style}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
};
