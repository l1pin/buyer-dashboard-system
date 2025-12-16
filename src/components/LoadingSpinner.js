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
 * Полностью повторяет структуру реальной карточки
 */
export const SkeletonBuyerCard = memo(() => (
  <div className="flex-shrink-0 w-32 rounded-lg bg-white border border-gray-100 overflow-hidden shadow-sm">
    <div className="flex flex-col items-center text-center space-y-2 p-2">
      {/* Аватар */}
      <SkeletonCircle size={40} />

      {/* Имя */}
      <SkeletonText width="80%" height="h-3" className="mx-auto" />

      {/* Дата */}
      <SkeletonText width="60%" height="h-2" className="mx-auto" />

      {/* Таймер placeholder */}
      <div className="h-5 flex items-center justify-center">
        <Skeleton className="h-4 w-12 rounded" variant="default" />
      </div>

      {/* Метрики */}
      <div className="w-full space-y-1.5 py-1">
        <div className="flex justify-between px-1 items-center">
          <span className="text-[9px] text-gray-300">CPL:</span>
          <SkeletonText width="40%" height="h-2" />
        </div>
        <div className="flex justify-between px-1 items-center">
          <span className="text-[9px] text-gray-300">Lead:</span>
          <SkeletonText width="30%" height="h-2" />
        </div>
        <div className="flex justify-between px-1 items-center">
          <span className="text-[9px] text-gray-300">Cost:</span>
          <SkeletonText width="45%" height="h-2" />
        </div>
      </div>
    </div>

    {/* Статус бар - используем pulse для разнообразия */}
    <Skeleton className="h-6 rounded-none" variant="pulse" />
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
 * Skeleton для полной страницы загрузки офферов
 * Показывает полную структуру страницы включая источники трафика
 * С реальными заголовками для узнаваемости интерфейса
 */
export const SkeletonOffersPage = memo(() => (
  <div className="h-full flex flex-col bg-slate-50">
    {/* Header - с реальным заголовком */}
    <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Офферы</h1>
        </div>
        <div className="flex items-center space-x-3">
          {/* Кнопки действий - skeleton */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Обновить статусы
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-sm">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Обновить метрики
          </div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="mt-4 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm"
            placeholder="Поиск по артикулу или названию..."
            disabled
          />
        </div>
        <Skeleton className="h-9 w-44 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>
    </div>

    {/* Контент */}
    <div className="flex-1 overflow-auto px-6 py-4">
      {/* Заголовок таблицы - с реальными названиями колонок */}
      <div className="bg-white sticky top-0 z-10 border-b-2 border-slate-200 rounded-t-lg shadow-sm">
        <div className="flex items-center text-xs font-medium text-slate-500 py-3 px-2">
          <div className="w-[3%] min-w-[32px] text-center">№</div>
          <div className="w-[6%] min-w-[60px]">Артикул</div>
          <div className="w-[14%] min-w-[120px]">Название</div>
          <div className="w-[8%] min-w-[80px] text-center">Статус</div>
          <div className="w-[5%] min-w-[50px] text-center">CPL</div>
          <div className="w-[4%] min-w-[40px] text-center">Лиды</div>
          <div className="w-[4%] min-w-[36px] text-center">К/л</div>
          <div className="w-[5%] min-w-[44px] text-center">Рейт</div>
          <div className="w-[4%] min-w-[36px] text-center">Рекл</div>
          <div className="w-[5%] min-w-[44px] text-center">Зона</div>
          <div className="w-[6%] min-w-[56px] text-center">Цена зоны</div>
          <div className="w-[5%] min-w-[48px] text-center">Дней</div>
          <div className="w-[5%] min-w-[48px] text-center">Остаток</div>
          <div className="w-[5%] min-w-[44px] text-center">Приход</div>
        </div>
      </div>

      {/* Строки офферов с панелями байеров */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white py-2 border-b border-slate-100">
          {/* Строка данных оффера */}
          <div className="flex items-center text-sm text-center">
            <div className="w-[3%] min-w-[32px] text-slate-300 text-xs">{i}</div>
            <div className="w-[6%] min-w-[60px]"><Skeleton className="h-3.5 w-14 rounded" /></div>
            <div className="w-[14%] min-w-[120px] text-left"><Skeleton className="h-3.5 w-28 rounded" /></div>
            <div className="w-[8%] min-w-[80px]"><Skeleton className="h-5 w-16 rounded-full mx-auto" variant="pulse" /></div>
            <div className="w-[5%] min-w-[50px]"><Skeleton className="h-3.5 w-10 rounded mx-auto" /></div>
            <div className="w-[4%] min-w-[40px]"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></div>
            <div className="w-[4%] min-w-[36px]"><Skeleton className="h-3.5 w-8 rounded mx-auto" /></div>
            <div className="w-[5%] min-w-[44px]"><Skeleton className="h-4 w-5 rounded mx-auto" variant="pulse" /></div>
            <div className="w-[4%] min-w-[36px] text-slate-300 text-xs">—</div>
            <div className="w-[5%] min-w-[44px]"><Skeleton className="h-3.5 w-12 rounded mx-auto" /></div>
            <div className="w-[6%] min-w-[56px]"><Skeleton className="h-4 w-14 rounded-full mx-auto" variant="pulse" /></div>
            <div className="w-[5%] min-w-[48px]"><Skeleton className="h-3.5 w-8 rounded mx-auto" /></div>
            <div className="w-[5%] min-w-[48px]"><Skeleton className="h-3.5 w-8 rounded mx-auto" /></div>
            <div className="w-[5%] min-w-[44px]"><Skeleton className="h-3.5 w-6 rounded mx-auto" /></div>
          </div>

          {/* Панель байеров с источниками */}
          <SkeletonBuyersPanel />
        </div>
      ))}

      {/* Индикатор загрузки внизу */}
      <div className="flex items-center justify-center py-6 text-gray-400 text-sm">
        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Загрузка данных...
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
