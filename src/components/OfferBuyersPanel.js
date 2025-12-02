// src/components/OfferBuyersPanel.js
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import { Plus, X, Loader2, Archive } from 'lucide-react';
import { offerBuyersService } from '../services/OffersSupabase';
import { aggregateMetricsBySourceIds, calculateConsecutiveActiveDays } from '../scripts/offers/Sql_leads';
import { getAssignmentKey, BUYER_STATUS_CONFIG, checkBuyerHasSpend } from '../scripts/offers/Update_buyer_statuses';
import BuyerMetricsCalendar from './BuyerMetricsCalendar';
import Portal from './Portal';
import { MiniSpinner, LoadingDots } from './LoadingSpinner';

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
  articleOfferMap = {} // Маппинг article -> offer_id_tracker для проверки расхода
}) {
  const [removingBuyerId, setRemovingBuyerId] = useState(null); // ID байера, который удаляется
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [availableBuyers, setAvailableBuyers] = useState([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedBuyerForCalendar, setSelectedBuyerForCalendar] = useState(null);

  // Преобразуем привязки из БД в формат компонента
  const assignedBuyers = useMemo(() => {
    const buyers = initialAssignments.map(assignment => {
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
        source_ids: assignment.source_ids || [], // Массив source_id
        created_at: assignment.created_at, // Дата привязки
        archived: assignment.archived || false, // Флаг архивации
        archived_at: assignment.archived_at // Дата архивации
      };
    });

    // Функция для получения приоритета статуса (меньше = левее)
    const getStatusPriority = (assignment) => {
      if (assignment.archived) return 0; // Неактивные - слева
      const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
      const statusData = buyerStatuses[statusKey];
      const statusType = statusData?.status || 'active';

      switch (statusType) {
        case 'not_in_tracker': return 1; // Нет в трекере
        case 'not_configured': return 2; // Не настроено
        case 'active': return 3; // Активный - справа
        default: return 4;
      }
    };

    // Функция для получения количества дней для сортировки
    const getDaysForSorting = (assignment) => {
      const sourceIds = assignment.source_ids || [];
      const offerArticle = offer?.article || '';
      const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
      const statusData = buyerStatuses[statusKey];
      const statusType = assignment.archived ? 'archived' : (statusData?.status || 'active');

      if (statusType === 'active') {
        // Для активных - дни подряд с cost > 0
        return calculateConsecutiveActiveDays(offerArticle, sourceIds, buyerMetricsData);
      } else if (statusType === 'not_configured' && statusData?.date) {
        // Для "Не настроено" - дни с момента последнего расхода
        const lastDate = new Date(statusData.date);
        const today = new Date();
        return Math.floor(Math.abs(today - lastDate) / (1000 * 60 * 60 * 24));
      } else if ((statusType === 'not_in_tracker' || statusType === 'archived') && assignment.created_at) {
        // Для "Нет в трекере" и архивированных - дни с момента привязки
        const createdDate = new Date(assignment.created_at);
        const today = new Date();
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
    setShowModal(true);
    setLoadingBuyers(true);

    try {
      // Фильтруем байеров по источнику
      const filtered = allBuyers.filter(buyer => {
        if (!buyer.buyer_settings || !buyer.buyer_settings.traffic_channels) {
          return false;
        }
        return buyer.buyer_settings.traffic_channels.some(
          channel => channel.source === source
        );
      });

      // Исключаем уже привязанных байеров для этого источника
      const alreadyAdded = assignedBuyers
        .filter(b => b.source === source)
        .map(b => b.buyer.id);

      const available = filtered.filter(buyer => !alreadyAdded.includes(buyer.id));
      setAvailableBuyers(available);
    } catch (error) {
      console.error('Ошибка фильтрации байеров:', error);
      setAvailableBuyers([]);
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

      console.log(`📦 Привязываем байера ${buyer.name} с ${sourceIds.length} source_ids для ${selectedSource}:`, sourceIds);

      // Сохраняем в БД с массивом source_ids
      const savedAssignment = await offerBuyersService.addAssignment(
        offer.id,
        buyer.id,
        buyer.name,
        selectedSource,
        sourceIds
      );

      // Уведомляем родительский компонент о новой привязке
      // Передаем savedAssignment как третий параметр для оптимизированного обновления
      if (onAssignmentsChange) {
        onAssignmentsChange(offer.id, [...initialAssignments, savedAssignment], savedAssignment);
      }

      setShowModal(false);
      setSelectedSource(null);
    } catch (error) {
      console.error('Ошибка сохранения привязки:', error);
      alert('Ошибка сохранения привязки байера');
    } finally {
      setSavingAssignment(false);
    }
  }, [selectedSource, offer.id, initialAssignments, onAssignmentsChange]);

  const handleRemoveBuyer = useCallback(async (assignmentId, assignment) => {
    if (!window.confirm('Удалить привязку байера к офферу?')) return;

    setRemovingBuyerId(assignmentId);

    try {
      const sourceIds = assignment.source_ids || [];
      const offerIdTracker = articleOfferMap[offer.article];

      console.log(`🗑️ Проверяем расход для байера ${assignment.buyer.name}...`);

      // Проверяем был ли расход у байера за все время
      const { hasSpend, totalCost } = await checkBuyerHasSpend(sourceIds, offerIdTracker);

      if (hasSpend) {
        // Был расход - архивируем (не удаляем)
        console.log(`📦 Архивируем байера ${assignment.buyer.name} (расход: $${totalCost.toFixed(2)})`);
        const archivedAssignment = await offerBuyersService.archiveAssignment(assignmentId);

        // Уведомляем родительский компонент об архивации
        if (onAssignmentsChange) {
          const updatedAssignments = initialAssignments.map(a =>
            a.id === assignmentId ? { ...a, archived: true, archived_at: archivedAssignment.archived_at } : a
          );
          onAssignmentsChange(offer.id, updatedAssignments);
        }
      } else {
        // Не было расхода - полностью удаляем
        console.log(`🗑️ Полностью удаляем байера ${assignment.buyer.name} (расход: $0)`);
        await offerBuyersService.removeAssignment(assignmentId);

        // Уведомляем родительский компонент об удалении
        if (onAssignmentsChange) {
          onAssignmentsChange(offer.id, initialAssignments.filter(a => a.id !== assignmentId));
        }
      }
    } catch (error) {
      console.error('Ошибка удаления/архивации привязки:', error);
      alert('Ошибка удаления привязки');
    } finally {
      setRemovingBuyerId(null);
    }
  }, [offer.id, offer.article, initialAssignments, onAssignmentsChange, articleOfferMap]);

  const handleOpenCalendar = useCallback((assignment) => {
    console.log('📊 Открываем календарь для байера:', assignment.buyer.name);
    console.log('📊 Article:', offer.article);
    console.log('📊 Source IDs:', assignment.source_ids);
    console.log('📊 Всего привязок оффера:', assignedBuyers.length);

    // Собираем данные по всем байерам оффера
    const allBuyersData = assignedBuyers
      .filter(a => !a.archived) // Исключаем архивированных
      .map(a => ({
        buyerId: a.buyer.id,
        buyerName: a.buyer.name,
        avatarUrl: a.buyer.avatar_url,
        sourceIds: a.source_ids || [],
        source: a.source
      }));

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

  // Группируем байеров по источникам
  const buyersBySource = useMemo(() => ({
    Facebook: assignedBuyers.filter(b => b.source === 'Facebook'),
    Google: assignedBuyers.filter(b => b.source === 'Google'),
    TikTok: assignedBuyers.filter(b => b.source === 'TikTok')
  }), [assignedBuyers]);

  // Функция для форматирования даты и расчета дней
  const formatAssignmentDate = useCallback((createdAt) => {
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
  }, []);

  const SourceColumn = React.memo(({ source, icon: Icon, buyers, isLast, onAddBuyer, onRemoveBuyer, onOpenCalendar, loadingBuyerIds, removingBuyerId }) => {
    return (
      <div className={`flex-1 px-4 py-3 ${!isLast ? 'border-r border-gray-200' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium text-gray-900">{source}</span>
            <span className="text-xs text-gray-400">({buyers.length})</span>
          </div>
          <button
            onClick={() => onAddBuyer(source)}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title={`Добавить байера для ${source}`}
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Список привязанных байеров - горизонтальный ряд со скроллом */}
        <div
          className="overflow-x-auto pb-2 -mx-1 px-1"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {buyers.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-6">
              Нет байеров
            </div>
          ) : (
            <div className="flex flex-row gap-2.5 min-w-max cursor-grab active:cursor-grabbing select-none">
              {buyers.map((assignment) => {
                const { date, days } = formatAssignmentDate(assignment.created_at);
                // Агрегируем метрики по артикулу оффера + source_ids байера за 14 дней
                const sourceIds = assignment.source_ids || [];
                const offerArticle = offer?.article || '';
                const metrics = aggregateMetricsBySourceIds(offerArticle, sourceIds, buyerMetricsData, 14);
                const hasData = metrics.leads > 0 || metrics.cost > 0;

                // Проверяем, загружается ли этот конкретный байер
                const isThisBuyerLoading = loadingBuyerIds && loadingBuyerIds.has(assignment.id);
                const isRemoving = removingBuyerId === assignment.id;
                const isArchived = assignment.archived;

                // Вычисляем данные для статуса
                const statusKey = getAssignmentKey(offer.id, assignment.buyer.id, assignment.source);
                const statusData = buyerStatuses[statusKey];
                const statusType = isArchived ? 'archived' : (statusData?.status || 'active');
                const config = isArchived
                  ? { label: 'Неактивный', color: 'bg-gray-100', textColor: 'text-gray-600' }
                  : (BUYER_STATUS_CONFIG[statusType] || BUYER_STATUS_CONFIG.active);

                // Подсчитываем дни для статуса
                let daysToShow = 0;
                let daysLabel = '';

                if (statusType === 'active') {
                  // Для активных - считаем дни подряд с cost > 0
                  daysToShow = calculateConsecutiveActiveDays(offerArticle, sourceIds, buyerMetricsData);
                  daysLabel = daysToShow > 0 ? `${daysToShow} д` : '';
                } else if (statusType === 'not_configured' && statusData?.date) {
                  // Для "Не настроено" - считаем дни с момента последнего расхода
                  const lastDate = new Date(statusData.date);
                  const today = new Date();
                  const diffTime = Math.abs(today - lastDate);
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  daysToShow = diffDays;
                  daysLabel = diffDays > 0 ? `${diffDays} д` : '';
                } else if (statusType === 'not_in_tracker' && assignment.created_at) {
                  // Для "Нет в трекере" - считаем дни с момента привязки байера
                  const createdDate = new Date(assignment.created_at);
                  const today = new Date();
                  const diffTime = Math.abs(today - createdDate);
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  daysToShow = diffDays;
                  daysLabel = diffDays > 0 ? `${diffDays} д` : '';
                } else if (statusType === 'archived' && assignment.archived_at) {
                  // Для "Неактивный" (архивированные) - считаем дни с момента архивации
                  const archivedDate = new Date(assignment.archived_at);
                  const today = new Date();
                  const diffTime = Math.abs(today - archivedDate);
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  daysToShow = diffDays;
                  daysLabel = `${diffDays} д`;
                }

                // Получаем цвета для полоски статуса
                const getStatusBarColor = () => {
                  if (isArchived) return 'bg-gray-400';
                  switch (statusType) {
                    case 'active':
                      return 'bg-green-500';
                    case 'not_configured':
                      return 'bg-red-500';
                    case 'not_in_tracker':
                      return 'bg-purple-500';
                    default:
                      return 'bg-gray-500';
                  }
                };

                return (
                  <div
                    key={assignment.id}
                    onClick={() => !isRemoving && onOpenCalendar(assignment)}
                    className={`flex-shrink-0 w-32 rounded-lg transition-all group overflow-hidden relative
                      ${isArchived
                        ? 'bg-gray-100 border-2 border-dashed border-gray-300 opacity-60 hover:opacity-80'
                        : 'bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                      }
                      ${isRemoving ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
                    `}
                    title={isArchived ? 'Архивированный байер (был расход)' : 'Нажмите для просмотра календаря метрик'}
                  >
                    {/* Индикатор загрузки при удалении/архивации */}
                    {isRemoving && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
                      </div>
                    )}

                    {/* Иконка архива для архивированных */}
                    {isArchived && (
                      <div className="absolute top-1 left-1 bg-gray-400 rounded-full p-0.5" title="Архивирован">
                        <Archive className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}

                    {/* Кнопка удаления - только для активных байеров, в правом верхнем углу карточки */}
                    {!isArchived && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBuyer(assignment.id, assignment);
                        }}
                        disabled={isRemoving}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-full transition-all hover:bg-red-100 disabled:opacity-50 z-10"
                        title="Удалить привязку"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}

                    <div className="flex flex-col items-center text-center space-y-1 p-2">
                      {/* Аватар */}
                      <div className="relative">
                        {assignment.buyer.avatar_url ? (
                          <img
                            src={assignment.buyer.avatar_url}
                            alt={assignment.buyer.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-600 text-sm font-medium">
                              {assignment.buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Имя */}
                      <div className="w-full px-0.5">
                        <div className="text-[11px] font-medium text-gray-900 leading-tight truncate" title={assignment.buyer.name}>
                          {assignment.buyer.name}
                        </div>
                      </div>

                      {/* Дата привязки и дни */}
                      <div className="text-[9px] text-gray-500">
                        {date} | {days} д
                      </div>

                      {/* Метрики CPL/Lead/Cost за 14 дней */}
                      {(loadingBuyerMetrics || isThisBuyerLoading) ? (
                        <div className="w-full flex items-center justify-center py-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                        </div>
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

                    {/* Цветная полоска статуса внизу карточки */}
                    {(loadingBuyerStatuses || isThisBuyerLoading) ? (
                      <div className="bg-gray-400 py-1.5 px-2 flex items-center justify-center">
                        <LoadingDots className="mx-auto" />
                      </div>
                    ) : (
                      <div className={`${getStatusBarColor()} py-1.5 px-2 flex items-center justify-center`}>
                        <span className="text-[10px] font-semibold text-white text-center leading-tight">
                          {config.label}{daysLabel && ` • ${daysLabel}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  });

  return (
    <>
      <div className="mt-2 bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-3">
          <SourceColumn
            source="Facebook"
            icon={FacebookIcon}
            buyers={buyersBySource.Facebook}
            isLast={false}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
            onOpenCalendar={handleOpenCalendar}
            loadingBuyerIds={loadingBuyerIds}
            removingBuyerId={removingBuyerId}
          />
          <SourceColumn
            source="Google"
            icon={GoogleIcon}
            buyers={buyersBySource.Google}
            isLast={false}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
            onOpenCalendar={handleOpenCalendar}
            loadingBuyerIds={loadingBuyerIds}
            removingBuyerId={removingBuyerId}
          />
          <SourceColumn
            source="TikTok"
            icon={TiktokIcon}
            buyers={buyersBySource.TikTok}
            isLast={true}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
            onOpenCalendar={handleOpenCalendar}
            loadingBuyerIds={loadingBuyerIds}
            removingBuyerId={removingBuyerId}
          />
        </div>
      </div>

      {/* Модальное окно выбора байера */}
      {showModal && (
        <Portal>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Выбрать байера для {selectedSource}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedSource(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={savingAssignment}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Список байеров */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingBuyers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : availableBuyers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    Нет доступных байеров с источником {selectedSource}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {assignedBuyers.filter(b => b.source === selectedSource).length > 0
                      ? 'Все подходящие байеры уже привязаны к этому офферу'
                      : 'У байеров нет настроенных каналов с этим источником'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBuyers.map(buyer => {
                    // Получаем ВСЕ channel_ids для выбранного источника
                    const channels = buyer.buyer_settings?.traffic_channels?.filter(
                      ch => ch.source === selectedSource
                    ) || [];
                    const sourceIds = channels.map(ch => ch.channel_id).filter(id => id);

                    return (
                      <button
                        key={buyer.id}
                        onClick={() => handleSelectBuyer(buyer)}
                        disabled={savingAssignment}
                        className="w-full bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg p-3 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center space-x-3">
                          {/* Аватар */}
                          {buyer.avatar_url ? (
                            <img
                              src={buyer.avatar_url}
                              alt={buyer.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                              </span>
                            </div>
                          )}

                          {/* Информация */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{buyer.name}</div>
                            <div className="text-sm text-gray-500 truncate">{buyer.email}</div>
                            {sourceIds.length > 0 && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                {sourceIds.length} Source ID{sourceIds.length > 1 ? 's' : ''}:
                                <span className="ml-1 font-mono">
                                  {sourceIds.length <= 2
                                    ? sourceIds.join(', ')
                                    : `${sourceIds[0]}, +${sourceIds.length - 1}`
                                  }
                                </span>
                              </div>
                            )}
                          </div>

                          {savingAssignment && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSource(null);
                }}
                disabled={savingAssignment}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
          </div>
        </Portal>
      )}

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
    </>
  );
});

export default OfferBuyersPanel;
