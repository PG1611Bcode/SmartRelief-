import React from 'react';

const GrainOverlay = () => (
  <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-[inherit]">
    <svg className="w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </div>
);

export default GrainOverlay;
