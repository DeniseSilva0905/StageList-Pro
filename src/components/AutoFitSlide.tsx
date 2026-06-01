import React, { useLayoutEffect, useRef, useState } from 'react';
import { AppSettings } from '../types';

interface AutoFitSlideProps {
  html: string;
  maxHeight: number;
  width: number;
  baseFontSize: number;
  columns?: 1 | 2;
  settings?: AppSettings;
  className?: string;
  style?: React.CSSProperties;
}

export function AutoFitSlide({
  html,
  maxHeight,
  width,
  baseFontSize,
  columns = 1,
  settings,
  className = '',
  style = {}
}: AutoFitSlideProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fittedFontSize, setFittedFontSize] = useState(baseFontSize);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Reset to base font size to recalculate from scratch
    let currentFontSize = baseFontSize;
    el.style.fontSize = `${currentFontSize}px`;

    const checkOverflow = () => {
      if (columns === 2) {
        // For 2 columns, check if the content spills into a 3rd column (horizontal overflow)
        return el.scrollWidth > el.clientWidth;
      } else {
        // Temporarily reset height to auto to measure natural content height
        const originalHeight = el.style.height;
        el.style.height = 'auto';
        const contentHeight = el.scrollHeight;
        el.style.height = originalHeight;
        
        // Add a small 2px safety buffer to ignore rounding errors
        return contentHeight > maxHeight + 2;
      }
    };

    let attempts = 0;
    // We decrease font size by 1px at a time until it fits
    while (checkOverflow() && currentFontSize > 12 && attempts < 100) {
      currentFontSize -= 1;
      el.style.fontSize = `${currentFontSize}px`;
      attempts++;
    }

    setFittedFontSize(currentFontSize);
  }, [html, baseFontSize, maxHeight, columns, width]);

  return (
    <div className="relative w-full h-full select-none" style={{ backgroundColor: settings?.presentationBackground || '#000000' }}>
      <div
        ref={containerRef}
        className={`${className} auto-fit-slide-content`}
        style={{
          width: `${width}px`,
          height: `${maxHeight}px`,
          fontSize: `${fittedFontSize}px`,
          columnWidth: columns === 2 ? `${(width - 48) / 2}px` : 'auto',
          columnCount: columns === 2 ? 2 : 'auto',
          columnGap: columns === 2 ? '48px' : '0px',
          columnFill: 'auto',
          color: settings?.presentationTextColor || '#ffffff',
          fontFamily: settings?.presentationFontFamily || 'Inter, sans-serif',
          lineHeight: '1.0',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: html || '' }}
      />
      
      <style>{`
        .auto-fit-slide-content p {
          margin-bottom: 1.25rem;
          line-height: 1.0;
          padding: 0 ${width < 600 ? '0.75rem' : '2rem'};
          break-inside: ${columns === 2 ? 'avoid-column' : 'auto'};
          max-width: 100%;
          box-sizing: border-box;
        }
        .auto-fit-slide-content p:first-child {
          padding-top: ${width < 600 ? '1rem' : '2rem'};
        }
        .auto-fit-slide-content p:last-child {
          margin-bottom: 0;
        }
        .auto-fit-slide-content br {
          display: block;
          content: "";
          margin-top: 0;
        }
        /* Alignment */
        .auto-fit-slide-content .text-align-center,
        .auto-fit-slide-content [style*="text-align: center"] {
          text-align: left !important;
        }
        .auto-fit-slide-content .text-align-right,
        .auto-fit-slide-content [style*="text-align: right"] {
          text-align: right !important;
        }
        .auto-fit-slide-content .text-align-left,
        .auto-fit-slide-content [style*="text-align: left"] {
          text-align: left !important;
        }
        .auto-fit-slide-content .text-align-justify,
        .auto-fit-slide-content [style*="text-align: justify"] {
          text-align: justify !important;
        }
        .auto-fit-slide-content p:not([class*="text-align-"]):not([style*="text-align"]) {
          text-align: left;
        }
      `}</style>
    </div>
  );
}
