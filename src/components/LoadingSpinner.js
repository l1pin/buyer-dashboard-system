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

// ============================================
// SKELETON LOADING КОМПОНЕНТЫ
// Современный shimmer эффект с плавным переливанием
// ============================================

/**
 * Базовый Skeleton компонент с красивым shimmer эффектом
 * Использует CSS-анимацию для лучшей производительности
 * @param {string} variant - 'default' | 'blue' | 'pulse' - стиль shimmer эффекта
 */
export const Skeleton = memo(({ className = "", style = {}, variant = "blue" }) => {
  const shimmerClass = variant === "pulse"
    ? "skeleton-shimmer-pulse"
    : variant === "blue"
      ? "skeleton-shimmer-blue"
      : "skeleton-shimmer";

  return (
    <div
      className={`${shimmerClass} rounded ${className}`}
      style={style}
    />
  );
});

Skeleton.displayName = 'Skeleton';

/**
 * Skeleton для текста - с вариантами ширины
 */
export const SkeletonText = memo(({ width = "100%", height = "h-4", className = "", variant = "blue" }) => (
  <Skeleton className={`${height} ${className}`} style={{ width }} variant={variant} />
));

SkeletonText.displayName = 'SkeletonText';

/**
 * Skeleton для круглых элементов (аватары)
 * Добавлен subtle shadow для объема
 */
export const SkeletonCircle = memo(({ size = 40, variant = "blue" }) => (
  <Skeleton
    className="rounded-full flex-shrink-0 shadow-sm"
    style={{ width: size, height: size }}
    variant={variant}
  />
));

SkeletonCircle.displayName = 'SkeletonCircle';

/**
 * Skeleton для карточки байера
 * Показывает реальные метки, skeleton только на значениях
 */
export const SkeletonBuyerCard = memo(() => (
  <div className="flex-shrink-0 w-32 rounded-xl bg-white border border-gray-100 overflow-hidden shadow-sm">
    <div className="flex flex-col items-center text-center space-y-2 p-2">
      {/* Аватар */}
      <SkeletonCircle size={40} />

      {/* Имя */}
      <Skeleton className="h-3 w-16" />

      {/* Дата */}
      <Skeleton className="h-2 w-12" />

      {/* Таймер placeholder */}
      <div className="h-5" />

      {/* Метрики - реальные метки, skeleton только на значениях */}
      <div className="w-full text-[9px] text-gray-500 space-y-0.5">
        <div className="flex justify-between px-1">
          <span>CPL:</span>
          <Skeleton className="h-2.5 w-8" />
        </div>
        <div className="flex justify-between px-1">
          <span>Lead:</span>
          <Skeleton className="h-2.5 w-5" />
        </div>
        <div className="flex justify-between px-1">
          <span>Cost:</span>
          <Skeleton className="h-2.5 w-10" />
        </div>
      </div>
    </div>

    {/* Статус бар */}
    <Skeleton className="h-6 rounded-none" variant="pulse" />
  </div>
));

SkeletonBuyerCard.displayName = 'SkeletonBuyerCard';

/**
 * Skeleton для строки метрик в карточке байера
 * Показывает реальные метки, skeleton только на значениях
 */
export const SkeletonMetrics = memo(() => (
  <div className="w-full text-[9px] text-gray-500 space-y-0.5">
    <div className="flex justify-between px-1">
      <span>CPL:</span>
      <Skeleton className="h-2.5 w-8" />
    </div>
    <div className="flex justify-between px-1">
      <span>Lead:</span>
      <Skeleton className="h-2.5 w-5" />
    </div>
    <div className="flex justify-between px-1">
      <span>Cost:</span>
      <Skeleton className="h-2.5 w-10" />
    </div>
  </div>
));

SkeletonMetrics.displayName = 'SkeletonMetrics';

/**
 * Skeleton для одной метрики (CPL, Leads, и т.д.)
 */
export const SkeletonMetricValue = memo(({ width = "w-12" }) => (
  <Skeleton className={`h-4 ${width} rounded`} />
));

SkeletonMetricValue.displayName = 'SkeletonMetricValue';

/**
 * Skeleton для строки таблицы офферов
 */
export const SkeletonOfferRow = memo(() => (
  <div className="flex items-center py-3 px-4 border-b border-gray-100 animate-pulse">
    {/* Checkbox */}
    <div className="w-8">
      <Skeleton className="h-4 w-4 rounded" />
    </div>

    {/* Артикул */}
    <div className="w-24">
      <SkeletonText width="70%" height="h-4" />
    </div>

    {/* Название */}
    <div className="flex-1 min-w-0 px-2">
      <SkeletonText width="60%" height="h-4" />
    </div>

    {/* Статус */}
    <div className="w-32 px-2">
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>

    {/* Дни продаж */}
    <div className="w-20 px-2">
      <SkeletonText width="60%" height="h-4" />
    </div>

    {/* Рейтинг */}
    <div className="w-16 px-2">
      <SkeletonText width="50%" height="h-4" />
    </div>

    {/* CPL */}
    <div className="w-20 px-2">
      <SkeletonText width="70%" height="h-4" />
    </div>

    {/* Leads */}
    <div className="w-16 px-2">
      <SkeletonText width="50%" height="h-4" />
    </div>

    {/* Cost */}
    <div className="w-20 px-2">
      <SkeletonText width="70%" height="h-4" />
    </div>
  </div>
));

SkeletonOfferRow.displayName = 'SkeletonOfferRow';

/**
 * Иконки источников для skeleton (упрощенные версии)
 */
const SkeletonSourceIcon = memo(({ source }) => {
  const icons = {
    Facebook: (
      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    Google: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#EA4335" d="M5.26 9.76A7.05 7.05 0 0 1 12 5.04c1.73 0 3.29.61 4.52 1.61l3.39-3.39A11.92 11.92 0 0 0 12 0 12 12 0 0 0 1.24 6.65l4.02 3.11z"/>
        <path fill="#34A853" d="M16.04 18.01A7.05 7.05 0 0 1 12 19.04 7.05 7.05 0 0 1 5.26 14.24l-4.02 3.11A12 12 0 0 0 12 24c3.24 0 6.22-1.29 8.4-3.41l-4.36-2.58z"/>
        <path fill="#4A90D9" d="M20.4 20.59A11.87 11.87 0 0 0 24 12c0-.82-.08-1.61-.23-2.38H12v4.76h6.74a5.83 5.83 0 0 1-2.5 3.81l4.16 2.4z"/>
        <path fill="#FBBC05" d="M5.26 14.24A7.05 7.05 0 0 1 4.92 12c0-.79.13-1.55.34-2.24L1.24 6.65A12 12 0 0 0 0 12c0 1.93.46 3.76 1.24 5.35l4.02-3.11z"/>
      </svg>
    ),
    TikTok: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    )
  };
  return icons[source] || null;
});

SkeletonSourceIcon.displayName = 'SkeletonSourceIcon';

/**
 * Skeleton для панели байеров оффера
 * С реальными иконками источников для узнаваемости
 */
export const SkeletonBuyersPanel = memo(() => (
  <div className="mt-2 bg-white rounded-lg border border-gray-200 shadow-sm">
    {/* Фильтры */}
    <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
      {['Все', 'Неактивные', 'Нет в трекере', 'Не настроено', 'Активные'].map((label, i) => (
        <div
          key={i}
          className={`px-2.5 py-1 text-xs rounded ${i === 0 ? 'bg-blue-100 text-blue-300' : 'bg-gray-100 text-gray-300'}`}
        >
          {label}
        </div>
      ))}
    </div>

    {/* Источники */}
    <div className="grid grid-cols-3">
      {['Facebook', 'Google', 'TikTok'].map((source, idx) => (
        <div
          key={source}
          className={`px-4 py-3 ${idx < 2 ? 'border-r border-gray-200' : ''}`}
        >
          {/* Заголовок источника - с реальной иконкой */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <SkeletonSourceIcon source={source} />
              <span className="text-sm font-medium text-gray-400">{source}</span>
              <span className="text-xs text-gray-300">(0)</span>
            </div>
            <div className="p-1.5 rounded-md bg-gray-50">
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>

          {/* Карточки байеров */}
          <div className="flex flex-row gap-2.5 overflow-hidden pb-2">
            {[1, 2].map(i => (
              <SkeletonBuyerCard key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
));

SkeletonBuyersPanel.displayName = 'SkeletonBuyersPanel';

/**
 * Skeleton для статус бара
 */
export const SkeletonStatusBar = memo(() => (
  <Skeleton className="h-6 w-full rounded-none" />
));

SkeletonStatusBar.displayName = 'SkeletonStatusBar';

/**
 * Красивый большой спиннер для загрузки страницы офферов
 */
export const SkeletonOffersPage = memo(() => (
  <div className="h-full flex flex-col bg-slate-50">
    {/* Центрированный контент */}
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        {/* Красивый анимированный спиннер */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          {/* Внешний круг */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          {/* Анимированный градиентный круг */}
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-400 animate-spin"></div>
          {/* Внутренний пульсирующий круг */}
          <div className="absolute inset-3 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 animate-pulse"></div>
          {/* Иконка в центре */}
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        </div>

        {/* Текст */}
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Загрузка офферов...
        </h2>
        <p className="text-sm text-gray-500">
          Пожалуйста, подождите
        </p>

        {/* Анимированные точки */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  </div>
));

SkeletonOffersPage.displayName = 'SkeletonOffersPage';

// CSS для shimmer эффекта (добавить в глобальные стили или использовать inline)
// @keyframes shimmer {
//   0% { background-position: 200% 0; }
//   100% { background-position: -200% 0; }
// }

export default MiniSpinner;
