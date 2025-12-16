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
// ============================================

/**
 * Базовый Skeleton компонент с пульсацией
 */
export const Skeleton = memo(({ className = "", style = {} }) => (
  <div
    className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
    style={{
      animation: 'shimmer 1.5s infinite',
      ...style
    }}
  />
));

Skeleton.displayName = 'Skeleton';

/**
 * Skeleton для текста
 */
export const SkeletonText = memo(({ width = "100%", height = "h-4", className = "" }) => (
  <Skeleton className={`${height} ${className}`} style={{ width }} />
));

SkeletonText.displayName = 'SkeletonText';

/**
 * Skeleton для круглых элементов (аватары)
 */
export const SkeletonCircle = memo(({ size = 40 }) => (
  <Skeleton
    className="rounded-full flex-shrink-0"
    style={{ width: size, height: size }}
  />
));

SkeletonCircle.displayName = 'SkeletonCircle';

/**
 * Skeleton для карточки байера
 */
export const SkeletonBuyerCard = memo(() => (
  <div className="flex-shrink-0 w-32 rounded-lg bg-white border border-gray-200 overflow-hidden">
    <div className="flex flex-col items-center text-center space-y-2 p-2">
      {/* Аватар */}
      <SkeletonCircle size={40} />

      {/* Имя */}
      <SkeletonText width="80%" height="h-3" />

      {/* Дата */}
      <SkeletonText width="60%" height="h-2" />

      {/* Таймер placeholder */}
      <div className="h-5" />

      {/* Метрики */}
      <div className="w-full space-y-1">
        <div className="flex justify-between px-1">
          <SkeletonText width="30%" height="h-2" />
          <SkeletonText width="40%" height="h-2" />
        </div>
        <div className="flex justify-between px-1">
          <SkeletonText width="30%" height="h-2" />
          <SkeletonText width="35%" height="h-2" />
        </div>
        <div className="flex justify-between px-1">
          <SkeletonText width="30%" height="h-2" />
          <SkeletonText width="45%" height="h-2" />
        </div>
      </div>
    </div>

    {/* Статус бар */}
    <Skeleton className="h-6 rounded-none" />
  </div>
));

SkeletonBuyerCard.displayName = 'SkeletonBuyerCard';

/**
 * Skeleton для строки метрик в карточке байера
 */
export const SkeletonMetrics = memo(() => (
  <div className="w-full space-y-1">
    <div className="flex justify-between px-1">
      <SkeletonText width="30%" height="h-2" />
      <SkeletonText width="40%" height="h-2" />
    </div>
    <div className="flex justify-between px-1">
      <SkeletonText width="30%" height="h-2" />
      <SkeletonText width="35%" height="h-2" />
    </div>
    <div className="flex justify-between px-1">
      <SkeletonText width="30%" height="h-2" />
      <SkeletonText width="45%" height="h-2" />
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
 * Skeleton для панели байеров оффера
 */
export const SkeletonBuyersPanel = memo(() => (
  <div className="mt-2 bg-white rounded-lg border border-gray-200">
    {/* Фильтры */}
    <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Skeleton key={i} className="h-6 w-16 rounded" />
      ))}
    </div>

    {/* Источники */}
    <div className="grid grid-cols-3">
      {['Facebook', 'Google', 'TikTok'].map((source, idx) => (
        <div
          key={source}
          className={`px-4 py-3 ${idx < 2 ? 'border-r border-gray-200' : ''}`}
        >
          {/* Заголовок источника */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-5 w-5 rounded" />
              <SkeletonText width="60px" height="h-4" />
              <SkeletonText width="20px" height="h-3" />
            </div>
            <Skeleton className="h-6 w-6 rounded" />
          </div>

          {/* Карточки байеров */}
          <div className="flex flex-row gap-2.5 overflow-hidden">
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
 * Skeleton для полной страницы загрузки офферов
 */
export const SkeletonOffersPage = memo(() => (
  <div className="space-y-4 p-4">
    {/* Заголовок и кнопки */}
    <div className="flex justify-between items-center">
      <SkeletonText width="200px" height="h-8" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>

    {/* Поиск и фильтры */}
    <div className="flex gap-4">
      <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
      <Skeleton className="h-10 w-40 rounded-lg" />
    </div>

    {/* Таблица */}
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Заголовок таблицы */}
      <div className="flex items-center py-3 px-4 bg-gray-50 border-b border-gray-200">
        {[40, 80, 200, 120, 80, 60, 80, 60, 80].map((w, i) => (
          <div key={i} style={{ width: w }} className="px-2">
            <SkeletonText width="80%" height="h-4" />
          </div>
        ))}
      </div>

      {/* Строки */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <SkeletonOfferRow key={i} />
      ))}
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
