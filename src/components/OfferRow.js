// src/components/OfferRow.js
// Мемоизированный компонент строки оффера для оптимизации производительности
import React, { memo, useCallback } from 'react';
import { offerStatusService } from '../services/OffersSupabase';
import OfferStatusBadge from './OfferStatusBadge';
import OfferBuyersPanel from './OfferBuyersPanel';
import { MiniSpinner } from './LoadingSpinner';

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
  loadingBuyerStatuses,
  onOpenTooltip,
  onStatusChange,
  userName,
  userId,
  allBuyers,
  initialAssignments,
  onAssignmentsChange,
  buyerMetricsData,
  buyerStatuses,
  articleOfferMap,
  loadingBuyerIds = new Set(), // ID привязок байеров, которые сейчас загружаются
  loadingBuyerMetrics = false, // Загрузка метрик байеров за всё время
  seasons = [] // Массив сезонов ['☀️', '🍁', '❄️', '🌱']
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

  const handleSeasonClick = useCallback((e) => {
    e.stopPropagation();
    onOpenTooltip('season', index, {
      category: metric.category,
      categoryDetails: metric.categoryDetails,
      specialSeasonStart: metric.special_season_start,
      specialSeasonEnd: metric.special_season_end,
      offerName: metric.offer_name,
      article: metric.article
    }, e);
  }, [metric.category, metric.categoryDetails, metric.special_season_start, metric.special_season_end, metric.offer_name, metric.article, index, onOpenTooltip]);

  const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
  const zoneColors = getZoneColors(metric.offer_zone);
  const redZoneColors = getZoneColorsByType('red');

  return (
    <div className="bg-white hover:bg-slate-50 py-2 border-b border-slate-100">
      <div className="flex items-center text-sm text-center">
        {/* № */}
        <div className="w-[3%] min-w-[32px] text-slate-700 font-medium text-xs">{metric.id}</div>

        {/* Артикул */}
        <div
          className="w-[6%] min-w-[60px] font-mono text-xs text-slate-800 cursor-help"
          title={articleOfferMap?.[metric.article] ? `Offer ID: ${articleOfferMap[metric.article]}` : metric.article}
        >
          {metric.article || '—'}
        </div>

        {/* Название */}
        <div className="w-[14%] min-w-[120px] text-left">
          <span className="text-xs text-slate-800 truncate block" title={metric.offer}>
            {metric.offer || '—'}
          </span>
        </div>

        {/* Статус */}
        <div className="w-[8%] min-w-[80px] text-xs flex items-center justify-center gap-1">
          <OfferStatusBadge
            offerId={metric.id}
            article={metric.article}
            offerName={metric.offer}
            currentStatus={offerStatus?.current_status}
            daysInStatus={offerStatus?.days_in_status}
            onStatusChange={onStatusChange}
            userName={userName}
            userId={userId}
          />
          <button
            onClick={handleStatusHistoryClick}
            className="text-gray-500 hover:text-blue-600"
            title="История статусов"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>

        {/* CPL */}
        <div className="w-[5%] min-w-[50px] text-xs flex items-center justify-center gap-1">
          {loadingLeadsData ? (
            <MiniSpinner />
          ) : (
            <>
              <span className={`font-mono ${metric.leads_data?.[4]?.cpl != null ? 'text-slate-800' : 'text-slate-400'}`}>
                {metric.leads_data?.[4]?.cpl != null ? metric.leads_data[4].cpl.toFixed(2) : '—'}
              </span>
              {metric.leads_data && <InfoIcon onClick={handleCplClick} />}
            </>
          )}
        </div>

        {/* Лиды */}
        <div className="w-[4%] min-w-[40px] text-xs flex items-center justify-center gap-1">
          {loadingLeadsData ? (
            <MiniSpinner />
          ) : (
            <>
              <span className={`font-mono ${metric.leads_4days != null ? 'text-slate-800' : 'text-slate-400'}`}>
                {metric.leads_4days != null ? metric.leads_4days : '—'}
              </span>
              {metric.leads_data && <InfoIcon onClick={handleLeadsClick} />}
            </>
          )}
        </div>

        {/* Продажи на 1 заявку */}
        <div className="w-[4%] min-w-[36px] text-xs text-slate-800 text-center">
          {metric.k_lead != null ? Number(metric.k_lead).toFixed(2) : '—'}
        </div>

        {/* Рейтинг */}
        <div className="w-[5%] min-w-[44px] text-xs flex items-center justify-center gap-0.5">
          {loadingLeadsData ? (
            <MiniSpinner />
          ) : (
            <>
              <span
                className={`font-semibold px-1 py-0.5 rounded text-[10px] ${
                  metric.lead_rating === 'A' ? 'bg-green-100 text-green-800' :
                  metric.lead_rating === 'B' ? 'bg-yellow-100 text-yellow-800' :
                  metric.lead_rating === 'C' ? 'bg-orange-100 text-orange-800' :
                  metric.lead_rating === 'D' ? 'bg-red-100 text-red-800' :
                  'text-gray-400'
                }`}
                title={metric.rating_cpl ? `CPL: ${metric.rating_cpl.toFixed(2)}` : ''}
              >
                {metric.lead_rating || '—'}
              </span>
              {metric.rating_history?.length > 0 && <InfoIcon onClick={handleRatingClick} />}
            </>
          )}
        </div>

        {/* Реклама */}
        <div className="w-[4%] min-w-[36px] text-xs text-slate-400 text-center">—</div>

        {/* Зона эффективности */}
        <div className="w-[5%] min-w-[44px] flex items-center justify-center">
          {zoneColors && metric.actual_roi_percent ? (
            <span className={`font-mono inline-flex items-center px-1 py-0.5 rounded-full text-[10px] border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
              {Number(metric.actual_roi_percent).toFixed(2)}%
            </span>
          ) : (
            <span className="font-mono text-xs text-slate-800">{metric.actual_roi_percent ? `${Number(metric.actual_roi_percent).toFixed(2)}%` : '—'}</span>
          )}
        </div>

        {/* Цена лида в зоне */}
        <div className="w-[6%] min-w-[56px] flex items-center justify-center gap-1">
          {metric.red_zone_price != null ? (
            <>
              <span className={`font-mono inline-flex items-center px-1 py-0.5 rounded-full text-[10px] border ${redZoneColors.bg} ${redZoneColors.text} ${redZoneColors.border}`}>
                ${Number(metric.red_zone_price).toFixed(2)}
              </span>
              <InfoIcon onClick={handleZoneClick} />
            </>
          ) : (
            <>
              <span className="text-gray-400 text-xs">—</span>
              <InfoIcon onClick={handleZoneClick} />
            </>
          )}
        </div>

        {/* Дней продаж */}
        <div className="w-[5%] min-w-[48px] text-xs flex items-center justify-center">
          {loadingDays ? (
            <MiniSpinner />
          ) : (
            <span className={`font-mono ${
              metric.days_remaining != null
                ? typeof metric.days_remaining === 'number' ? 'text-slate-800' : 'text-orange-600 italic'
                : 'text-slate-400'
            }`}>
              {metric.days_remaining != null ? metric.days_remaining : '—'}
            </span>
          )}
        </div>

        {/* Остаток */}
        <div className="w-[5%] min-w-[48px] text-xs flex items-center justify-center gap-1">
          {loadingStocks ? (
            <MiniSpinner />
          ) : (
            <>
              <span className={`font-mono ${metric.stock_quantity != null ? 'text-slate-800' : 'text-slate-400'}`}>
                {metric.stock_quantity != null ? metric.stock_quantity : '—'}
              </span>
              <InfoIcon onClick={handleStockClick} />
            </>
          )}
        </div>

        {/* Дней до прихода */}
        <div className="w-[5%] min-w-[44px] font-mono text-xs flex items-center justify-center gap-1">
          {daysUntil === null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <>
              <span className={daysUntil < 0 ? 'text-red-600' : 'text-green-600'}>{daysUntil}</span>
              <InfoIcon onClick={handleDateClick} />
            </>
          )}
        </div>

        {/* % отказа от продаж */}
        <div className="w-[5%] min-w-[44px] font-mono text-xs text-slate-800 text-center">
          {metric.refusal_sales_percent ? `${Number(metric.refusal_sales_percent).toFixed(2)}%` : '—'}
        </div>

        {/* % невыкупа */}
        <div className="w-[5%] min-w-[44px] font-mono text-xs text-slate-800 text-center">
          {metric.no_pickup_percent ? `${Number(metric.no_pickup_percent).toFixed(2)}%` : '—'}
        </div>

        {/* Сезон */}
        <div className="w-[5%] min-w-[44px] text-xs text-slate-500 flex items-center justify-center gap-1">
          <span className="text-base">{seasons.length > 0 ? seasons.join('') : '—'}</span>
          <InfoIcon onClick={handleSeasonClick} />
        </div>

        {/* Цена */}
        <div className="w-[6%] min-w-[50px] font-mono text-xs text-slate-800 text-center">
          {metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}
        </div>
      </div>

      {/* Панель привязки байеров */}
      <OfferBuyersPanel
        offer={metric}
        allBuyers={allBuyers}
        initialAssignments={initialAssignments}
        onAssignmentsChange={onAssignmentsChange}
        buyerMetricsData={buyerMetricsData}
        buyerStatuses={buyerStatuses}
        loadingBuyerStatuses={loadingBuyerStatuses}
        loadingBuyerMetrics={loadingBuyerMetrics}
        loadingBuyerIds={loadingBuyerIds}
        articleOfferMap={articleOfferMap}
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
    prevProps.loadingBuyerStatuses === nextProps.loadingBuyerStatuses &&
    prevProps.userName === nextProps.userName &&
    prevProps.userId === nextProps.userId &&
    prevProps.allBuyers === nextProps.allBuyers &&
    prevProps.initialAssignments === nextProps.initialAssignments &&
    prevProps.buyerMetricsData === nextProps.buyerMetricsData &&
    prevProps.buyerStatuses === nextProps.buyerStatuses &&
    prevProps.loadingBuyerIds === nextProps.loadingBuyerIds &&
    prevProps.loadingBuyerMetrics === nextProps.loadingBuyerMetrics &&
    prevProps.articleOfferMap === nextProps.articleOfferMap &&
    prevProps.seasons === nextProps.seasons
    // onOpenTooltip, onStatusChange, onAssignmentsChange - должны быть стабильными (useCallback)
  );
});

OfferRow.displayName = 'OfferRow';

export default OfferRow;
