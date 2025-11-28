// src/components/LoadingSpinner.js
import React, { memo } from 'react';

/**
 * Минималистичный спиннер для отображения загрузки
 * Оптимизирован для производительности
 */
export const MiniSpinner = memo(() => (
  <div className="inline-flex items-center justify-center">
    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
  </div>
));

MiniSpinner.displayName = 'MiniSpinner';

/**
 * Три движущиеся точки для индикации загрузки
 * Используется в статусах байеров
 */
export const LoadingDots = memo(({ className = "" }) => (
  <div className={`inline-flex items-center space-x-1.5 ${className}`}>
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }}></div>
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }}></div>
    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }}></div>
  </div>
));

LoadingDots.displayName = 'LoadingDots';

export default MiniSpinner;
