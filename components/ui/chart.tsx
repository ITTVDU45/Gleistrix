"use client";
import React from 'react';

interface ChartContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ChartContainer({ children, className = "" }: ChartContainerProps) {
  return (
    <div className={`chart-container ${className}`}>
      {children}
    </div>
  );
}
