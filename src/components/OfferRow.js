// src/components/OfferRow.js
// Мемоизированный компонент строки оффера для оптимизации производительности
import React, { memo, useCallback } from 'react';
import { offerStatusService } from '../services/OffersSupabase';
import OfferStatusBadge from './OfferStatusBadge';
import OfferBuyersPanel from './OfferBuyersPanel';

// Иконка информации - вынесена отдельно для переиспользования
const InfoIcon = memo(({ onClick, className = "text-gray-500 w-3 h-3" }) => (
  <svg
    className={`${className} cursor-pointer hover:text-gray-700`}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
));

// Статическая иконка (без onClick)
const StaticInfoIcon = memo(() => (
  <svg className="text-gray-500 w-3 h-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
));

// Утилиты для цветов зон
const getZoneColors = (zoneName) => {
  if (!zoneName) return null;
  const name = zoneName.toLowerCase();
  if (name.includes('sos')) return { bg: 'bg-black', text: 'text-yellow-400', border: 'border-black' };
  if (name.includes('красн')) return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
  if (name.includes('розов')) return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
  if (name.includes('золот')) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
  if (name.includes('зелен')) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
  return null;
};

const getZoneColorsByType = (zoneType) => {
  switch (zoneType) {
    case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
    case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
    case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    default: return null;
  }
};

const calculateDaysUntilArrival = (dateString) => {
  if (!dateString) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arrivalDate = new Date(dateString);
    arrivalDate.setHours(0, 0, 0, 0);
    const diffTime = arrivalDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
};

const OfferRow = memo(({
  metric,
  index,
  offerStatus,
  loadingLeadsData,
  loadingDays,
  loadingStocks,
  onOpenTooltip,
  onStatusChange,
  userName,
  allBuyers,
  initialAssignments,
  onAssignmentsChange
}) => {
  // Мемоизированные обработчики для этой строки
  const handleStatusHistoryClick = useCallback(async (e) => {
    e.stopPropagation();
    const buttonElement = e.currentTarget;
    const rect = buttonElement.getBoundingClientRect();
    const savedEvent = {
      currentTarget: buttonElement,
      clientX: rect.left + rect.width + 10,
      clientY: rect.top
    };
    try {
      const statusHistory = await offerStatusService.getOfferStatusHistory(metric.id);
      onOpenTooltip('status_history', index, {
        statusHistory,
        offerName: metric.offer,
        article: metric.article
      }, savedEvent);
    } catch (error) {
      console.error('Ошибка загрузки истории статусов:', error);
    }
  }, [metric.id, metric.offer, metric.article, index, onOpenTooltip]);

  const handleCplClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('cpl', index, {
      leadsData: metric.leads_data,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric.leads_data, metric.offer_name, metric.article, index, onOpenTooltip]);

  const handleLeadsClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('leads', index, {
      leadsData: metric.leads_data,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric.leads_data, metric.offer_name, metric.article, index, onOpenTooltip]);

  const handleRatingClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('rating', index, {
      ratingHistory: metric.rating_history,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric.rating_history, metric.offer_name, metric.article, index, onOpenTooltip]);

  const handleZoneClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('zone', index, {
      metric,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric, index, onOpenTooltip]);

  const handleStockClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('stock', index, {
      article: metric.article,
      offerName: metric.offer_name
    }, e);
  }, [metric.article, metric.offer_name, index, onOpenTooltip]);

  const handleDateClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('date', index, {
      date: metric.date_arrival,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric.date_arrival, metric.offer_name, metric.article, index, onOpenTooltip]);

  const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
  const zoneColors = getZoneColors(metric.offer_zone);
  const redZoneColors = getZoneColorsByType('red');

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-2">
      <div className="flex items-center gap-2 text-sm text-center min-w-max">
        {/* № */}
        <div className="w-12 flex-shrink-0 text-gray-900">{metric.id}</div>

        {/* Артикул */}
        <div className="w-24 flex-shrink-0 font-mono text-xs text-gray-900">{metric.article || '—'}</div>

        {/* Название */}
        <div className="w-48 flex-shrink-0 text-left">
          <span className="text-sm text-gray-900 truncate block" title={metric.offer}>
            {metric.offer || '—'}
          </span>
        </div>

        {/* Статус */}
        <div className="w-32 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          <OfferStatusBadge
            offerId={metric.id}
            article={metric.article}
            offerName={metric.offer}
            currentStatus={offerStatus?.current_status}
            daysInStatus={offerStatus?.days_in_status}
            onStatusChange={onStatusChange}
            userName={userName}
          />
          <button
            onClick={handleStatusHistoryClick}
            className="text-gray-500 hover:text-blue-600 transition-colors"
            title="Показать историю статусов"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>

        {/* CPL 4 дн. */}
        <div className="w-20 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          {loadingLeadsData ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <span className={`font-mono ${metric.leads_data?.[4]?.cpl != null ? 'text-gray-900' : 'text-gray-600'}`}>
                {metric.leads_data?.[4]?.cpl != null ? metric.leads_data[4].cpl.toFixed(2) : '—'}
              </span>
              {metric.leads_data && <InfoIcon onClick={handleCplClick} />}
            </>
          )}
        </div>

        {/* Лиды 4 дн. */}
        <div className="w-20 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          {loadingLeadsData ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <span className={`font-mono ${metric.leads_4days != null ? 'text-gray-900' : 'text-gray-600'}`}>
                {metric.leads_4days != null ? metric.leads_4days : '—'}
              </span>
              {metric.leads_data && <InfoIcon onClick={handleLeadsClick} />}
            </>
          )}
        </div>

        {/* Продажи на 1 заявку */}
        <div className="w-12 flex-shrink-0 text-xs text-gray-900 text-center">
          {metric.k_lead != null ? Number(metric.k_lead).toFixed(2) : '—'}
        </div>

        {/* Рейтинг */}
        <div className="w-12 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          {loadingLeadsData ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <span
                className={`font-semibold px-1.5 py-0.5 rounded ${
                  metric.lead_rating === 'A' ? 'bg-green-100 text-green-800' :
                  metric.lead_rating === 'B' ? 'bg-blue-100 text-blue-800' :
                  metric.lead_rating === 'C' ? 'bg-yellow-100 text-yellow-800' :
                  metric.lead_rating === 'D' ? 'bg-red-100 text-red-800' :
                  'text-gray-400'
                }`}
                title={metric.rating_cpl ? `CPL: ${metric.rating_cpl.toFixed(2)}` : 'Нет данных'}
              >
                {metric.lead_rating || 'N/A'}
              </span>
              {metric.rating_history?.length > 0 && <InfoIcon onClick={handleRatingClick} />}
            </>
          )}
        </div>

        {/* Реклама */}
        <div className="w-12 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
          <span>—</span>
          <StaticInfoIcon />
        </div>

        {/* Зона эффективности */}
        <div className="w-16 flex-shrink-0 flex items-center justify-center gap-1">
          {zoneColors && metric.actual_roi_percent ? (
            <>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
                {Number(metric.actual_roi_percent).toFixed(1)}%
              </span>
              <StaticInfoIcon />
            </>
          ) : (
            <>
              <span className="font-mono text-xs text-gray-900">{metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(1)}%` : '—'}</span>
              <StaticInfoIcon />
            </>
          )}
        </div>

        {/* Цена лида в зоне */}
        <div className="w-20 flex-shrink-0 flex items-center justify-center gap-1">
          {metric.red_zone_price != null ? (
            <>
              <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs border ${redZoneColors.bg} ${redZoneColors.text} ${redZoneColors.border}`}>
                ${Number(metric.red_zone_price).toFixed(2)}
              </span>
              <InfoIcon onClick={handleZoneClick} />
            </>
          ) : (
            <>
              <span className="text-gray-500 italic text-xs">нет данных</span>
              <InfoIcon onClick={handleZoneClick} />
            </>
          )}
        </div>

        {/* Дней продаж */}
        <div className="w-16 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          {loadingDays ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <span className={`font-mono ${
                metric.days_remaining != null
                  ? typeof metric.days_remaining === 'number' ? 'text-gray-900' : 'text-orange-600 text-xs italic'
                  : 'text-gray-600'
              }`}>
                {metric.days_remaining != null ? metric.days_remaining : '—'}
              </span>
              <StaticInfoIcon />
            </>
          )}
        </div>

        {/* Остаток */}
        <div className="w-16 flex-shrink-0 text-xs flex items-center justify-center gap-1">
          {loadingStocks ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          ) : (
            <>
              <span className={`font-mono ${metric.stock_quantity != null ? 'text-gray-900' : 'text-gray-600'}`}>
                {metric.stock_quantity != null ? metric.stock_quantity : '—'}
              </span>
              <InfoIcon onClick={handleStockClick} />
            </>
          )}
        </div>

        {/* Дней до прихода */}
        <div className="w-20 flex-shrink-0 font-mono text-xs flex items-center justify-center gap-1">
          {daysUntil === null ? (
            <>
              <span className="text-gray-900">—</span>
              <InfoIcon onClick={handleDateClick} />
            </>
          ) : (
            <>
              <span className={daysUntil < 0 ? 'text-red-600' : 'text-green-600'}>{daysUntil}</span>
              <InfoIcon onClick={handleDateClick} />
            </>
          )}
        </div>

        {/* % отказа от продаж */}
        <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
          <span>{metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(1)}%` : '—'}</span>
          <StaticInfoIcon />
        </div>

        {/* % невыкупа */}
        <div className="w-16 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
          <span>{metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(1)}%` : '—'}</span>
          <StaticInfoIcon />
        </div>

        {/* Сезон */}
        <div className="w-16 flex-shrink-0 text-xs text-gray-600 flex items-center justify-center gap-1">
          <span>—</span>
          <StaticInfoIcon />
        </div>

        {/* Цена */}
        <div className="w-20 flex-shrink-0 font-mono text-xs text-gray-900 flex items-center justify-center gap-1">
          <span>{metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}</span>
          <StaticInfoIcon />
        </div>
      </div>

      {/* Панель привязки байеров */}
      <OfferBuyersPanel
        offer={metric}
        allBuyers={allBuyers}
        initialAssignments={initialAssignments}
        onAssignmentsChange={onAssignmentsChange}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения для memo
  // Возвращает true если props НЕ изменились (не нужен ре-рендер)
  return (
    prevProps.metric === nextProps.metric &&
    prevProps.index === nextProps.index &&
    prevProps.offerStatus === nextProps.offerStatus &&
    prevProps.loadingLeadsData === nextProps.loadingLeadsData &&
    prevProps.loadingDays === nextProps.loadingDays &&
    prevProps.loadingStocks === nextProps.loadingStocks &&
    prevProps.userName === nextProps.userName &&
    prevProps.allBuyers === nextProps.allBuyers &&
    prevProps.initialAssignments === nextProps.initialAssignments
    // onOpenTooltip, onStatusChange, onAssignmentsChange - должны быть стабильными (useCallback)
  );
});

OfferRow.displayName = 'OfferRow';

export default OfferRow;
