'use client';
import { useState, useRef, useEffect, ReactNode } from 'react';

type Props = {
  leftPane: ReactNode;
  rightPane: ReactNode;
  minLeftWidth?: number;
  minRightWidth?: number;
  defaultLeftWidth?: number;
};

export default function ResizablePanes({
  leftPane,
  rightPane,
  minLeftWidth = 40,
  minRightWidth = 15,
  defaultLeftWidth = 70,
}: Props) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth); // default 70%
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp the width between min and max
      const maxLeftWidth = 100 - minRightWidth;
      const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));

      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  return (
    <div
      ref={containerRef}
      className="flex h-[calc(100vh-64px)] min-h-0 min-w-0 bg-white dark:bg-neutral-950"
      style={{ userSelect: isDragging ? 'none' : 'auto' }}
    >
      <div
        className="min-h-0 min-w-0 overflow-auto border-r border-black/10 bg-neutral-50/70 dark:border-white/10 dark:bg-neutral-950"
        style={{ width: `${leftWidth}%`, minWidth: `${minLeftWidth}%` }}
      >
        {leftPane}
      </div>

      <div
        className="w-1 shrink-0 cursor-col-resize bg-black/[0.03] transition-colors hover:bg-neutral-300 active:bg-neutral-400 dark:bg-white/[0.04] dark:hover:bg-neutral-700"
        role="separator"
        onMouseDown={handleMouseDown}
      />

      <div className="min-h-0 min-w-0 flex-1 overflow-auto" style={{ minWidth: `${minRightWidth}%` }}>
        {rightPane}
      </div>
    </div>
  );
}
