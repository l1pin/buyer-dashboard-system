// src/components/OfferBuyersPanel.js
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList } from 'react-window';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import { Plus, X, Loader2, Archive, AlertTriangle, Info, Clock, RotateCcw, Search, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { offerBuyersService } from '../services/OffersSupabase';
import { aggregateMetricsByActiveDays, calculateConsecutiveActiveDays, findLastActiveDate } from '../scripts/offers/Sql_leads';
import { getAssignmentKey, BUYER_STATUS_CONFIG, checkBuyerHasSpend } from '../scripts/offers/Update_buyer_statuses';
import BuyerMetricsCalendar from './BuyerMetricsCalendar';
import Portal from './Portal';
import DraggableTooltip from './DraggableTooltip';
import { MiniSpinner, LoadingDots, SkeletonMetrics, Skeleton } from './LoadingSpinner';

// Порог для виртуализации - виртуализируем только если байеров больше этого числа
const VIRTUALIZATION_THRESHOLD = 5;

// Модальное окно выбора причины удаления - изолированный компонент для предотвращения потери фокуса
const RemovalReasonModal = React.memo(function RemovalReasonModal({
  buyerName,
  onConfirm,
  onCancel
}) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const textareaRef = useRef(null);

  const handleConfirm = useCallback(() => {
    const finalReason = reason === 'other' ? 'Другое' : reason;
    onConfirm(finalReason, details);
  }, [reason, details, onConfirm]);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Укажите причину удаления
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Байер: {buyerName}
            </p>
          </div>

          <div className="px-6 py-4 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="removalReason"
                value="Передумал"
                checked={reason === 'Передумал'}
                onChange={(e) => setReason(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Передумал</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="removalReason"
                value="Мисклик"
                checked={reason === 'Мисклик'}
                onChange={(e) => setReason(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Мисклик</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
              <input
                type="radio"
                name="removalReason"
                value="other"
                checked={reason === 'other'}
                onChange={(e) => setReason(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">Другое</span>
            </label>

            {reason === 'other' && (
              <textarea
                ref={textareaRef}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Укажите причину..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                autoFocus
              />
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={!reason || (reason === 'other' && !details.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
});

// Модальное окно для раннего удаления (в первые 3 минуты) - простое подтверждение
const EarlyRemovalModal = React.memo(function EarlyRemovalModal({
  buyerName,
  onConfirm,
  onCancel
}) {
  return (
    <Portal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Удалить привязку?
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Байер: <span className="font-medium text-gray-700">{buyerName}</span>
            </p>
          </div>

          <div className="px-6 py-4">
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-800">
                Удаление в первые 3 минуты — без указания причины
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
});

// Ширина одной карточки байера (w-32 = 128px + gap 10px)
const BUYER_CARD_WIDTH = 138;

// Константа: время в миллисекундах для "раннего удаления" (3 минуты)
const EARLY_REMOVAL_PERIOD = 3 * 60 * 1000;

// Маппинг статуса на цвет полоски (вынесено для оптимизации)
const STATUS_BAR_COLORS = {
  archived: 'bg-gray-400',
  active: 'bg-green-500',
  not_configured: 'bg-red-500',
  not_in_tracker: 'bg-purple-500',
  loading: 'bg-gray-400', // Статус загружается
  default: 'bg-gray-500'
};

// Локальная конфигурация для статуса 'loading' (не экспортируется из Update_buyer_statuses)
const LOCAL_STATUS_CONFIG = {
  loading: {
    label: 'Загрузка...',
    color: 'bg-gray-100',
    textColor: 'text-gray-500',
    borderColor: 'border-gray-200'
  }
};

// Оптимизированный компонент аватара с blur placeholder и lazy loading
const OptimizedAvatar = React.memo(function OptimizedAvatar({ src, alt, fallbackLetter, size = 40 }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  // IntersectionObserver для ленивой загрузки
  useEffect(() => {
    if (!src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Начинаем загрузку за 100px до появления
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  // Если нет URL или ошибка - показываем fallback с буквой
  if (!src || hasError) {
    return (
      <div
        className="rounded-full bg-gray-100 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-gray-600 text-sm font-medium">
          {fallbackLetter || 'B'}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={imgRef}
      className="relative rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      {/* Blur placeholder - показывается пока изображение не загружено */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Само изображение - загружается только когда в viewport */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          decoding="async"
        />
      )}
    </div>
  );
});

// Функция форматирования даты (вынесена для оптимизации)
const formatAssignmentDateStatic = (createdAt) => {
  if (!createdAt) return { date: '—', days: 0 };
  const date = new Date(createdAt);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const formattedDate = date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return { date: formattedDate, days: diffDays };
};

// Оптимизированный компонент таймера - не вызывает ре-рендер родителя
const CountdownTimer = React.memo(function CountdownTimer({ createdAt }) {
  // Функция расчёта оставшегося времени
  const calculateRemaining = useCallback(() => {
    if (!createdAt) return null;
    const elapsed = Date.now() - new Date(createdAt).getTime();
    const rem = EARLY_REMOVAL_PERIOD - elapsed;
    return rem > 0 ? rem : null;
  }, [createdAt]);

  const [remaining, setRemaining] = useState(calculateRemaining);

  // ВАЖНО: Пересчитываем remaining когда createdAt меняется (для realtime)
  useEffect(() => {
    setRemaining(calculateRemaining());
  }, [calculateRemaining]);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;

    const interval = setInterval(() => {
      const newRemaining = calculateRemaining();
      if (newRemaining === null || newRemaining <= 0) {
        setRemaining(null);
      } else {
        setRemaining(newRemaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, remaining]);

  if (remaining === null || remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="flex items-center justify-center gap-1 bg-orange-100 rounded px-1.5 py-0.5">
      <Clock className="w-3 h-3 text-orange-600" />
      <span className="text-[10px] font-medium text-orange-600">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
});

// Оптимизированный компонент карточки байера - изолирован для минимизации ре-рендеров
const BuyerCard = React.memo(function BuyerCard({
  assignment,
  offerId,
  offerArticle,
  buyerMetricsData,
  buyerStatuses,
  loadingBuyerMetrics,
  loadingBuyerStatuses,
  isLoading,
  isRemoving,
  isRestoring,
  onRemove,
  onRestore,
  onOpenCalendar,
  onShowWarning,
  onHideWarning,
  onShowHistory
}) {
  const { date, days } = formatAssignmentDateStatic(assignment.created_at);
  const isArchived = assignment.archived;

  // ВАЖНО: Берём sourceIds и accessDatesMap из ОДНОГО источника - traffic_channels байера
  // Это гарантирует что мы ищем данные по тем же каналам, для которых знаем периоды доступа
  // НЕ используем assignment.source_ids - это устаревшая копия на момент привязки!
  const { sourceIds, accessDatesMap } = useMemo(() => {
    const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
    // Находим каналы для текущего источника (assignment.source)
    const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);

    const ids = [];
    const map = {};

    matchingChannels.forEach(ch => {
      if (ch.channel_id) {
        ids.push(ch.channel_id);
        map[ch.channel_id] = {
          accessGranted: ch.access_granted || null,
          accessLimited: ch.access_limited || null
        };
      }
    });

    // Debug: логируем если sourceIds пустой
    if (ids.length === 0) {
      console.warn(`⚠️ BuyerCard: нет sourceIds для ${assignment.buyer?.name}`, {
        buyerHasSettings: !!assignment.buyer?.buyer_settings,
        trafficChannelsCount: trafficChannels.length,
        source: assignment.source,
        matchingChannelsCount: matchingChannels.length
      });
    }

    return {
      sourceIds: ids,
      accessDatesMap: Object.keys(map).length > 0 ? map : null
    };
  }, [assignment.buyer?.buyer_settings?.traffic_channels, assignment.source, assignment.buyer?.name]);

  // Мемоизируем метрики для этого байера (с учётом дат доступа каждого канала)
  const metrics = useMemo(() => {
    const result = aggregateMetricsByActiveDays(offerArticle, sourceIds, buyerMetricsData, 14, accessDatesMap);
    // Debug: логируем если метрики пустые при наличии sourceIds
    if (sourceIds.length > 0 && result.cost === 0 && result.leads === 0) {
      console.warn(`⚠️ BuyerCard: нет метрик для ${assignment.buyer?.name}`, {
        article: offerArticle,
        sourceIds,
        hasArticleData: !!buyerMetricsData[offerArticle],
        accessDatesMap
      });
    }
    return result;
  }, [offerArticle, sourceIds, buyerMetricsData, accessDatesMap, assignment.buyer?.name]);

  const hasData = metrics.leads > 0 || metrics.cost > 0;
  const hasLessActiveDays = metrics.activeDays > 0 && metrics.activeDays < 14;

  // Вычисляем статус
  const statusKey = getAssignmentKey(offerId, assignment.buyer.id, assignment.source);
  const statusData = buyerStatuses[statusKey];

  // Проверяем, истёк ли доступ байера (все access_limited в прошлом)
  const isAccessExpired = useMemo(() => {
    if (!accessDatesMap) return false;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Проверяем есть ли хоть один канал с активным доступом
    const hasActiveAccess = Object.values(accessDatesMap).some(access => {
      if (!access.accessLimited) return true; // Нет ограничения = активен
      const accessEnd = new Date(access.accessLimited);
      accessEnd.setHours(23, 59, 59, 999);
      return accessEnd >= today; // Ещё не истёк
    });

    return !hasActiveAccess; // Если нет активного доступа - доступ истёк
  }, [accessDatesMap]);

  // Проверяем, есть ли у байера данные в ЕГО периоде доступа
  const hasBuyerDataInAccessPeriod = useMemo(() => {
    // Проверяем через findLastActiveDate - ищет реальную активность в buyerMetricsData
    // Эта функция уже фильтрует по периодам доступа каждого канала
    const lastActiveDateStr = findLastActiveDate(offerArticle, sourceIds, buyerMetricsData, accessDatesMap);
    if (lastActiveDateStr) return true;

    // Проверяем statusData.date - дата из трекера (НО она не фильтруется по периодам доступа!)
    // Поэтому нужно проверить что дата попадает ХОТЯ БЫ В ОДИН период доступа байера
    if (statusData?.date && accessDatesMap) {
      const lastDate = new Date(statusData.date);
      lastDate.setHours(0, 0, 0, 0);

      // Проверяем что дата попадает ХОТЯ БЫ В ОДИН из периодов доступа каналов
      // (а не в общий диапазон, потому что каналы могут иметь разные периоды)
      const isDateInAnyAccessPeriod = Object.values(accessDatesMap).some(access => {
        // Если access_granted = null — нет нижней границы (доступ с начала времён)
        // Если access_limited = null — нет верхней границы (доступ до сих пор)
        const accessStart = access.accessGranted ? new Date(access.accessGranted) : null;
        const accessEnd = access.accessLimited ? new Date(access.accessLimited) : null;

        if (accessStart) accessStart.setHours(0, 0, 0, 0);
        if (accessEnd) accessEnd.setHours(23, 59, 59, 999);

        const isAfterStart = !accessStart || lastDate >= accessStart;
        const isBeforeEnd = !accessEnd || lastDate <= accessEnd;

        return isAfterStart && isBeforeEnd;
      });

      if (isDateInAnyAccessPeriod) {
        return true;
      }
    }

    // Если statusData.date есть, но accessDatesMap нет - считаем что данные есть
    if (statusData?.date && !accessDatesMap) {
      return true;
    }

    return false;
  }, [offerArticle, sourceIds, buyerMetricsData, accessDatesMap, statusData?.date]);

  // ЛОГИКА ОПРЕДЕЛЕНИЯ СТАТУСА (с учётом периодов доступа channel_id):
  //
  // Важно: один channel_id может быть у разных байеров в разные периоды времени!
  // Поэтому статус определяется на основе данных ТОЛЬКО в период доступа этого байера.
  //
  // 1. 'archived' - байер архивирован
  // 2. 'loading' - статусы или метрики ещё загружаются
  // 3. 'not_in_tracker' - НЕТ активных дней (метрик с cost > 0) в период доступа байера
  // 4. 'not_configured' - БЫЛИ активные дни в период доступа, но сегодня расхода нет
  //    (включая случай когда доступ истёк - байер работал раньше)
  // 5. 'active' - есть расход сегодня
  //
  // Для статусов 'not_configured' и 'not_in_tracker' показываем дни с момента привязки (created_at)
  const statusType = isArchived
    ? 'archived'
    : (loadingBuyerStatuses || loadingBuyerMetrics)
      ? 'loading' // Ждём загрузки для корректного определения статуса
      : isAccessExpired && hasBuyerDataInAccessPeriod
        ? 'not_configured' // Доступ истёк, но данные были - "Не настроено"
        : (statusData?.status === 'active' || statusData?.status === 'not_configured') && !hasBuyerDataInAccessPeriod
          ? 'not_in_tracker' // Нет данных вообще - "Нет в трекере"
          : (statusData?.status || 'not_in_tracker');
  const config = isArchived
    ? { label: 'Неактивный', color: 'bg-gray-100', textColor: 'text-gray-600' }
    : (BUYER_STATUS_CONFIG[statusType] || LOCAL_STATUS_CONFIG[statusType] || BUYER_STATUS_CONFIG.active);

  // Мемоизируем вычисление дней для статуса (с учётом дат доступа каждого канала)
  const daysLabel = useMemo(() => {
    let daysToShow = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (statusType === 'active') {
      daysToShow = calculateConsecutiveActiveDays(offerArticle, sourceIds, buyerMetricsData, accessDatesMap);
    } else if (statusType === 'not_configured') {
      // Для "Не настроено" показываем дни с момента ПРИВЯЗКИ байера к офферу
      if (assignment.created_at) {
        const createdDate = new Date(assignment.created_at);
        createdDate.setHours(0, 0, 0, 0);
        daysToShow = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
      }
    } else if (statusType === 'not_in_tracker' && assignment.created_at) {
      // Для "Нет в трекере" тоже показываем дни с момента привязки
      const createdDate = new Date(assignment.created_at);
      createdDate.setHours(0, 0, 0, 0);
      daysToShow = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));
    } else if (statusType === 'archived' && assignment.archived_at) {
      const archivedDate = new Date(assignment.archived_at);
      daysToShow = Math.floor(Math.abs(new Date() - archivedDate) / (1000 * 60 * 60 * 24));
    }
    return daysToShow > 0 ? `${daysToShow} д` : '';
  }, [statusType, offerArticle, sourceIds, buyerMetricsData, assignment.created_at, assignment.archived_at, accessDatesMap]);

  const statusBarColor = STATUS_BAR_COLORS[isArchived ? 'archived' : statusType] || STATUS_BAR_COLORS.default;

  const handleClick = useCallback(() => {
    if (!isRemoving) onOpenCalendar(assignment);
  }, [isRemoving, onOpenCalendar, assignment]);

  const handleRemoveClick = useCallback((e) => {
    e.stopPropagation();
    onRemove(assignment.id, assignment);
  }, [onRemove, assignment]);

  const handleRestoreClick = useCallback((e) => {
    e.stopPropagation();
    if (onRestore) onRestore(assignment);
  }, [onRestore, assignment]);

  const handleWarningEnter = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onShowWarning({
      text: `Статистика за ${metrics.activeDays} ${metrics.activeDays === 1 ? 'активный день' : metrics.activeDays < 5 ? 'активных дня' : 'активных дней'} (меньше 14)`,
      x: rect.left,
      y: rect.top
    });
  }, [metrics.activeDays, onShowWarning]);

  const handleHistoryClick = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onShowHistory({
      history: assignment.history,
      buyerName: assignment.buyer.name,
      x: rect.left,
      y: rect.bottom + 8
    });
  }, [assignment.history, assignment.buyer.name, onShowHistory]);

  return (
    <div
      onClick={handleClick}
      className={`flex-shrink-0 w-32 rounded-lg transition-all group overflow-visible relative
        ${isArchived
          ? 'bg-gray-100 border-2 border-dashed border-gray-300 opacity-60 hover:opacity-80'
          : 'bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
        }
        ${isRemoving ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
      `}
    >
      {/* Индикатор загрузки при удалении/архивации */}
      {isRemoving && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
          <MiniSpinner />
        </div>
      )}

      {/* Иконка архива */}
      {isArchived && (
        <div className="absolute top-1 left-1 bg-gray-400 rounded-full p-0.5" title="Архивирован">
          <Archive className="w-2.5 h-2.5 text-white" />
        </div>
      )}

      {/* Иконка предупреждения */}
      {!isArchived && !loadingBuyerMetrics && !isLoading && hasLessActiveDays && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleWarningEnter}
          onMouseLeave={onHideWarning}
          style={{ position: 'absolute', top: '-4px', left: '-4px', padding: '6px', cursor: 'help', zIndex: 10 }}
        >
          <div style={{ backgroundColor: '#fef9c3', borderRadius: '9999px', padding: '2px' }}>
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
          </div>
        </div>
      )}

      {/* Кнопка удаления (для активных) */}
      {!isArchived && (
        <button
          onClick={handleRemoveClick}
          disabled={isRemoving}
          className="absolute top-0.5 right-0.5 p-0.5 rounded-full transition-all hover:bg-red-100 disabled:opacity-50 z-10"
          title="Удалить привязку"
        >
          <X className="w-3.5 h-3.5 text-red-500" />
        </button>
      )}

      {/* Кнопка восстановления (для архивных) */}
      {isArchived && (
        <button
          onClick={handleRestoreClick}
          disabled={isRestoring}
          className="absolute top-0.5 right-0.5 p-1 rounded-full transition-all bg-green-100 hover:bg-green-200 disabled:opacity-50 z-10"
          title="Восстановить байера"
        >
          {isRestoring ? (
            <Loader2 className="w-3 h-3 text-green-600 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 text-green-600" />
          )}
        </button>
      )}

      <div className="flex flex-col items-center text-center space-y-1 p-2">
        {/* Оптимизированный аватар с blur placeholder */}
        <OptimizedAvatar
          src={assignment.buyer.avatar_url}
          alt={assignment.buyer.name}
          fallbackLetter={assignment.buyer.name?.charAt(0)?.toUpperCase()}
          size={40}
        />

        {/* Имя */}
        <div className="w-full px-0.5">
          <div className="text-[11px] font-medium text-gray-900 leading-tight truncate" title={assignment.buyer.name}>
            {assignment.buyer.name}
          </div>
        </div>

        {/* Дата и история */}
        <div className="flex items-center justify-center gap-1">
          <span className="text-[9px] text-gray-500">{date} | {days} д</span>
          {assignment.history?.length > 0 && (
            <div onClick={handleHistoryClick} className="cursor-pointer">
              <Info className="w-3 h-3 text-blue-400 hover:text-blue-600" />
            </div>
          )}
        </div>

        {/* Таймер */}
        <div className="h-5 flex items-center justify-center">
          <CountdownTimer createdAt={assignment.created_at} />
        </div>

        {/* Метрики */}
        {(loadingBuyerMetrics || isLoading) ? (
          <SkeletonMetrics />
        ) : (
          <div className="w-full text-[9px] text-gray-500 space-y-0.5">
            <div className="flex justify-between px-1">
              <span>CPL:</span>
              <span className={hasData ? "text-gray-700 font-medium" : "text-gray-400"}>
                {hasData ? `$${metrics.cpl.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex justify-between px-1">
              <span>Lead:</span>
              <span className={hasData ? "text-gray-700 font-medium" : "text-gray-400"}>
                {hasData ? metrics.leads : '—'}
              </span>
            </div>
            <div className="flex justify-between px-1">
              <span>Cost:</span>
              <span className={hasData ? "text-gray-700 font-medium" : "text-gray-400"}>
                {hasData ? `$${metrics.cost.toFixed(2)}` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Статус */}
      {(loadingBuyerStatuses || isLoading || statusType === 'loading') ? (
        <div className="bg-gray-400 py-1.5 px-2 flex items-center justify-center rounded-b-lg">
          <LoadingDots className="mx-auto" />
        </div>
      ) : (
        <div className={`${statusBarColor} py-1.5 px-2 flex items-center justify-center rounded-b-lg`}>
          <span className="text-[10px] font-semibold text-white text-center leading-tight">
            {config.label}{daysLabel && ` • ${daysLabel}`}
          </span>
        </div>
      )}
    </div>
  );
});

// Компонент для рендеринга одной виртуализированной карточки байера
const VirtualizedBuyerCard = React.memo(function VirtualizedBuyerCard({ index, style, data }) {
  const {
    buyers,
    offerId,
    offerArticle,
    buyerMetricsData,
    buyerStatuses,
    loadingBuyerMetrics,
    loadingBuyerStatuses,
    loadingBuyerIds,
    removingBuyerId,
    restoringBuyerId,
    onRemoveBuyer,
    onRestoreBuyer,
    onOpenCalendar,
    onShowWarning,
    onHideWarning,
    onShowHistory
  } = data;

  const assignment = buyers[index];
  if (!assignment) return null;

  return (
    <div style={{ ...style, paddingRight: '10px' }}>
      <BuyerCard
        assignment={assignment}
        offerId={offerId}
        offerArticle={offerArticle}
        buyerMetricsData={buyerMetricsData}
        buyerStatuses={buyerStatuses}
        loadingBuyerMetrics={loadingBuyerMetrics}
        loadingBuyerStatuses={loadingBuyerStatuses}
        isLoading={loadingBuyerIds?.has(assignment.id)}
        isRemoving={removingBuyerId === assignment.id}
        isRestoring={restoringBuyerId === assignment.id}
        onRemove={onRemoveBuyer}
        onRestore={onRestoreBuyer}
        onOpenCalendar={onOpenCalendar}
        onShowWarning={onShowWarning}
        onHideWarning={onHideWarning}
        onShowHistory={onShowHistory}
      />
    </div>
  );
});

// Оптимизированный компонент колонки источника - вынесен наружу
const SourceColumn = React.memo(function SourceColumn({
  source,
  icon: Icon,
  buyers,
  isLast,
  offerId,
  offerArticle,
  buyerMetricsData,
  buyerStatuses,
  loadingBuyerMetrics,
  loadingBuyerStatuses,
  loadingBuyerIds,
  removingBuyerId,
  restoringBuyerId,
  onAddBuyer,
  onRemoveBuyer,
  onRestoreBuyer,
  onOpenCalendar,
  onShowWarning,
  onHideWarning,
  onShowHistory
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const handleAddClick = useCallback(() => onAddBuyer(source), [onAddBuyer, source]);

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const virtualListOuterRef = useRef(null);

  // Получаем актуальный scroll-контейнер (обычный или виртуализированный)
  const getScrollContainer = useCallback(() => {
    return virtualListOuterRef.current || containerRef.current;
  }, []);

  // Drag-to-scroll handlers
  const handleMouseDown = useCallback((e) => {
    // Игнорируем клики по кнопкам и интерактивным элементам
    if (e.target.closest('button') || e.target.closest('a')) return;

    const scrollContainer = getScrollContainer();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.pageX,
      scrollLeft: scrollContainer?.scrollLeft || 0
    };
  }, [getScrollContainer]);

  const handleMouseMove = useCallback((e) => {
    const scrollContainer = getScrollContainer();
    if (!isDragging || !scrollContainer) return;
    e.preventDefault();

    const dx = e.pageX - dragStartRef.current.x;
    scrollContainer.scrollLeft = dragStartRef.current.scrollLeft - dx;
  }, [isDragging, getScrollContainer]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Вычисляем ширину контейнера для виртуализации
  useEffect(() => {
    if (containerRef.current) {
      const updateWidth = () => {
        setContainerWidth(containerRef.current.offsetWidth);
      };
      updateWidth();

      // ResizeObserver для отслеживания изменений размера
      const resizeObserver = new ResizeObserver(updateWidth);
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    }
  }, []);

  // Мемоизируем данные для виртуализированного списка
  const listItemData = useMemo(() => ({
    buyers,
    offerId,
    offerArticle,
    buyerMetricsData,
    buyerStatuses,
    loadingBuyerMetrics,
    loadingBuyerStatuses,
    loadingBuyerIds,
    removingBuyerId,
    restoringBuyerId,
    onRemoveBuyer,
    onRestoreBuyer,
    onOpenCalendar,
    onShowWarning,
    onHideWarning,
    onShowHistory
  }), [
    buyers, offerId, offerArticle, buyerMetricsData, buyerStatuses,
    loadingBuyerMetrics, loadingBuyerStatuses, loadingBuyerIds,
    removingBuyerId, restoringBuyerId, onRemoveBuyer, onRestoreBuyer, onOpenCalendar, onShowWarning,
    onHideWarning, onShowHistory
  ]);

  // Определяем нужна ли виртуализация
  const shouldVirtualize = buyers.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className={`flex-1 px-4 py-3 ${!isLast ? 'border-r border-gray-200' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium text-gray-900">{source}</span>
          <span className="text-xs text-gray-400">({buyers.length})</span>
        </div>
        <button
          onClick={handleAddClick}
          className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          title={`Добавить байера для ${source}`}
        >
          <Plus className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div
        ref={containerRef}
        className={`pb-2 -mx-1 px-1 ${shouldVirtualize ? 'overflow-hidden' : 'overflow-x-auto overflow-y-visible'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollBehavior: isDragging ? 'auto' : 'smooth', WebkitOverflowScrolling: 'touch' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {buyers.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-6">Нет байеров</div>
        ) : shouldVirtualize && containerWidth > 0 ? (
          // Горизонтальная виртуализация для большого количества байеров
          <FixedSizeList
            layout="horizontal"
            height={220}
            width={containerWidth}
            itemCount={buyers.length}
            itemSize={BUYER_CARD_WIDTH}
            itemData={listItemData}
            overscanCount={3}
            outerRef={virtualListOuterRef}
            className={`select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ overflowX: 'auto', overflowY: 'hidden' }}
          >
            {VirtualizedBuyerCard}
          </FixedSizeList>
        ) : (
          // Обычный рендеринг для небольшого количества байеров
          <div className="flex flex-row gap-2.5 min-w-max select-none">
            {buyers.map((assignment) => (
              <BuyerCard
                key={assignment.id}
                assignment={assignment}
                offerId={offerId}
                offerArticle={offerArticle}
                buyerMetricsData={buyerMetricsData}
                buyerStatuses={buyerStatuses}
                loadingBuyerMetrics={loadingBuyerMetrics}
                loadingBuyerStatuses={loadingBuyerStatuses}
                isLoading={loadingBuyerIds?.has(assignment.id)}
                isRemoving={removingBuyerId === assignment.id}
                isRestoring={restoringBuyerId === assignment.id}
                onRemove={onRemoveBuyer}
                onRestore={onRestoreBuyer}
                onOpenCalendar={onOpenCalendar}
                onShowWarning={onShowWarning}
                onHideWarning={onHideWarning}
                onShowHistory={onShowHistory}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// Константы для фильтров байеров
const BUYER_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'archived', label: 'Неактивные' },
  { key: 'not_in_tracker', label: 'Нет в трекере' },
  { key: 'not_configured', label: 'Не настроено' },
  { key: 'active', label: 'Активные' }
];

const OfferBuyersPanel = React.memo(function OfferBuyersPanel({
  offer,
  allBuyers = [],
  initialAssignments = [],
  onAssignmentsChange,
  buyerMetricsData = {},
  buyerStatuses = {},
  loadingBuyerStatuses = false,
  loadingBuyerMetrics = false,
  loadingBuyerIds = new Set(), // ID привязок, которые сейчас загружаются
  articleOfferMap = {}, // Маппинг article -> offer_id_tracker для проверки расхода
  user = null // Текущий пользователь (для логирования истории)
}) {
  const [removingBuyerId, setRemovingBuyerId] = useState(null); // ID байера, который удаляется
  const [restoringBuyerId, setRestoringBuyerId] = useState(null); // ID байера, который восстанавливается
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [selectedTeamLead, setSelectedTeamLead] = useState(''); // Выбранный Team Lead для фильтрации
  const [availableBuyers, setAvailableBuyers] = useState([]);
  const [archivedBuyersForOffer, setArchivedBuyersForOffer] = useState([]); // Архивированные байеры этого оффера
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBuyerForCalendar, setSelectedBuyerForCalendar] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState(new Set(['all'])); // Выбранные фильтры
  const [warningTooltip, setWarningTooltip] = useState(null); // {text, x, y} для tooltip предупреждения
  const [historyWindow, setHistoryWindow] = useState(null); // {history, buyerName, x, y} для перетаскиваемого окна истории
  const [showRemovalReasonModal, setShowRemovalReasonModal] = useState(null); // {assignmentId, assignment} для модалки причины
  const [showEarlyRemovalModal, setShowEarlyRemovalModal] = useState(null); // {assignmentId, assignment} для модалки раннего удаления
  const [removalReason, setRemovalReason] = useState(''); // Выбранная причина удаления
  const [removalReasonDetails, setRemovalReasonDetails] = useState(''); // Детали причины "Другое"
  const [buyerSearchQuery, setBuyerSearchQuery] = useState(''); // Поиск байера по имени
  const [expandedTeamLeads, setExpandedTeamLeads] = useState(new Set()); // Развёрнутые секции Team Lead

  // Получаем уникальных Team Leads из списка байеров
  const teamLeads = useMemo(() => {
    const tlMap = new Map();
    allBuyers.forEach(buyer => {
      if (buyer.team_lead_id && buyer.team_lead_name) {
        tlMap.set(buyer.team_lead_id, buyer.team_lead_name);
      }
    });
    return Array.from(tlMap, ([id, name]) => ({ id, name }));
  }, [allBuyers]);

  // Хелпер: проверка находится ли привязка в периоде раннего удаления
  const isWithinEarlyRemovalPeriod = useCallback((assignment) => {
    if (!assignment.created_at) return false;
    const createdAt = new Date(assignment.created_at).getTime();
    const now = Date.now();
    return (now - createdAt) < EARLY_REMOVAL_PERIOD;
  }, []);

  // Хелпер: форматирование даты для истории
  const formatHistoryDate = useCallback((isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Обработчик клика по фильтру
  const handleFilterClick = useCallback((filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = new Set(prev);

      if (filterKey === 'all') {
        // Если нажали "Все" - сбрасываем все и выбираем только "Все"
        return new Set(['all']);
      } else {
        // Убираем "Все" если выбрали конкретный фильтр
        newFilters.delete('all');

        if (newFilters.has(filterKey)) {
          // Если фильтр уже выбран - убираем его
          newFilters.delete(filterKey);
          // Если ничего не осталось - возвращаем "Все"
          if (newFilters.size === 0) {
            return new Set(['all']);
          }
        } else {
          // Добавляем фильтр
          newFilters.add(filterKey);
        }
      }

      return newFilters;
    });
  }, []);

  // Преобразуем привязки из БД в формат компонента
  const assignedBuyers = useMemo(() => {
    // Фильтруем скрытые записи (удалённые в первые 3 минуты)
    const visibleAssignments = initialAssignments.filter(a => !a.hidden);

    const buyers = visibleAssignments.map(assignment => {
      const buyerData = allBuyers.find(b => b.id === assignment.buyer_id);
      return {
        id: assignment.id,
        source: assignment.source,
        buyer: buyerData || {
          id: assignment.buyer_id,
          name: assignment.buyer_name,
          avatar_url: null
        },
        offer_id: assignment.offer_id,
        source_ids: assignment.source_ids || [], // Массив source_id (устаревшая копия, НЕ использовать!)
        created_at: assignment.created_at, // Дата привязки
        archived: assignment.archived || false, // Флаг архивации
        archived_at: assignment.archived_at, // Дата архивации
        hidden: assignment.hidden || false, // Флаг скрытия (раннее удаление)
        history: assignment.history || [] // История привязки/удаления
      };
    });

    // ГЛАВНАЯ ФУНКЦИЯ: получение sourceIds И accessDatesMap из ОДНОГО источника (traffic_channels)
    // ВАЖНО: НЕ используем assignment.source_ids - это устаревшая копия на момент привязки!
    const getSourceIdsAndAccessDatesMap = (assignment) => {
      const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
      const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);

      const ids = [];
      const map = {};

      matchingChannels.forEach(ch => {
        if (ch.channel_id) {
          ids.push(ch.channel_id);
          map[ch.channel_id] = {
            accessGranted: ch.access_granted || null,
            accessLimited: ch.access_limited || null
          };
        }
      });

      return {
        sourceIds: ids,
        accessDatesMap: Object.keys(map).length > 0 ? map : null
      };
    };

    // Функция для проверки, истёк ли доступ байера
    const checkIsAccessExpired = (accessDatesMap) => {
      if (!accessDatesMap) return false;

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const hasActiveAccess = Object.values(accessDatesMap).some(access => {
        if (!access.accessLimited) return true;
        const accessEnd = new Date(access.accessLimited);
        accessEnd.setHours(23, 59, 59, 999);
        return accessEnd >= today;
      });

      return !hasActiveAccess;
    };

    // Функция для проверки, есть ли у байера данные в его периоде доступа
    const checkHasBuyerDataInAccessPeriod = (assignment, accessDatesMap, statusData) => {
      // ВАЖНО: берём sourceIds из traffic_channels, а не из assignment.source_ids!
      const { sourceIds } = getSourceIdsAndAccessDatesMap(assignment);
      const offerArticle = offer?.article || '';

      // Проверяем через findLastActiveDate
      const lastActiveDateStr = findLastActiveDate(offerArticle, sourceIds, buyerMetricsData, accessDatesMap);
      if (lastActiveDateStr) return true;

      // Проверяем statusData.date
      if (statusData?.date && accessDatesMap) {
        const lastDate = new Date(statusData.date);
        lastDate.setHours(0, 0, 0, 0);

        let latestAccessLimited = null;
        Object.values(accessDatesMap).forEach(access => {
          if (access.accessLimited) {
            const accessEnd = new Date(access.accessLimited);
            accessEnd.setHours(23, 59, 59, 999);
            if (!latestAccessLimited || accessEnd > latestAccessLimited) {
              latestAccessLimited = accessEnd;
            }
          }
        });

        if (!latestAccessLimited || lastDate <= latestAccessLimited) {
          return true;
        }
      }

      if (statusData?.date && !accessDatesMap) {
        return true;
      }

      return false;
    };

    // Функция для получения приоритета статуса (меньше = левее)
    const getStatusPriority = (assignment) => {
      if (assignment.archived) return 0; // Неактивные - слева

      // Если метрики ещё грузятся - временный приоритет (пересчитается после загрузки)
      if (loadingBuyerMetrics) return 5;

      const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
      const statusData = buyerStatuses[statusKey];
      const accessDatesMap = getAccessDatesMap(assignment);
      const isAccessExpired = checkIsAccessExpired(accessDatesMap);
      const hasData = checkHasBuyerDataInAccessPeriod(assignment, accessDatesMap, statusData);

      // Определяем реальный статус
      let statusType = statusData?.status || 'not_in_tracker';

      // Если доступ истёк и есть данные - "Не настроено"
      if (isAccessExpired && hasData) {
        statusType = 'not_configured';
      }
      // Если нет данных вообще - "Нет в трекере"
      else if ((statusType === 'active' || statusType === 'not_configured') && !hasData) {
        statusType = 'not_in_tracker';
      }

      switch (statusType) {
        case 'not_in_tracker': return 1; // Нет в трекере
        case 'not_configured': return 2; // Не настроено
        case 'active': return 3; // Активный - справа
        default: return 4;
      }
    };

    // Функция для получения дат доступа из traffic_channels - возвращает маппинг channel_id -> {accessGranted, accessLimited}
    const getAccessDatesMap = (assignment) => {
      return getSourceIdsAndAccessDatesMap(assignment).accessDatesMap;
    };

    // Функция для получения количества дней для сортировки
    const getDaysForSorting = (assignment) => {
      // ВАЖНО: берём sourceIds из traffic_channels!
      const { sourceIds } = getSourceIdsAndAccessDatesMap(assignment);
      const offerArticle = offer?.article || '';
      const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
      const statusData = buyerStatuses[statusKey];

      // Если метрики ещё грузятся - возвращаем 0 (сортировка пересчитается после загрузки)
      if (loadingBuyerMetrics) {
        return 0;
      }

      const accessDatesMap = getAccessDatesMap(assignment);
      const isAccessExpired = checkIsAccessExpired(accessDatesMap);
      const hasData = checkHasBuyerDataInAccessPeriod(assignment, accessDatesMap, statusData);

      // Определяем реальный статус с учётом периода доступа
      let statusType = assignment.archived ? 'archived' : (statusData?.status || 'not_in_tracker');

      // Если доступ истёк и есть данные - "Не настроено"
      if (isAccessExpired && hasData) {
        statusType = 'not_configured';
      }
      // Если нет данных вообще - "Нет в трекере"
      else if ((statusType === 'active' || statusType === 'not_configured') && !hasData) {
        statusType = 'not_in_tracker';
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (statusType === 'active') {
        // Для активных - дни подряд с cost > 0 (с учётом дат доступа каждого канала)
        return calculateConsecutiveActiveDays(offerArticle, sourceIds, buyerMetricsData, accessDatesMap);
      } else if (statusType === 'not_configured') {
        // Для "Не настроено" - находим РЕАЛЬНЫЙ последний активный день
        const lastActiveDateStr = findLastActiveDate(offerArticle, sourceIds, buyerMetricsData, accessDatesMap);

        if (lastActiveDateStr) {
          const lastActiveDate = new Date(lastActiveDateStr);
          lastActiveDate.setHours(0, 0, 0, 0);
          return Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
        } else if (statusData?.date) {
          // Проверяем что дата из трекера в пределах доступа байера
          const lastDate = new Date(statusData.date);
          lastDate.setHours(0, 0, 0, 0);

          // Находим максимальный access_limited из всех каналов байера
          let latestAccessLimited = null;
          if (accessDatesMap) {
            Object.values(accessDatesMap).forEach(access => {
              if (access.accessLimited) {
                const accessEnd = new Date(access.accessLimited);
                accessEnd.setHours(23, 59, 59, 999);
                if (!latestAccessLimited || accessEnd > latestAccessLimited) {
                  latestAccessLimited = accessEnd;
                }
              }
            });
          }

          // Если дата из трекера ПОЗЖЕ окончания доступа - не используем её
          if (!latestAccessLimited || lastDate <= latestAccessLimited) {
            return Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
          }
        }
        return 0;
      } else if ((statusType === 'not_in_tracker' || statusType === 'archived') && assignment.created_at) {
        // Для "Нет в трекере" и архивированных - дни с момента привязки
        const createdDate = new Date(assignment.created_at);
        return Math.floor(Math.abs(today - createdDate) / (1000 * 60 * 60 * 24));
      }
      return 0;
    };

    // Сортируем: по статусу, затем по дням (меньше дней слева, больше справа)
    return buyers.sort((a, b) => {
      const priorityA = getStatusPriority(a);
      const priorityB = getStatusPriority(b);

      // Сначала по приоритету статуса
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Внутри одного статуса - по дням (меньше дней слева)
      const daysA = getDaysForSorting(a);
      const daysB = getDaysForSorting(b);
      return daysA - daysB;
    });
  }, [initialAssignments, allBuyers, buyerStatuses, buyerMetricsData, offer]);

  const handleAddBuyer = useCallback(async (source) => {
    setSelectedSource(source);
    setSelectedTeamLead(''); // Сбрасываем фильтр Team Lead
    setShowModal(true);
    setLoadingBuyers(true);

    try {
      // Фильтруем байеров по источнику (только НЕ архивированные для добавления)
      const filtered = allBuyers.filter(buyer => {
        // Исключаем архивированных байеров из списка для добавления
        if (buyer.archived) {
          return false;
        }
        if (!buyer.buyer_settings || !buyer.buyer_settings.traffic_channels) {
          return false;
        }
        return buyer.buyer_settings.traffic_channels.some(
          channel => channel.source === source
        );
      });

      // Активные привязки для этого источника (не архивированные)
      const activeAssignments = assignedBuyers
        .filter(b => b.source === source && !b.archived)
        .map(b => b.buyer.id);

      // Архивированные привязки для этого источника
      const archivedAssignments = assignedBuyers
        .filter(b => b.source === source && b.archived);

      // Байеры "Не отливали" - не привязаны активно и не архивированы
      const archivedBuyerIds = archivedAssignments.map(b => b.buyer.id);
      const available = filtered.filter(buyer =>
        !activeAssignments.includes(buyer.id) && !archivedBuyerIds.includes(buyer.id)
      );

      // Байеры "Уже отливали" - архивированные привязки
      const archivedBuyers = archivedAssignments.map(assignment => {
        const buyerData = allBuyers.find(b => b.id === assignment.buyer.id);
        return buyerData || assignment.buyer;
      });

      setAvailableBuyers(available);
      setArchivedBuyersForOffer(archivedBuyers);
    } catch (error) {
      console.error('Ошибка фильтрации байеров:', error);
      setAvailableBuyers([]);
      setArchivedBuyersForOffer([]);
    } finally {
      setLoadingBuyers(false);
    }
  }, [allBuyers, assignedBuyers]);

  const handleSelectBuyer = useCallback(async (buyer) => {
    setSavingAssignment(true);

    try {
      // Получаем ВСЕ source_ids для выбранного источника (не только первый!)
      const channels = buyer.buyer_settings?.traffic_channels?.filter(
        ch => ch.source === selectedSource
      ) || [];

      // Собираем все channel_id в массив
      const sourceIds = channels
        .map(ch => ch.channel_id)
        .filter(id => id); // Убираем null/undefined

      // Имя текущего пользователя для логирования
      const assignedBy = user?.name || user?.email || 'Неизвестно';

      console.log(`📦 Привязываем байера ${buyer.name} с ${sourceIds.length} source_ids для ${selectedSource}:`, sourceIds);
      console.log(`   Привязал: ${assignedBy}`);

      // Сохраняем в БД с массивом source_ids и именем того, кто привязал
      const savedAssignment = await offerBuyersService.addAssignment(
        offer.id,
        buyer.id,
        buyer.name,
        selectedSource,
        sourceIds,
        assignedBy
      );

      // Уведомляем родительский компонент о новой привязке
      // Передаем savedAssignment как третий параметр для оптимизированного обновления
      if (onAssignmentsChange) {
        // Фильтруем существующую архивную привязку этого же байера + источника
        // (при повторной привязке архивированного байера БД удаляет старую запись)
        // Проверяем оба варианта ID: buyer_id и buyer.id (зависит от источника данных)
        const filteredAssignments = initialAssignments.filter(a => {
          const assignmentBuyerId = a.buyer_id || a.buyer?.id;
          return !(assignmentBuyerId === buyer.id && a.source === selectedSource && a.archived);
        });
        onAssignmentsChange(offer.id, [...filteredAssignments, savedAssignment], savedAssignment);
      }

      setShowModal(false);
      setSelectedSource(null);
    } catch (error) {
      console.error('Ошибка сохранения привязки:', error);
      alert('Ошибка сохранения привязки байера');
    } finally {
      setSavingAssignment(false);
    }
  }, [selectedSource, offer.id, initialAssignments, onAssignmentsChange, user]);

  // Обработчик восстановления архивированного байера
  const handleRestoreBuyer = useCallback(async (assignment) => {
    setRestoringBuyerId(assignment.id);

    try {
      // Находим полные данные байера из allBuyers
      const buyerId = assignment.buyer_id || assignment.buyer?.id;
      const buyerData = allBuyers.find(b => b.id === buyerId);

      if (!buyerData) {
        throw new Error('Байер не найден в системе');
      }

      const source = assignment.source;

      // Получаем ВСЕ source_ids для этого источника
      const channels = buyerData.buyer_settings?.traffic_channels?.filter(
        ch => ch.source === source
      ) || [];

      const sourceIds = channels
        .map(ch => ch.channel_id)
        .filter(id => id);

      const assignedBy = user?.name || user?.email || 'Неизвестно';

      console.log(`🔄 Восстанавливаем байера ${buyerData.name} для ${source}`);

      // Сохраняем в БД (addAssignment автоматически удалит архивную запись)
      const savedAssignment = await offerBuyersService.addAssignment(
        offer.id,
        buyerData.id,
        buyerData.name,
        source,
        sourceIds,
        assignedBy
      );

      // Уведомляем родительский компонент о новой привязке
      if (onAssignmentsChange) {
        // Фильтруем архивную запись этого байера
        const filteredAssignments = initialAssignments.filter(a => {
          const aBuyerId = a.buyer_id || a.buyer?.id;
          return !(aBuyerId === buyerData.id && a.source === source && a.archived);
        });
        onAssignmentsChange(offer.id, [...filteredAssignments, savedAssignment], savedAssignment);
      }

      console.log(`✅ Байер ${buyerData.name} восстановлен`);
    } catch (error) {
      console.error('Ошибка восстановления байера:', error);
      alert('Ошибка восстановления байера: ' + error.message);
    } finally {
      setRestoringBuyerId(null);
    }
  }, [offer.id, allBuyers, initialAssignments, onAssignmentsChange, user]);

  // Обработчик удаления байера - новая логика с таймером и причинами
  const handleRemoveBuyer = useCallback(async (assignmentId, assignment) => {
    const isEarly = isWithinEarlyRemovalPeriod(assignment);

    // Если в первые 3 минуты - показываем модалку раннего удаления
    if (isEarly) {
      setShowEarlyRemovalModal({ assignmentId, assignment });
    } else {
      // После 3 минут - показываем модалку с выбором причины
      setShowRemovalReasonModal({ assignmentId, assignment });
      setRemovalReason('');
      setRemovalReasonDetails('');
    }
  }, [isWithinEarlyRemovalPeriod]);

  // Обработчик подтверждения удаления с причиной (после 3 минут)
  const handleConfirmRemoval = useCallback(async (reason, reasonDetails) => {
    if (!showRemovalReasonModal) return;

    const { assignmentId, assignment } = showRemovalReasonModal;
    const removedBy = user?.name || user?.email || 'Неизвестно';

    setRemovingBuyerId(assignmentId);
    setShowRemovalReasonModal(null);

    try {
      // ВАЖНО: берём sourceIds и accessDatesMap из traffic_channels!
      const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
      const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);
      const sourceIds = matchingChannels.filter(ch => ch.channel_id).map(ch => ch.channel_id);

      // Строим accessDatesMap для проверки расхода с учётом дат доступа
      const accessDatesMap = {};
      matchingChannels.forEach(ch => {
        if (ch.channel_id) {
          accessDatesMap[ch.channel_id] = {
            accessGranted: ch.access_granted || null,
            accessLimited: ch.access_limited || null
          };
        }
      });

      const offerIdTracker = articleOfferMap[offer.article];

      console.log(`🗑️ Проверяем расход для байера ${assignment.buyer.name}...`);

      // Проверяем был ли расход у байера В ЕГО ПЕРИОД ДОСТУПА
      const { hasSpend, totalCost } = await checkBuyerHasSpend(sourceIds, offerIdTracker, accessDatesMap);

      if (hasSpend) {
        // Был расход - архивируем с причиной
        console.log(`📦 Архивируем байера ${assignment.buyer.name} (расход: $${totalCost.toFixed(2)})`);
        const archivedAssignment = await offerBuyersService.archiveAssignment(
          assignmentId,
          removedBy,
          reason,
          reasonDetails
        );

        // Уведомляем родительский компонент об архивации
        if (onAssignmentsChange) {
          const updatedAssignments = initialAssignments.map(a =>
            a.id === assignmentId ? { ...a, archived: true, archived_at: archivedAssignment.archived_at, history: archivedAssignment.history } : a
          );
          onAssignmentsChange(offer.id, updatedAssignments);
        }
      } else {
        // Не было расхода - скрываем с историей и причиной из модалки
        console.log(`👻 Скрываем байера ${assignment.buyer.name} (расход: $0)`);
        await offerBuyersService.hideAssignment(assignmentId, removedBy, reason, reasonDetails, false);

        // Уведомляем родительский компонент об удалении из отображения
        if (onAssignmentsChange) {
          const updatedAssignments = initialAssignments.map(a =>
            a.id === assignmentId ? { ...a, hidden: true } : a
          );
          onAssignmentsChange(offer.id, updatedAssignments);
        }
      }
    } catch (error) {
      console.error('Ошибка удаления/архивации привязки:', error);
      alert('Ошибка удаления привязки');
    } finally {
      setRemovingBuyerId(null);
      setRemovalReason('');
      setRemovalReasonDetails('');
    }
  }, [showRemovalReasonModal, user, offer.id, offer.article, initialAssignments, onAssignmentsChange, articleOfferMap]);

  // Обработчик подтверждения раннего удаления (в первые 3 минуты)
  const handleConfirmEarlyRemoval = useCallback(async () => {
    if (!showEarlyRemovalModal) return;

    const { assignmentId, assignment } = showEarlyRemovalModal;
    const removedBy = user?.name || user?.email || 'Неизвестно';

    setRemovingBuyerId(assignmentId);
    setShowEarlyRemovalModal(null);

    try {
      // ВАЖНО: берём sourceIds и accessDatesMap из traffic_channels!
      const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
      const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);
      const sourceIds = matchingChannels.filter(ch => ch.channel_id).map(ch => ch.channel_id);

      // Строим accessDatesMap для проверки расхода с учётом дат доступа
      const accessDatesMap = {};
      matchingChannels.forEach(ch => {
        if (ch.channel_id) {
          accessDatesMap[ch.channel_id] = {
            accessGranted: ch.access_granted || null,
            accessLimited: ch.access_limited || null
          };
        }
      });

      const offerIdTracker = articleOfferMap[offer.article];

      console.log(`🗑️ Раннее удаление: проверяем расход для байера ${assignment.buyer.name}...`);

      // Проверяем был ли расход у байера В ЕГО ПЕРИОД ДОСТУПА
      const { hasSpend, totalCost } = await checkBuyerHasSpend(sourceIds, offerIdTracker, accessDatesMap);

      if (hasSpend) {
        // Был расход - архивируем БЕЗ причины (раннее удаление)
        console.log(`📦 Архивируем байера ${assignment.buyer.name} (расход: $${totalCost.toFixed(2)}) - раннее удаление`);
        const archivedAssignment = await offerBuyersService.archiveAssignment(
          assignmentId,
          removedBy,
          null, // без причины
          null  // без деталей
        );

        // Уведомляем родительский компонент об архивации
        if (onAssignmentsChange) {
          const updatedAssignments = initialAssignments.map(a =>
            a.id === assignmentId ? { ...a, archived: true, archived_at: archivedAssignment.archived_at, history: archivedAssignment.history } : a
          );
          onAssignmentsChange(offer.id, updatedAssignments);
        }
      } else {
        // Не было расхода - скрываем (раннее удаление)
        console.log(`👻 Скрываем байера ${assignment.buyer.name} (расход: $0) - раннее удаление`);
        await offerBuyersService.hideEarlyAssignment(assignmentId, removedBy);

        // Уведомляем родительский компонент - убираем из отображения
        if (onAssignmentsChange) {
          const updatedAssignments = initialAssignments.map(a =>
            a.id === assignmentId ? { ...a, hidden: true } : a
          );
          onAssignmentsChange(offer.id, updatedAssignments);
        }
      }
    } catch (error) {
      console.error('Ошибка раннего удаления привязки:', error);
      alert('Ошибка удаления привязки');
    } finally {
      setRemovingBuyerId(null);
    }
  }, [showEarlyRemovalModal, user, offer.id, offer.article, initialAssignments, onAssignmentsChange, articleOfferMap]);

  const handleOpenCalendar = useCallback((assignment) => {
    console.log('📊 Открываем календарь для байера:', assignment.buyer.name);
    console.log('📊 Article:', offer.article);
    console.log('📊 Source IDs:', assignment.source_ids);
    console.log('📊 Всего привязок оффера:', assignedBuyers.length);

    // Собираем данные по всем байерам оффера (включая архивированных)
    // ВАЖНО: берём sourceIds из traffic_channels, а не из a.source_ids!
    const allBuyersData = assignedBuyers
      .map(a => {
        const trafficChannels = a.buyer?.buyer_settings?.traffic_channels || [];
        const matchingChannels = trafficChannels.filter(ch => ch.source === a.source);
        const sourceIds = matchingChannels.filter(ch => ch.channel_id).map(ch => ch.channel_id);
        return {
          buyerId: a.buyer.id,
          buyerName: a.buyer.name,
          avatarUrl: a.buyer.avatar_url,
          sourceIds: sourceIds,
          source: a.source,
          archived: a.archived || false,
          trafficChannels: trafficChannels
        };
      });

    setSelectedBuyerForCalendar({
      selectedBuyerName: assignment.buyer.name, // Выбранный байер (будет вверху)
      allBuyers: allBuyersData, // Все байеры оффера
      article: offer.article,
      source: assignment.source
    });
    setShowCalendar(true);
  }, [offer, assignedBuyers]);

  const handleCloseCalendar = useCallback(() => {
    setShowCalendar(false);
    setSelectedBuyerForCalendar(null);
  }, []);

  // Функция для получения дат доступа из traffic_channels - возвращает маппинг channel_id -> {accessGranted, accessLimited}
  const getAccessDatesMapForAssignment = useCallback((assignment) => {
    const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
    const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);
    if (matchingChannels.length === 0) {
      return null;
    }
    const map = {};
    matchingChannels.forEach(ch => {
      if (ch.channel_id) {
        map[ch.channel_id] = {
          accessGranted: ch.access_granted || null,
          accessLimited: ch.access_limited || null
        };
      }
    });
    return Object.keys(map).length > 0 ? map : null;
  }, []);

  // Функция для получения sourceIds из traffic_channels
  // ВАЖНО: НЕ используем assignment.source_ids - это устаревшая копия на момент привязки!
  const getSourceIdsForAssignment = useCallback((assignment) => {
    const trafficChannels = assignment.buyer?.buyer_settings?.traffic_channels || [];
    const matchingChannels = trafficChannels.filter(ch => ch.source === assignment.source);
    return matchingChannels.filter(ch => ch.channel_id).map(ch => ch.channel_id);
  }, []);

  // Функция для проверки, есть ли у байера данные в его периоде доступа (для фильтрации/сортировки)
  const checkBuyerHasDataInAccessPeriod = useCallback((assignment, accessDatesMap, statusData) => {
    // ВАЖНО: берём sourceIds из traffic_channels, а не из assignment.source_ids!
    const sourceIds = getSourceIdsForAssignment(assignment);

    // Проверяем через findLastActiveDate
    const lastActiveDateStr = findLastActiveDate(offer.article, sourceIds, buyerMetricsData, accessDatesMap);
    if (lastActiveDateStr) return true;

    // Проверяем statusData.date
    if (statusData?.date && accessDatesMap) {
      const lastDate = new Date(statusData.date);
      lastDate.setHours(0, 0, 0, 0);

      let latestAccessLimited = null;
      Object.values(accessDatesMap).forEach(access => {
        if (access.accessLimited) {
          const accessEnd = new Date(access.accessLimited);
          accessEnd.setHours(23, 59, 59, 999);
          if (!latestAccessLimited || accessEnd > latestAccessLimited) {
            latestAccessLimited = accessEnd;
          }
        }
      });

      if (!latestAccessLimited || lastDate <= latestAccessLimited) {
        return true;
      }
    }

    if (statusData?.date && !accessDatesMap) {
      return true;
    }

    return false;
  }, [offer.article, buyerMetricsData, getSourceIdsForAssignment]);

  // Функция для проверки, истёк ли доступ байера
  const checkIsAccessExpiredForAssignment = useCallback((accessDatesMap) => {
    if (!accessDatesMap) return false;

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const hasActiveAccess = Object.values(accessDatesMap).some(access => {
      if (!access.accessLimited) return true;
      const accessEnd = new Date(access.accessLimited);
      accessEnd.setHours(23, 59, 59, 999);
      return accessEnd >= today;
    });

    return !hasActiveAccess;
  }, []);

  // Функция для получения статуса байера
  const getBuyerStatus = useCallback((assignment) => {
    if (assignment.archived) return 'archived';

    // Если метрики ещё грузятся - возвращаем loading
    if (loadingBuyerMetrics) return 'loading';

    const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
    const statusData = buyerStatuses[statusKey];
    const accessDatesMap = getAccessDatesMapForAssignment(assignment);
    const isAccessExpired = checkIsAccessExpiredForAssignment(accessDatesMap);
    const hasData = checkBuyerHasDataInAccessPeriod(assignment, accessDatesMap, statusData);

    // Определяем реальный статус
    let status = statusData?.status || 'not_in_tracker';

    // Если доступ истёк и есть данные - "Не настроено"
    if (isAccessExpired && hasData) {
      status = 'not_configured';
    }
    // Если нет данных вообще - "Нет в трекере"
    else if ((status === 'active' || status === 'not_configured') && !hasData) {
      status = 'not_in_tracker';
    }

    return status;
  }, [offer.id, buyerStatuses, loadingBuyerMetrics, getAccessDatesMapForAssignment, checkIsAccessExpiredForAssignment, checkBuyerHasDataInAccessPeriod]);

  // Фильтруем байеров по выбранным фильтрам
  const filteredBuyers = useMemo(() => {
    // Если выбрано "Все" - показываем всех
    if (selectedFilters.has('all')) {
      return assignedBuyers;
    }

    // Фильтруем по выбранным статусам
    return assignedBuyers.filter(assignment => {
      const status = getBuyerStatus(assignment);
      return selectedFilters.has(status);
    });
  }, [assignedBuyers, selectedFilters, getBuyerStatus]);

  // Приоритет сортировки статусов (меньше = левее)
  const STATUS_SORT_ORDER = {
    'active': 0,
    'not_configured': 1,
    'not_in_tracker': 2,
    'archived': 3
  };

  // Функция для получения количества дней для сортировки
  const getBuyerDays = useCallback((assignment, status) => {
    const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
    const statusData = buyerStatuses[statusKey];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (status === 'active') {
      // Для активных - дни активности из buyerMetricsData (с учётом дат доступа каждого канала)
      // ВАЖНО: берём sourceIds из traffic_channels!
      const sourceIds = getSourceIdsForAssignment(assignment);
      const accessDatesMap = getAccessDatesMapForAssignment(assignment);
      return calculateConsecutiveActiveDays(offer.article, sourceIds, buyerMetricsData, accessDatesMap);
    } else if (status === 'not_configured') {
      // Для "не настроено" - находим РЕАЛЬНЫЙ последний активный день
      // ВАЖНО: берём sourceIds из traffic_channels!
      const sourceIds = getSourceIdsForAssignment(assignment);
      const accessDatesMap = getAccessDatesMapForAssignment(assignment);
      const lastActiveDateStr = findLastActiveDate(offer.article, sourceIds, buyerMetricsData, accessDatesMap);

      if (lastActiveDateStr) {
        const lastActiveDate = new Date(lastActiveDateStr);
        lastActiveDate.setHours(0, 0, 0, 0);
        return Math.floor((today - lastActiveDate) / (1000 * 60 * 60 * 24));
      } else if (statusData?.date) {
        // Проверяем что дата из трекера в пределах доступа байера
        const lastDate = new Date(statusData.date);
        lastDate.setHours(0, 0, 0, 0);

        // Находим максимальный access_limited из всех каналов байера
        let latestAccessLimited = null;
        if (accessDatesMap) {
          Object.values(accessDatesMap).forEach(access => {
            if (access.accessLimited) {
              const accessEnd = new Date(access.accessLimited);
              accessEnd.setHours(23, 59, 59, 999);
              if (!latestAccessLimited || accessEnd > latestAccessLimited) {
                latestAccessLimited = accessEnd;
              }
            }
          });
        }

        // Если дата из трекера ПОЗЖЕ окончания доступа - не используем её
        if (!latestAccessLimited || lastDate <= latestAccessLimited) {
          return Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        }
      }
      return 0;
    } else if (status === 'not_in_tracker' && assignment.created_at) {
      // Для "нет в трекере" - дни с момента привязки
      const createdDate = new Date(assignment.created_at);
      return Math.floor(Math.abs(today - createdDate) / (1000 * 60 * 60 * 24));
    } else if (status === 'archived' && assignment.archived_at) {
      // Для архивированных - дни с момента архивации
      const archivedDate = new Date(assignment.archived_at);
      return Math.floor(Math.abs(today - archivedDate) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }, [offer.id, offer.article, buyerStatuses, buyerMetricsData, getAccessDatesMapForAssignment, getSourceIdsForAssignment]);

  // Сортируем байеров по статусу, затем по дням (от большего к меньшему)
  const sortBuyersByStatus = useCallback((buyers) => {
    return [...buyers].sort((a, b) => {
      const statusA = getBuyerStatus(a);
      const statusB = getBuyerStatus(b);
      const orderA = STATUS_SORT_ORDER[statusA] ?? 99;
      const orderB = STATUS_SORT_ORDER[statusB] ?? 99;

      // Сначала сортируем по статусу
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Если статус одинаковый - сортируем по дням (от большего к меньшему)
      const daysA = getBuyerDays(a, statusA);
      const daysB = getBuyerDays(b, statusB);
      return daysB - daysA; // Descending (больше дней = левее)
    });
  }, [getBuyerStatus, getBuyerDays]);

  // Группируем отфильтрованных байеров по источникам и сортируем по статусу
  const buyersBySource = useMemo(() => ({
    Facebook: sortBuyersByStatus(filteredBuyers.filter(b => b.source === 'Facebook')),
    Google: sortBuyersByStatus(filteredBuyers.filter(b => b.source === 'Google')),
    TikTok: sortBuyersByStatus(filteredBuyers.filter(b => b.source === 'TikTok'))
  }), [filteredBuyers, sortBuyersByStatus]);

  // Обработчики для BuyerCard
  const handleShowWarning = useCallback((data) => setWarningTooltip(data), []);
  const handleHideWarning = useCallback(() => setWarningTooltip(null), []);
  const handleShowHistory = useCallback((data) => setHistoryWindow(data), []);

  // Общие props для SourceColumn
  const sourceColumnCommonProps = useMemo(() => ({
    offerId: offer.id,
    offerArticle: offer?.article || '',
    buyerMetricsData,
    buyerStatuses,
    loadingBuyerMetrics,
    loadingBuyerStatuses,
    loadingBuyerIds,
    removingBuyerId,
    restoringBuyerId,
    onAddBuyer: handleAddBuyer,
    onRemoveBuyer: handleRemoveBuyer,
    onRestoreBuyer: handleRestoreBuyer,
    onOpenCalendar: handleOpenCalendar,
    onShowWarning: handleShowWarning,
    onHideWarning: handleHideWarning,
    onShowHistory: handleShowHistory
  }), [offer.id, offer?.article, buyerMetricsData, buyerStatuses, loadingBuyerMetrics, loadingBuyerStatuses, loadingBuyerIds, removingBuyerId, restoringBuyerId, handleAddBuyer, handleRemoveBuyer, handleRestoreBuyer, handleOpenCalendar, handleShowWarning, handleHideWarning, handleShowHistory]);

  return (
    <>
      <div className="mt-2 bg-white rounded-lg border border-gray-200">
        {/* Кнопки-фильтры над карточками */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5">
          {BUYER_FILTERS.map(filter => {
            const isSelected = selectedFilters.has(filter.key);
            return (
              <button
                key={filter.key}
                onClick={() => handleFilterClick(filter.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors
                  ${isSelected
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3">
          <SourceColumn
            source="Facebook"
            icon={FacebookIcon}
            buyers={buyersBySource.Facebook}
            isLast={false}
            {...sourceColumnCommonProps}
          />
          <SourceColumn
            source="Google"
            icon={GoogleIcon}
            buyers={buyersBySource.Google}
            isLast={false}
            {...sourceColumnCommonProps}
          />
          <SourceColumn
            source="TikTok"
            icon={TiktokIcon}
            buyers={buyersBySource.TikTok}
            isLast={true}
            {...sourceColumnCommonProps}
          />
        </div>
      </div>

      {/* Модальное окно выбора байера */}
      {showModal && (() => {
        // Поиск по имени
        const searchLower = buyerSearchQuery.toLowerCase().trim();

        // Фильтрация по поиску и Team Lead
        const filterBuyers = (buyers) => {
          let result = buyers;

          // Фильтр по поиску
          if (searchLower) {
            result = result.filter(buyer =>
              buyer.name?.toLowerCase().includes(searchLower) ||
              buyer.email?.toLowerCase().includes(searchLower)
            );
          }

          // Фильтр по Team Lead
          if (selectedTeamLead) {
            result = result.filter(buyer => buyer.team_lead_id === selectedTeamLead);
          }

          return result;
        };

        const filteredAvailableBuyers = filterBuyers(availableBuyers);
        const filteredArchivedBuyers = filterBuyers(archivedBuyersForOffer);

        // Группировка по Team Lead
        const groupByTeamLead = (buyers) => {
          const groups = new Map();
          const noTeamLead = [];

          buyers.forEach(buyer => {
            if (buyer.team_lead_id && buyer.team_lead_name) {
              if (!groups.has(buyer.team_lead_id)) {
                groups.set(buyer.team_lead_id, {
                  id: buyer.team_lead_id,
                  name: buyer.team_lead_name,
                  buyers: []
                });
              }
              groups.get(buyer.team_lead_id).buyers.push(buyer);
            } else {
              noTeamLead.push(buyer);
            }
          });

          // Сортируем группы по имени TL
          const sortedGroups = Array.from(groups.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'ru')
          );

          // Добавляем группу без TL в конец, если есть
          if (noTeamLead.length > 0) {
            sortedGroups.push({
              id: 'no-team-lead',
              name: 'Без Team Lead',
              buyers: noTeamLead
            });
          }

          return sortedGroups;
        };

        const availableGroups = groupByTeamLead(filteredAvailableBuyers);
        const archivedGroups = groupByTeamLead(filteredArchivedBuyers);

        // Проверка развёрнутости секции
        const isExpanded = (sectionKey) => expandedTeamLeads.has(sectionKey);

        const toggleExpanded = (sectionKey) => {
          setExpandedTeamLeads(prev => {
            const next = new Set(prev);
            if (next.has(sectionKey)) {
              next.delete(sectionKey);
            } else {
              next.add(sectionKey);
            }
            return next;
          });
        };

        const renderBuyerCard = (buyer) => {
          const channels = buyer.buyer_settings?.traffic_channels?.filter(
            ch => ch.source === selectedSource
          ) || [];

          // Получаем названия аккаунтов вместо ID
          const accountNames = channels
            .filter(ch => ch.account_name)
            .map(ch => ch.account_name);

          return (
            <button
              key={buyer.id}
              onClick={() => handleSelectBuyer(buyer)}
              disabled={savingAssignment}
              className="bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl p-3 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-center gap-3">
                {/* Аватар */}
                <div className="flex-shrink-0">
                  <OptimizedAvatar
                    src={buyer.avatar_url}
                    alt={buyer.name}
                    fallbackLetter={buyer.name?.charAt(0)?.toUpperCase()}
                    size={44}
                  />
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors">
                    {buyer.name}
                  </div>

                  {/* Аккаунты */}
                  {accountNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {accountNames.slice(0, 3).map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md"
                        >
                          {name}
                        </span>
                      ))}
                      {accountNames.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-md">
                          +{accountNames.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {savingAssignment && (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        };

        const renderTeamLeadSection = (group, sectionPrefix, dotColor) => {
          const sectionKey = `${sectionPrefix}-${group.id}`;
          const expanded = isExpanded(sectionKey);

          return (
            <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Заголовок группы */}
              <button
                onClick={() => toggleExpanded(sectionKey)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></div>
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-700">{group.name}</span>
                  <span className="text-sm text-gray-500">({group.buyers.length})</span>
                </div>
                {expanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {/* Список байеров */}
              {expanded && (
                <div className="p-3 grid grid-cols-2 gap-2 bg-white">
                  {group.buyers.map(renderBuyerCard)}
                </div>
              )}
            </div>
          );
        };

        const totalAvailable = filteredAvailableBuyers.length;
        const totalArchived = filteredArchivedBuyers.length;
        const totalBuyers = totalAvailable + totalArchived;

        return (
          <Portal>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
                {/* Заголовок */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedSource === 'Facebook' && <FacebookIcon className="w-6 h-6" />}
                      {selectedSource === 'Google' && <GoogleIcon className="w-6 h-6" />}
                      {selectedSource === 'TikTok' && <TiktokIcon className="w-6 h-6" />}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Выбрать байера
                        </h3>
                        <p className="text-sm text-gray-500">
                          Источник: {selectedSource} • {totalBuyers} доступно
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedSource(null);
                        setBuyerSearchQuery('');
                        setSelectedTeamLead('');
                        setExpandedTeamLeads(new Set());
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={savingAssignment}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Панель фильтров */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
                  {/* Поиск */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={buyerSearchQuery}
                      onChange={(e) => setBuyerSearchQuery(e.target.value)}
                      placeholder="Поиск по имени..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      autoFocus
                    />
                    {buyerSearchQuery && (
                      <button
                        onClick={() => setBuyerSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Team Lead фильтр - горизонтальные чипсы */}
                  {teamLeads.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedTeamLead('')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          !selectedTeamLead
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        Все TL
                      </button>
                      {teamLeads.map((tl) => (
                        <button
                          key={tl.id}
                          onClick={() => setSelectedTeamLead(tl.id === selectedTeamLead ? '' : tl.id)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            selectedTeamLead === tl.id
                              ? 'bg-blue-500 text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {tl.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Список байеров */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loadingBuyers ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-11 h-11 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : totalBuyers === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {buyerSearchQuery
                          ? 'Байеры не найдены'
                          : `Нет доступных байеров с источником ${selectedSource}`
                        }
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {buyerSearchQuery
                          ? 'Попробуйте изменить поисковый запрос'
                          : selectedTeamLead
                            ? 'Попробуйте выбрать другого Team Lead'
                            : 'У байеров нет настроенных каналов с этим источником'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Секция "Не отливали" */}
                      {availableGroups.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm font-semibold text-gray-700">
                              Не отливали на этот оффер
                            </span>
                            <span className="text-sm text-gray-500">
                              ({totalAvailable})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {availableGroups.map(group =>
                              renderTeamLeadSection(group, 'available', 'bg-green-500')
                            )}
                          </div>
                        </div>
                      )}

                      {/* Секция "Уже отливали" */}
                      {archivedGroups.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span className="text-sm font-semibold text-gray-700">
                              Уже отливали на этот оффер
                            </span>
                            <span className="text-sm text-gray-500">
                              ({totalArchived})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {archivedGroups.map(group =>
                              renderTeamLeadSection(group, 'archived', 'bg-orange-500')
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Футер */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedSource(null);
                      setBuyerSearchQuery('');
                      setSelectedTeamLead('');
                      setExpandedTeamLeads(new Set());
                    }}
                    disabled={savingAssignment}
                    className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </Portal>
        );
      })()}

      {/* Модальное окно календаря метрик */}
      {showCalendar && selectedBuyerForCalendar && (
        <BuyerMetricsCalendar
          allBuyers={selectedBuyerForCalendar.allBuyers}
          selectedBuyerName={selectedBuyerForCalendar.selectedBuyerName}
          article={selectedBuyerForCalendar.article}
          source={selectedBuyerForCalendar.source}
          onClose={handleCloseCalendar}
        />
      )}

      {/* Tooltip для иконки предупреждения - через Portal поверх всего */}
      {warningTooltip && (
        <Portal>
          <div
            style={{
              position: 'fixed',
              left: warningTooltip.x,
              top: warningTooltip.y - 8,
              transform: 'translateY(-100%)',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#ffffff',
              backgroundColor: '#1f2937',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 999999
            }}
          >
            {warningTooltip.text}
          </div>
        </Portal>
      )}

      {/* Перетаскиваемое окно истории привязки - как для CLP/Лиды/Рейтинг */}
      {historyWindow && (
        <DraggableTooltip
          title={`История: ${historyWindow.buyerName}`}
          onClose={() => setHistoryWindow(null)}
          initialPosition={{ x: historyWindow.x, y: historyWindow.y }}
          zIndex={999999}
        >
          <div className="space-y-3">
            {/* Сортируем историю: новые записи сверху */}
            {[...historyWindow.history].reverse().map((entry, idx, arr) => (
              <div
                key={idx}
                className={`pb-3 ${idx < arr.length - 1 ? 'border-b border-gray-200' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                    entry.action === 'assigned'
                      ? 'bg-green-500'
                      : entry.action === 'archived'
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                  }`}>
                    {entry.action === 'assigned' ? 'Привязан' : entry.action === 'archived' ? 'Архивирован' : 'Удалён'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {formatHistoryDate(entry.timestamp)}
                </div>
                <div className="text-sm font-medium text-gray-900">
                  {entry.user_name}
                </div>
                {entry.reason && (
                  <div className="text-sm text-amber-600 mt-1">
                    Причина: {entry.reason}{entry.reason_details ? ` - ${entry.reason_details}` : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DraggableTooltip>
      )}

      {/* Модальное окно выбора причины удаления */}
      {showRemovalReasonModal && (
        <RemovalReasonModal
          buyerName={showRemovalReasonModal.assignment?.buyer?.name}
          onConfirm={handleConfirmRemoval}
          onCancel={() => {
            setShowRemovalReasonModal(null);
            setRemovalReason('');
            setRemovalReasonDetails('');
          }}
        />
      )}

      {/* Модальное окно раннего удаления (в первые 3 минуты) */}
      {showEarlyRemovalModal && (
        <EarlyRemovalModal
          buyerName={showEarlyRemovalModal.assignment?.buyer?.name}
          onConfirm={handleConfirmEarlyRemoval}
          onCancel={() => setShowEarlyRemovalModal(null)}
        />
      )}
    </>
  );
});

export default OfferBuyersPanel;
