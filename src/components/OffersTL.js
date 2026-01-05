// src/components/OffersTL.js
import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition, useDeferredValue, Suspense, lazy } from 'react';
import { VariableSizeList as List } from 'react-window';
import { metricsAnalyticsService, userService } from '../supabaseClient';
import { offerStatusService, offerBuyersService, articleOfferMappingService, offerSeasonService } from '../services/OffersSupabase';
import { effectivityZonesService } from '../services/effectivityZonesService';
import {
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Package,
  Star,
  Tv,
  X,
  Target,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { updateStocksFromYml as updateStocksFromYmlScript } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays as calculateRemainingDaysScript } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql as updateLeadsFromSqlScript, fetchMetricsForSingleBuyer, fetchBuyerMetricsAllTime, clearMetricsCache } from '../scripts/offers/Sql_leads';
import { updateBuyerStatuses as updateBuyerStatusesScript, updateSingleBuyerStatus } from '../scripts/offers/Update_buyer_statuses';
import TooltipManager from './TooltipManager';
import OfferRow from './OfferRow';
import OffersFilterPanel from './OffersFilterPanel';
import { SkeletonOffersPage, MiniSpinner } from './LoadingSpinner';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';

// Lazy loading для модального окна миграции - загружается только при открытии
const MigrationModal = lazy(() => import('./MigrationModal'));

// Компонент строки для виртуализированного списка
const VirtualizedRow = React.memo(function VirtualizedRow({ index, style, data }) {
  const {
    filteredMetrics,
    offerStatuses,
    loadingState,
    openTooltip,
    handleStatusChange,
    user,
    allBuyers,
    allAssignments,
    handleAssignmentsChange,
    buyerMetricsData,
    buyerStatuses,
    articleOfferMap,
    loadingBuyerIds,
    offerSeasons,
    showExtendedColumns
  } = data;

  const metric = filteredMetrics[index];

  return (
    <div style={style} className="px-4 pb-2">
      <OfferRow
        metric={metric}
        index={index}
        offerStatus={offerStatuses[metric.id]}
        loadingLeadsData={loadingState.leads}
        loadingDays={loadingState.days}
        loadingStocks={loadingState.stocks}
        loadingBuyerStatuses={loadingState.buyerStatuses}
        onOpenTooltip={openTooltip}
        onStatusChange={handleStatusChange}
        userName={user?.name || 'Неизвестно'}
        userId={user?.id}
        allBuyers={allBuyers}
        initialAssignments={allAssignments[metric.id] || []}
        onAssignmentsChange={handleAssignmentsChange}
        buyerMetricsData={buyerMetricsData}
        buyerStatuses={buyerStatuses}
        articleOfferMap={articleOfferMap}
        loadingBuyerIds={loadingBuyerIds}
        loadingBuyerMetrics={loadingState.buyerMetrics}
        seasons={offerSeasons[metric.article] || []}
        showExtendedColumns={showExtendedColumns}
      />
    </div>
  );
});

function OffersTL({ user, onToggleFilters }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingLeadsData, setLoadingLeadsData] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);
  const [stockData, setStockData] = useState({});
  const [allBuyers, setAllBuyers] = useState([]);
  const [offerStatuses, setOfferStatuses] = useState({});
  const [allAssignments, setAllAssignments] = useState({});
  const [buyerMetricsData, setBuyerMetricsData] = useState({});
  const [loadingBuyerMetrics, setLoadingBuyerMetrics] = useState(false);
  const [buyerStatuses, setBuyerStatuses] = useState({});
  const [loadingBuyerStatuses, setLoadingBuyerStatuses] = useState(true);
  const [loadingBuyerIds, setLoadingBuyerIds] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showExtendedColumns, setShowExtendedColumns] = useState(false);
  const [articleOfferMap, setArticleOfferMap] = useState({});
  const [offerSeasons, setOfferSeasons] = useState({});
  const [isBackgroundRefresh, setIsBackgroundRefresh] = useState(false);

  // Состояние фильтров
  const [filters, setFilters] = useState({
    // 1. Статус
    statuses: [],
    daysInStatusFrom: '',
    daysInStatusTo: '',
    // 2-4. CPL, Лиды, Расходы (с периодами)
    cplPeriods: [{ period: '4', from: '', to: '' }],
    leadsPeriods: [{ period: '4', from: '', to: '' }],
    costPeriods: [{ period: '4', from: '', to: '' }],
    // 5. Рейтинг
    ratings: [],
    // 6. ROI
    roiFrom: '',
    roiTo: '',
    // 7. Зоны
    zones: [],
    // 8. Прибыль
    profitFrom: '',
    profitTo: '',
    // 9. Дней продаж
    daysRemainingFrom: '',
    daysRemainingTo: '',
    // 10. Остаток
    stockFrom: '',
    stockTo: '',
    // 11. Дней до прихода
    daysToArrivalFrom: '',
    daysToArrivalTo: '',
    // 12. Апрув %
    approveFrom: '',
    approveTo: '',
    // 13. Выкуп %
    soldFrom: '',
    soldTo: '',
    // 14. Сезон
    seasons: [],
    // 15. Цена
    priceFrom: '',
    priceTo: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(null); // Применённые фильтры

  // React 18: useTransition для неблокирующего поиска
  const [isPending, startTransition] = useTransition();

  // Ref для отслеживания автообновления
  const hasAutoUpdatedRef = useRef(false);

  // Ref для изолированного менеджера tooltip'ов
  const tooltipManagerRef = useRef(null);

  // Ref для контейнера виртуализированного списка
  const listContainerRef = useRef(null);
  const listRef = useRef(null);
  const [listHeight, setListHeight] = useState(600);

  // Версия кэша - увеличивать при изменении структуры данных!
  // v2: добавлены архивированные байеры в allBuyers
  const CACHE_VERSION = 2;

  // Ключи для кэша в sessionStorage
  const CACHE_KEYS = {
    version: 'offersTL_version',
    metrics: 'offersTL_metrics',
    buyers: 'offersTL_buyers',
    statuses: 'offersTL_statuses',
    assignments: 'offersTL_assignments',
    mappings: 'offersTL_mappings',
    lastUpdated: 'offersTL_lastUpdated',
    timestamp: 'offersTL_cacheTimestamp'
  };

  // Очистка кэша
  const clearCache = () => {
    Object.values(CACHE_KEYS).forEach(key => {
      sessionStorage.removeItem(key);
    });
  };

  // Проверка валидности кэша байеров
  const isBuyersCacheValid = (buyers) => {
    if (!buyers || !Array.isArray(buyers) || buyers.length === 0) {
      return false;
    }
    // Проверяем что в кэше есть архивированные байеры (новый формат)
    // Если их нет - кэш устаревший
    const hasArchivedBuyers = buyers.some(b => b.archived === true);
    // Также проверяем что у байеров есть buyer_settings
    const hasBuyerSettings = buyers.some(b => b.buyer_settings);
    return hasArchivedBuyers || hasBuyerSettings;
  };

  // Загрузка из кэша
  const loadFromCache = () => {
    try {
      // Проверяем версию кэша
      const cachedVersion = sessionStorage.getItem(CACHE_KEYS.version);
      if (cachedVersion !== String(CACHE_VERSION)) {
        console.log(`🔄 Кэш устарел (версия ${cachedVersion} → ${CACHE_VERSION}), очищаем...`);
        clearCache();
        return null;
      }

      const cached = {
        metrics: sessionStorage.getItem(CACHE_KEYS.metrics),
        buyers: sessionStorage.getItem(CACHE_KEYS.buyers),
        statuses: sessionStorage.getItem(CACHE_KEYS.statuses),
        assignments: sessionStorage.getItem(CACHE_KEYS.assignments),
        mappings: sessionStorage.getItem(CACHE_KEYS.mappings),
        lastUpdated: sessionStorage.getItem(CACHE_KEYS.lastUpdated),
        timestamp: sessionStorage.getItem(CACHE_KEYS.timestamp)
      };

      // Проверяем есть ли кэш и не устарел ли он (5 минут)
      if (cached.metrics && cached.timestamp) {
        const cacheAge = Date.now() - parseInt(cached.timestamp);
        const CACHE_TTL = 5 * 60 * 1000; // 5 минут

        if (cacheAge < CACHE_TTL) {
          const buyers = JSON.parse(cached.buyers || '[]');

          // Дополнительная проверка валидности байеров
          if (!isBuyersCacheValid(buyers)) {
            console.log('🔄 Кэш байеров невалидный (нет архивированных), очищаем...');
            clearCache();
            return null;
          }

          return {
            metrics: JSON.parse(cached.metrics),
            buyers: buyers,
            statuses: JSON.parse(cached.statuses || '{}'),
            assignments: JSON.parse(cached.assignments || '{}'),
            mappings: JSON.parse(cached.mappings || '{}'),
            lastUpdated: cached.lastUpdated
          };
        }
      }
      return null;
    } catch (e) {
      clearCache();
      return null;
    }
  };

  // Сохранение в кэш
  const saveToCache = (data) => {
    try {
      sessionStorage.setItem(CACHE_KEYS.version, String(CACHE_VERSION));
      sessionStorage.setItem(CACHE_KEYS.metrics, JSON.stringify(data.metrics));
      sessionStorage.setItem(CACHE_KEYS.buyers, JSON.stringify(data.buyers));
      sessionStorage.setItem(CACHE_KEYS.statuses, JSON.stringify(data.statuses));
      sessionStorage.setItem(CACHE_KEYS.assignments, JSON.stringify(data.assignments));
      sessionStorage.setItem(CACHE_KEYS.mappings, JSON.stringify(data.mappings));
      sessionStorage.setItem(CACHE_KEYS.lastUpdated, data.lastUpdated || '');
      sessionStorage.setItem(CACHE_KEYS.timestamp, Date.now().toString());
    } catch (e) {
      // ignore
    }
  };

  // Загружаем данные при монтировании
  useEffect(() => {
    // Сначала пробуем загрузить из кэша
    const cachedData = loadFromCache();

    if (cachedData && cachedData.metrics.length > 0) {
      // Есть кэш - показываем сразу
      setMetrics(cachedData.metrics);
      setAllBuyers(cachedData.buyers);
      setOfferStatuses(cachedData.statuses);
      setAllAssignments(cachedData.assignments);
      setArticleOfferMap(cachedData.mappings);
      setLastUpdated(cachedData.lastUpdated);
      setLoading(false);

      // Обновляем в фоне
      setIsBackgroundRefresh(true);
      loadAllData(true);
    } else {
      // Нет кэша - грузим с нуля
      loadAllData(false);
    }
  }, []);

  // 🔴 REALTIME & AUTO-UPDATE: ref для доступа к актуальным данным внутри callbacks
  // Используем ref чтобы избежать stale closure когда данные ещё не загружены при первом вызове
  const realtimeDataRef = useRef({ metrics, articleOfferMap, allAssignments, allBuyers });
  useEffect(() => {
    realtimeDataRef.current = { metrics, articleOfferMap, allAssignments, allBuyers };
  }, [metrics, articleOfferMap, allAssignments, allBuyers]);

  useEffect(() => {
    const subscription = offerBuyersService.subscribeToChanges(
      // INSERT: новая привязка байера
      async (newAssignment) => {
        console.log('🔔 Realtime: добавлена привязка', newAssignment);

        // Добавляем привязку в state
        setAllAssignments(prev => {
          const offerId = newAssignment.offer_id;
          const current = prev[offerId] || [];

          // Проверяем, что привязки с таким ID еще нет
          if (current.some(a => a.id === newAssignment.id)) {
            return prev;
          }

          // Удаляем существующую привязку для этого же buyer_id + source
          // (при восстановлении архивированного байера старая запись удаляется)
          const filtered = current.filter(a =>
            !(a.buyer_id === newAssignment.buyer_id && a.source === newAssignment.source)
          );

          // Если это первый байер - высота изменится, нужно пересчитать
          const prevHasBuyers = filtered.filter(a => !a.hidden).length > 0;
          if (!prevHasBuyers && listRef.current) {
            setTimeout(() => listRef.current?.resetAfterIndex(0), 0);
          }

          return {
            ...prev,
            [offerId]: [...filtered, newAssignment]
          };
        });

        // 🔄 Рассчитываем статус для нового байера
        try {
          const { metrics: currentMetrics, articleOfferMap: currentMap } = realtimeDataRef.current;
          const offerMetric = currentMetrics.find(m => m.id === newAssignment.offer_id);

          if (offerMetric) {
            const article = offerMetric.article;
            const offerIdTracker = currentMap[article];
            const sourceIds = newAssignment.source_ids || [];

            if (offerIdTracker && sourceIds.length > 0) {
              // Показываем индикатор загрузки
              setLoadingBuyerIds(prev => {
                const newSet = new Set(prev);
                newSet.add(newAssignment.id);
                return newSet;
              });

              // Получаем статус и метрики параллельно
              const [statusResult, metricsResult] = await Promise.all([
                updateSingleBuyerStatus(newAssignment, article, offerIdTracker),
                fetchMetricsForSingleBuyer(sourceIds, offerIdTracker, article)
              ]);

              // Обновляем статус
              setBuyerStatuses(prev => ({
                ...prev,
                [statusResult.key]: statusResult.status
              }));

              // Обновляем метрики
              if (metricsResult.dataBySourceIdAndDate) {
                clearMetricsCache();
                setBuyerMetricsData(prev => {
                  const newData = { ...prev };
                  Object.keys(metricsResult.dataBySourceIdAndDate).forEach(art => {
                    if (!newData[art]) newData[art] = {};
                    Object.keys(metricsResult.dataBySourceIdAndDate[art]).forEach(srcId => {
                      newData[art][srcId] = metricsResult.dataBySourceIdAndDate[art][srcId];
                    });
                  });
                  return newData;
                });
              }

              // Убираем индикатор загрузки
              setLoadingBuyerIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(newAssignment.id);
                return newSet;
              });
            }
          }
        } catch (error) {
          console.error('🔔 Realtime: ошибка расчета статуса', error);
          setLoadingBuyerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(newAssignment.id);
            return newSet;
          });
        }
      },
      // UPDATE: обновление привязки (архивация, изменение и т.д.)
      (updatedAssignment) => {
        console.log('🔔 Realtime: обновлена привязка', updatedAssignment);
        setAllAssignments(prev => {
          const offerId = updatedAssignment.offer_id;
          const current = prev[offerId] || [];
          return {
            ...prev,
            [offerId]: current.map(a =>
              a.id === updatedAssignment.id ? updatedAssignment : a
            )
          };
        });
      },
      // DELETE: удаление привязки
      (deletedAssignment) => {
        console.log('🔔 Realtime: удалена привязка', deletedAssignment);
        setAllAssignments(prev => {
          const offerId = deletedAssignment.offer_id;
          const current = prev[offerId] || [];
          const newAssignments = current.filter(a => a.id !== deletedAssignment.id);
          // Если удалили последнего байера - высота изменится, нужно пересчитать
          const prevHasBuyers = current.filter(a => !a.hidden).length > 0;
          const newHasBuyers = newAssignments.filter(a => !a.hidden).length > 0;
          if (prevHasBuyers && !newHasBuyers && listRef.current) {
            setTimeout(() => listRef.current?.resetAfterIndex(0), 0);
          }
          return {
            ...prev,
            [offerId]: newAssignments
          };
        });
      }
    );

    // Отписываемся при размонтировании компонента
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Дебаунс для поиска - 300мс задержка + useTransition для неблокирующего UI
  useEffect(() => {
    const timer = setTimeout(() => {
      // startTransition помечает обновление как неприоритетное
      // UI остается отзывчивым во время фильтрации
      startTransition(() => {
        setDebouncedSearchTerm(searchTerm);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Отслеживание высоты контейнера для виртуализации
  useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        const height = listContainerRef.current.clientHeight;
        if (height > 0) {
          setListHeight(height);
        }
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [loading]);

  // Сброс кэша высот при изменении привязок байеров или фильтрации
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [allAssignments, debouncedSearchTerm, sortField, sortDirection]);

  // Автообновление метрик после загрузки данных
  useEffect(() => {
    // Проверяем что ВСЕ данные загружены и автообновление еще не запускалось
    // ВАЖНО: allBuyers должен быть загружен для корректного определения статусов!
    // ВАЖНО: НЕ запускаем пока идёт background refresh - иначе используем устаревшие данные из кэша!
    if (
      metrics.length > 0 &&
      allBuyers.length > 0 &&
      Object.keys(allAssignments).length > 0 &&
      Object.keys(articleOfferMap).length > 0 &&
      !loading &&
      !isBackgroundRefresh &&  // 🔴 КРИТИЧНО: ждём завершения фоновой загрузки свежих данных!
      !hasAutoUpdatedRef.current
    ) {
      // 🔴 КРИТИЧНО: Обновляем ref СИНХРОННО перед вызовом autoUpdateMetrics!
      // Это решает race condition - другой useEffect может ещё не обновить ref,
      // а autoUpdateMetrics читает allBuyers из ref
      realtimeDataRef.current = { metrics, articleOfferMap, allAssignments, allBuyers };
      hasAutoUpdatedRef.current = true;
      autoUpdateMetrics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, allBuyers, allAssignments, articleOfferMap, loading, isBackgroundRefresh]);

  // Главная функция загрузки данных
  const loadAllData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError('');

      // Запускаем ВСЕ запросы параллельно
      // ВАЖНО: загружаем ВСЕХ байеров включая архивированных, чтобы иметь доступ к их buyer_settings
      // для корректного отображения метрик (archived байеры могут быть привязаны к офферам)
      const [metricsResult, buyersResult, statusesResult, assignmentsResult, mappingsResult, seasonsResult] = await Promise.all([
        metricsAnalyticsService.getAllMetrics().catch(e => ({ metrics: [], error: e })),
        userService.getUsersByRole('buyer', true).catch(e => []),  // includeArchived = true
        offerStatusService.getAllStatuses().catch(e => []),
        offerBuyersService.getAllAssignments().catch(e => []),
        articleOfferMappingService.getAllMappings().catch(e => ({})),
        offerSeasonService.getAllSeasons().catch(e => [])
      ]);

      // Устанавливаем метрики
      // ВАЖНО: Очищаем поля зон - они должны загружаться только через API offers_collection
      const metricsData = (metricsResult.metrics || []).map(m => ({
        ...m,
        // Очищаем поля зон эффективности (будут заполнены через "Обновить зоны")
        offer_zone: null,
        actual_roi_percent: null,  // ROI тоже очищаем
        red_zone_price: null,
        pink_zone_price: null,
        gold_zone_price: null,
        green_zone_price: null,
        // Очищаем Апрув и Выкуп (тоже из API)
        approve_percent: null,
        sold_percent: null
      }));
      setMetrics(metricsData);
      setLastUpdated(metricsResult.lastUpdated);

      // Устанавливаем байеров
      const buyersData = buyersResult || [];
      setAllBuyers(buyersData);

      // Обрабатываем статусы
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
        let daysInStatus = 0;
        if (status.status_history && status.status_history.length > 0) {
          const currentStatusEntry = status.status_history[0];
          const changedAt = new Date(currentStatusEntry.changed_at);
          const now = new Date();
          daysInStatus = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
        }
        statusesMap[status.offer_id] = {
          ...status,
          days_in_status: daysInStatus
        };
      });
      setOfferStatuses(statusesMap);

      // Группируем привязки по offer_id
      const grouped = {};
      (assignmentsResult || []).forEach(a => {
        if (!grouped[a.offer_id]) {
          grouped[a.offer_id] = [];
        }
        grouped[a.offer_id].push(a);
      });
      setAllAssignments(grouped);

      // Устанавливаем маппинги артикулов -> offer_id
      const mappingsData = mappingsResult || {};
      setArticleOfferMap(mappingsData);

      // Обрабатываем сезоны (article -> seasons[])
      const seasonsMap = {};
      (seasonsResult || []).forEach(season => {
        seasonsMap[season.article] = season.seasons || [];
      });
      setOfferSeasons(seasonsMap);

      // Сохраняем в кэш (только первую страницу)
      saveToCache({
        metrics: metricsData,
        buyers: buyersData,
        statuses: statusesMap,
        assignments: grouped,
        mappings: mappingsData,
        lastUpdated: metricsResult.lastUpdated
      });

    } catch (error) {
      if (!isBackground) {
        setError('Ошибка загрузки: ' + error.message);
      }
    } finally {
      setLoading(false);
      setIsBackgroundRefresh(false);
    }
  };

  // Callback для обновления привязок после изменения
  // Оптимизация: асинхронные операции вынесены из setState
  const handleAssignmentsChange = useCallback(async (offerId, newAssignments, addedAssignment = null) => {
    // Проверяем изменилось ли количество байеров (влияет на высоту строки)
    const prevAssignments = allAssignments[offerId] || [];
    const prevHasBuyers = prevAssignments.filter(a => !a.hidden).length > 0;
    const newHasBuyers = newAssignments.filter(a => !a.hidden).length > 0;
    const heightChanged = prevHasBuyers !== newHasBuyers;

    // Обновляем state привязок синхронно
    setAllAssignments(prev => ({
      ...prev,
      [offerId]: newAssignments
    }));

    // Если высота изменилась - пересчитываем высоты в виртуализированном списке
    if (heightChanged && listRef.current) {
      // Сбрасываем кэш высот с начала списка
      listRef.current.resetAfterIndex(0);
    }

    // Асинхронное обновление статусов и метрик ТОЛЬКО для нового байера (вне setState)
    if (addedAssignment) {
      try {
        // Получаем метрику этого оффера
        const offerMetric = metrics.find(m => m.id === offerId);
        if (!offerMetric) {
          return;
        }

        // Получаем article и offer_id_tracker
        const article = offerMetric.article;
        const offerIdTracker = articleOfferMap[article];
        const sourceIds = addedAssignment.source_ids || [];

        // Добавляем ID привязки в список загружаемых (для анимации)
        setLoadingBuyerIds(prev => {
          const newSet = new Set(prev);
          newSet.add(addedAssignment.id);
          return newSet;
        });

        try {
          // Обновляем статус и метрики параллельно ТОЛЬКО для этого байера
          const [statusResult, metricsResult] = await Promise.all([
            // Оптимизированное обновление статуса ОДНОГО байера
            updateSingleBuyerStatus(addedAssignment, article, offerIdTracker),

            // Оптимизированное получение метрик ОДНОГО байера
            fetchMetricsForSingleBuyer(sourceIds, offerIdTracker, article)
          ]);

          // Сохраняем результаты (мержим с существующими данными)
          setBuyerStatuses(prev => ({
            ...prev,
            [statusResult.key]: statusResult.status
          }));

          if (metricsResult.dataBySourceIdAndDate) {
            clearMetricsCache(); // Очищаем кэш при добавлении новых данных
            setBuyerMetricsData(prev => {
              // Мержим данные по артикулу
              const newData = { ...prev };
              Object.keys(metricsResult.dataBySourceIdAndDate).forEach(art => {
                if (!newData[art]) {
                  newData[art] = {};
                }
                Object.keys(metricsResult.dataBySourceIdAndDate[art]).forEach(srcId => {
                  newData[art][srcId] = metricsResult.dataBySourceIdAndDate[art][srcId];
                });
              });
              return newData;
            });
          }
        } finally {
          // Убираем ID привязки из списка загружаемых
          setLoadingBuyerIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(addedAssignment.id);
            return newSet;
          });
        }
      } catch (error) {
        // Очищаем loadingBuyerIds в случае ошибки
        setLoadingBuyerIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(addedAssignment.id);
          return newSet;
        });
      }
    }
  }, [metrics, articleOfferMap, allAssignments]);

  // Обновление статусов после изменения
  const handleStatusChange = async (offerId, newStatus) => {
    // Обновляем локально без перезагрузки
    setOfferStatuses(prev => ({
      ...prev,
      [offerId]: {
        ...prev[offerId],
        current_status: newStatus,
        days_in_status: 0
      }
    }));
  };

  // Обновление маппингов и статусов после миграции
  const handleMigrationSuccess = async () => {
    try {
      // Перезагружаем маппинги артикулов
      const mappings = await articleOfferMappingService.getAllMappings();
      setArticleOfferMap(mappings);

      // Перезагружаем статусы офферов
      const statusesResult = await offerStatusService.getAllStatuses();
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
        let daysInStatus = 0;
        if (status.status_history && status.status_history.length > 0) {
          const currentStatusEntry = status.status_history[0];
          const changedAt = new Date(currentStatusEntry.changed_at);
          const now = new Date();
          daysInStatus = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
        }
        statusesMap[status.offer_id] = {
          ...status,
          days_in_status: daysInStatus
        };
      });
      setOfferStatuses(statusesMap);

    } catch (error) {
      // ignore
    }
  };

  // Функция для открытия tooltip через изолированный менеджер (без setState в OffersTL!)
  const openTooltip = useCallback((type, index, data, event) => {
    if (!tooltipManagerRef.current) return;

    const tooltipId = `${type}-${index}`;
    let position = { x: 100, y: 100 };
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      position = { x: rect.left + rect.width + 10, y: rect.top };
    }

    // Генерируем title и content синхронно
    const title = getTooltipTitleSync(type, data.article);
    const content = renderTooltipContentSync(type, data);

    tooltipManagerRef.current.open(tooltipId, title, content, position);
  }, []);

  // АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ: запускается при загрузке страницы
  const autoUpdateMetrics = useCallback(async () => {
    // ВАЖНО: Получаем актуальные данные из ref, а не из замыкания!
    // Это решает проблему stale closure когда данные ещё не загружены при первом вызове
    const { metrics: currentMetrics, articleOfferMap: currentArticleOfferMap, allAssignments: currentAssignments, allBuyers: currentBuyers } = realtimeDataRef.current;

    // Проверяем что есть данные для обновления
    if (!currentMetrics || currentMetrics.length === 0) {
      console.log('⚠️ autoUpdateMetrics: metrics ещё не загружены');
      return;
    }

    if (!currentArticleOfferMap || Object.keys(currentArticleOfferMap).length === 0) {
      console.log('⚠️ autoUpdateMetrics: articleOfferMap ещё не загружен');
      return;
    }

    try {
      console.log('🔄 autoUpdateMetrics: запуск с актуальными данными из ref');
      console.log(`   metrics: ${currentMetrics.length}, articleOfferMap: ${Object.keys(currentArticleOfferMap).length}, assignments: ${Object.keys(currentAssignments).length}`);

      // Загрузка метрик байеров за ВСЁ ВРЕМЯ (без прогресса в UI)
      setLoadingBuyerMetrics(true);

      // Callback для обновления данных (без частых setState для прогресса)
      const onBuyerMetricsProgress = (partialData, progress, isComplete) => {
        // Обновляем данные только при завершении или каждые 25%
        if (isComplete || progress % 25 === 0) {
          clearMetricsCache(); // Очищаем кэш метрик при обновлении данных
          setBuyerMetricsData(partialData);
        }
        if (isComplete) {
          setLoadingBuyerMetrics(false);
        }
      };

      const buyerMetricsPromise = fetchBuyerMetricsAllTime(currentArticleOfferMap, onBuyerMetricsProgress);

      // ШАГ 1: Запускаем ПАРАЛЛЕЛЬНО остатки и статусы байеров

      setLoadingStocks(true);
      setLoadingBuyerStatuses(true);

      const [stocksResult, buyerStatusesResult] = await Promise.all([
        // Обновление остатков
        (async () => {
          try {
            const result = await updateStocksFromYmlScript(currentMetrics);
            setStockData(result.skuData);
            return result;
          } catch (error) {
            return { metrics: currentMetrics, totalArticles: 0, skuData: {} };
          } finally {
            setLoadingStocks(false);
          }
        })(),

        // Обновление статусов байеров
        (async () => {
          try {
            const flatAssignments = Object.values(currentAssignments).flat();
            if (flatAssignments.length > 0) {
              // ВАЖНО: передаём currentBuyers для получения sourceIds из traffic_channels
              const statuses = await updateBuyerStatusesScript(flatAssignments, currentArticleOfferMap, currentMetrics, currentBuyers);
              setBuyerStatuses(statuses);
              return statuses;
            }
            return {};
          } catch (error) {
            return {};
          } finally {
            setLoadingBuyerStatuses(false);
          }
        })()
      ]);

      let updatedMetrics = stocksResult.metrics;

      // ШАГ 2: Расчет дней продаж
      setLoadingDays(true);

      try {
        const daysResult = await calculateRemainingDaysScript(updatedMetrics, currentArticleOfferMap);
        setLoadingDays(false);

        // ШАГ 3: Расчет CPL/Лидов/Рейтинга
        setLoadingLeadsData(true);

        const leadsResult = await updateLeadsFromSqlScript(
          updatedMetrics,
          currentArticleOfferMap,
          daysResult.rawData
        );
        setLoadingLeadsData(false);

        // Объединяем результаты
        updatedMetrics = updatedMetrics.map(metric => {
          const leadsMetric = leadsResult.metrics.find(m => m.id === metric.id);
          const daysMetric = daysResult.metrics.find(m => m.id === metric.id);

          return {
            ...metric,
            ...(leadsMetric || {}),
            ...(daysMetric || {})
          };
        });

        // Ждём завершения загрузки метрик байеров
        await buyerMetricsPromise;

        setMetrics(updatedMetrics);
        setLoadingBuyerMetrics(false);
      } catch (error) {
        setLoadingDays(false);
        setLoadingLeadsData(false);
      }

    } catch (error) {
      // ignore
    }
  }, [metrics, allAssignments, articleOfferMap]);

  // ГЛАВНАЯ ФУНКЦИЯ: Обновление всех метрик
  const updateAllMetrics = async () => {
    try {
      setError('');

      // Загрузка метрик байеров (без частых обновлений прогресса)
      setLoadingBuyerMetrics(true);

      const onBuyerMetricsProgress = (partialData, progress, isComplete) => {
        // Обновляем данные только при завершении или каждые 25%
        if (isComplete || progress % 25 === 0) {
          clearMetricsCache(); // Очищаем кэш метрик при обновлении данных
          setBuyerMetricsData(partialData);
        }
        if (isComplete) {
          setLoadingBuyerMetrics(false);
        }
      };

      const buyerMetricsPromise = fetchBuyerMetricsAllTime(articleOfferMap, onBuyerMetricsProgress);

      // ШАГ 1: Обновляем остатки
      setLoadingStocks(true);
      const stocksResult = await updateStocksFromYmlScript(metrics);
      let updatedMetrics = stocksResult.metrics;
      setStockData(stocksResult.skuData);
      setLoadingStocks(false);

      // ШАГ 2: Загрузка данных и расчет Дней продаж
      setLoadingDays(true);
      const daysResult = await calculateRemainingDaysScript(updatedMetrics, articleOfferMap);
      setLoadingDays(false);

      // ШАГ 3: Расчет CPL/Лидов/Рейтинга
      setLoadingLeadsData(true);

      const leadsResult = await updateLeadsFromSqlScript(
        updatedMetrics,
        articleOfferMap,
        daysResult.rawData
      );

      setLoadingLeadsData(false);

      // Объединяем результаты
      updatedMetrics = updatedMetrics.map(metric => {
        const leadsMetric = leadsResult.metrics.find(m => m.id === metric.id);
        const daysMetric = daysResult.metrics.find(m => m.id === metric.id);

        return {
          ...metric,
          ...(leadsMetric || {}),
          ...(daysMetric || {})
        };
      });

      // Ждём завершения загрузки метрик байеров
      await buyerMetricsPromise;

      setMetrics(updatedMetrics);
      setLoadingBuyerMetrics(false);

    } catch (error) {
      setError('Ошибка обновления метрик: ' + error.message);
    } finally {
      setLoadingStocks(false);
      setLoadingLeadsData(false);
      setLoadingDays(false);
      setLoadingBuyerMetrics(false);
    }
  };

  const updateStocksFromYml = async () => {
    try {
      setLoadingStocks(true);
      setError('');

      const result = await updateStocksFromYmlScript(metrics);

      setMetrics(result.metrics);
      setStockData(result.skuData);

    } catch (error) {
      setError('Ошибка загрузки остатков: ' + error.message);
    } finally {
      setLoadingStocks(false);
    }
  };

  const calculateDays = async () => {
    try {
      setLoadingDays(true);
      setError('');

      const result = await calculateRemainingDaysScript(metrics, articleOfferMap);

      setMetrics(result.metrics);

    } catch (error) {
      setError('Ошибка расчета дней продаж: ' + error.message);
    } finally {
      setLoadingDays(false);
    }
  };

  // Единая функция для обновления ТРЕХ колонок: CPL 4дн, Лиды 4дн, Рейтинг
  const updateLeadsData = async () => {
    try {
      setLoadingLeadsData(true);
      setError('');

      // Загрузка метрик байеров (без частых обновлений прогресса)
      setLoadingBuyerMetrics(true);

      const onBuyerMetricsProgress = (partialData, progress, isComplete) => {
        if (isComplete || progress % 25 === 0) {
          clearMetricsCache(); // Очищаем кэш метрик при обновлении данных
          setBuyerMetricsData(partialData);
        }
        if (isComplete) {
          setLoadingBuyerMetrics(false);
        }
      };

      const buyerMetricsPromise = fetchBuyerMetricsAllTime(articleOfferMap, onBuyerMetricsProgress);

      // Обновляем ВСЕ ТРИ колонки одним запросом
      const result = await updateLeadsFromSqlScript(metrics, articleOfferMap);

      setMetrics(result.metrics);

      // Ждём завершения загрузки метрик байеров
      await buyerMetricsPromise;

      setLoadingBuyerMetrics(false);

    } catch (error) {
      setError('Ошибка загрузки данных: ' + error.message);
    } finally {
      setLoadingLeadsData(false);
      setLoadingBuyerMetrics(false);
    }
  };

  // Функция обновления статусов байеров
  const updateBuyerStatuses = async () => {
    try {
      setLoadingBuyerStatuses(true);
      setError('');

      // Собираем все привязки в плоский массив
      const flatAssignments = Object.values(allAssignments).flat();

      if (flatAssignments.length === 0) {
        return;
      }

      // Передаем metrics и allBuyers для получения sourceIds из traffic_channels
      const statuses = await updateBuyerStatusesScript(flatAssignments, articleOfferMap, metrics, allBuyers);
      setBuyerStatuses(statuses);

    } catch (error) {
      setError('Ошибка обновления статусов: ' + error.message);
    } finally {
      setLoadingBuyerStatuses(false);
    }
  };

  // Функция обновления зон эффективности из API offers_collection
  const updateEffectivityZones = async () => {
    try {
      setLoadingZones(true);
      setError('');

      if (metrics.length === 0) {
        console.log('⚠️ Нет метрик для обновления зон');
        return;
      }

      console.log(`🔄 Обновление зон эффективности для ${metrics.length} офферов`);

      // Обогащаем метрики данными зон из API
      const enrichedMetrics = await effectivityZonesService.enrichMetricsWithZones(metrics);

      // Обновляем метрики в стейте
      setMetrics(enrichedMetrics);

      console.log('✅ Зоны эффективности обновлены');

    } catch (error) {
      console.error('❌ Ошибка обновления зон:', error);
      setError('Ошибка обновления зон: ' + error.message);
    } finally {
      setLoadingZones(false);
    }
  };

  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return new Date(dateString).toLocaleDateString('ru-RU');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    } catch (error) {
      return '—';
    }
  };

  const formatFullDate = useCallback((dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return '—';
    }
  }, []);

  // Синхронная функция для генерации заголовка tooltip
  const getTooltipTitleSync = (type, article) => {
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;
    const titles = {
      rating: 'История рейтинга',
      cpl: 'Статистика CPL',
      leads: 'Статистика лидов',
      stock: 'Модификации товара',
      date: 'Дата прихода',
      zone: 'Цена лида в зоне',
      status_history: 'История статусов',
      season: 'Сезон и категория'
    };
    return <div className="flex items-center gap-2"><span>{titles[type] || 'Информация'}</span>{articleBadge}</div>;
  };

  // Синхронная функция для генерации контента tooltip
  const renderTooltipContentSync = (type, data) => {
    const getRatingColorLocal = (rating) => {
      switch (rating) {
        case 'A': return 'bg-green-100 text-green-800';
        case 'B': return 'bg-yellow-100 text-yellow-800';
        case 'C': return 'bg-orange-100 text-orange-800';
        case 'D': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-400';
      }
    };
    const getZoneColorsLocal = (zoneType) => {
      switch (zoneType) {
        case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
        case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
        case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
        case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
        default: return null;
      }
    };
    const formatDateLocal = (dateString) => {
      if (!dateString) return '—';
      try { return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
      catch { return '—'; }
    };

    switch (type) {
      case 'rating':
        return (
          <div className="flex flex-col gap-2">
            {data.ratingHistory?.length > 0 ? data.ratingHistory.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 last:border-b-0">
                <span className="text-gray-600 w-20">{item.month} {item.year}</span>
                <span className={`font-semibold px-2 py-1 rounded ${getRatingColorLocal(item.rating)}`}>{item.rating}</span>
                <span className="text-gray-700 font-mono">CPL: {item.cpl > 0 ? item.cpl.toFixed(2) : '—'}</span>
                <span className="text-gray-700">Лиды: {item.leads}</span>
              </div>
            )) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
          </div>
        );
      case 'cpl':
      case 'leads':
        return (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2">Период</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'CPL' : 'Лидов'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Расход' : 'CPL'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Лидов' : 'Расход'}</th>
            </tr></thead>
            <tbody>
              {[7, 14, 30, 60, 90].map(days => {
                const d = data.leadsData?.[days];
                if (!d) return null;
                return <tr key={days} className="border-b border-gray-100">
                  <td className="py-1 px-2">{d.label}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cpl.toFixed(2) : d.leads}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.cost.toFixed(2) : d.cpl.toFixed(2)}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.leads : d.cost.toFixed(2)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        );
      case 'stock':
        const baseArticle = data.article?.split("-")[0];
        const mods = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];
        return <div className="flex flex-col gap-1.5">
          {mods.length > 0 ? mods.map((m, i) => <div key={i} className="text-xs text-gray-700">{m}</div>) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
        </div>;
      case 'date':
        return <div className="text-sm text-gray-900 font-mono">{data.date ? formatDateLocal(data.date) : 'Нет данных'}</div>;
      case 'zone':
        const m = data.metric;
        return <div className="flex flex-col gap-2">
          {['red', 'pink', 'gold', 'green'].map(z => {
            const price = m[`${z}_zone_price`];
            if (price == null) return null;
            const c = getZoneColorsLocal(z);
            return <div key={z} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20 capitalize">{z === 'red' ? 'Красная' : z === 'pink' ? 'Розовая' : z === 'gold' ? 'Золотая' : 'Зеленая'}:</span>
              <span className={`font-mono px-2 py-1 rounded-full text-xs border ${c.bg} ${c.text} ${c.border}`}>${Number(price).toFixed(2)}</span>
            </div>;
          })}
        </div>;
      case 'status_history':
        return <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          {(data.statusHistory || []).map((entry, i) => {
            const cfg = offerStatusService.getStatusColor(entry.status);
            return <div key={i} className={`p-3 rounded-lg border-2 ${i === 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-3 h-3 rounded-full ${cfg.color}`}></span>
                <span className="text-sm font-semibold">{entry.status}</span>
                {i === 0 && <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Текущий</span>}
              </div>
              <div className="text-xs text-gray-600">С: {formatDateLocal(entry.from_date)} → До: {formatDateLocal(entry.to_date)}</div>
              <div className="text-xs">Длительность: <b>{entry.days_in_status} дн.</b></div>
              {entry.changed_by && (
                <div className="text-xs text-gray-600 mt-1">
                  Изменил: <b className="text-blue-600">{entry.changed_by}</b>
                </div>
              )}
            </div>;
          })}
        </div>;
      case 'season':
        return <div className="flex flex-col gap-3">
          <div><div className="text-xs font-medium text-gray-600 mb-1">Категория:</div><div className="text-sm">{data.category || '—'}</div></div>
          {data.categoryDetails?.length > 0 && <div><div className="text-xs font-medium text-gray-600 mb-1">Категории товаров:</div>
            {data.categoryDetails.map((d, i) => <div key={i} className="text-xs text-gray-700">{d}</div>)}
          </div>}
          <div><div className="text-xs font-medium text-gray-600 mb-1">Спецсезон:</div>
            {data.specialSeasonStart || data.specialSeasonEnd ? <div className="text-sm font-mono">{data.specialSeasonStart || '—'} — {data.specialSeasonEnd || '—'}</div> : <div className="text-sm text-gray-500 italic">Не задан</div>}
          </div>
        </div>;
      default:
        return <div>Неизвестный тип</div>;
    }
  };

  // Группируем loading состояния для уменьшения ре-рендеров
  const loadingState = useMemo(() => ({
    stocks: loadingStocks,
    days: loadingDays,
    leads: loadingLeadsData,
    buyerMetrics: loadingBuyerMetrics,
    buyerStatuses: loadingBuyerStatuses
  }), [loadingStocks, loadingDays, loadingLeadsData, loadingBuyerMetrics, loadingBuyerStatuses]);

  // Фильтрация и сортировка (используем debouncedSearchTerm для оптимизации)
  const filteredMetrics = useMemo(() => {
    const searchLower = debouncedSearchTerm.toLowerCase();
    const f = appliedFilters; // Применённые фильтры

    return metrics.filter(metric => {
      // Поиск по тексту
      if (debouncedSearchTerm !== '') {
        const matchesSearch = metric.article?.toLowerCase().includes(searchLower) ||
          metric.offer?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Применяем фильтры только если есть appliedFilters
      if (f) {
        // Фильтр по статусам
        if (f.statuses && f.statuses.length > 0) {
          const offerStatus = offerStatuses[metric.id];
          const currentStatus = offerStatus?.current_status || '';
          if (!f.statuses.includes(currentStatus)) {
            return false;
          }
        }

        // Фильтр по количеству дней в статусе
        const daysFrom = f.daysInStatusFrom !== '' ? parseInt(f.daysInStatusFrom, 10) : 0;
        const daysTo = f.daysInStatusTo !== '' ? parseInt(f.daysInStatusTo, 10) : Infinity;

        if (f.daysInStatusFrom !== '' || f.daysInStatusTo !== '') {
          const offerStatus = offerStatuses[metric.id];
          const daysInStatus = offerStatus?.days_in_status ?? 0;

          if (daysInStatus < daysFrom || daysInStatus > daysTo) {
            return false;
          }
        }

        // Фильтр по рейтингу
        if (f.ratings && f.ratings.length > 0) {
          const rating = metric.rating || '';
          if (!f.ratings.includes(rating)) {
            return false;
          }
        }

        // Фильтр по CPL (с периодами) - данные из leads_data
        if (f.cplPeriods && f.cplPeriods.length > 0) {
          for (const periodItem of f.cplPeriods) {
            if (periodItem.from === '' && periodItem.to === '') continue;

            const cplFrom = periodItem.from !== '' ? parseFloat(periodItem.from) : 0;
            const cplTo = periodItem.to !== '' ? parseFloat(periodItem.to) : Infinity;
            // Данные хранятся в leads_data[period].cpl (период как число)
            const periodData = metric.leads_data?.[parseInt(periodItem.period, 10)];
            const cpl = periodData?.cpl ?? null;

            if (cpl === null || cpl < cplFrom || cpl > cplTo) {
              return false;
            }
          }
        }

        // Фильтр по лидам (с периодами) - данные из leads_data
        if (f.leadsPeriods && f.leadsPeriods.length > 0) {
          for (const periodItem of f.leadsPeriods) {
            if (periodItem.from === '' && periodItem.to === '') continue;

            const leadsFrom = periodItem.from !== '' ? parseInt(periodItem.from, 10) : 0;
            const leadsTo = periodItem.to !== '' ? parseInt(periodItem.to, 10) : Infinity;
            // Данные хранятся в leads_data[period].leads (период как число)
            const periodData = metric.leads_data?.[parseInt(periodItem.period, 10)];
            const leads = periodData?.leads ?? null;

            if (leads === null || leads < leadsFrom || leads > leadsTo) {
              return false;
            }
          }
        }

        // Фильтр по расходам (с периодами) - данные из leads_data
        if (f.costPeriods && f.costPeriods.length > 0) {
          for (const periodItem of f.costPeriods) {
            if (periodItem.from === '' && periodItem.to === '') continue;

            const costFrom = periodItem.from !== '' ? parseFloat(periodItem.from) : 0;
            const costTo = periodItem.to !== '' ? parseFloat(periodItem.to) : Infinity;
            // Данные хранятся в leads_data[period].cost (период как число)
            const periodData = metric.leads_data?.[parseInt(periodItem.period, 10)];
            const cost = periodData?.cost ?? null;

            if (cost === null || cost < costFrom || cost > costTo) {
              return false;
            }
          }
        }

        // Фильтр по остатку
        if (f.stockFrom !== '' || f.stockTo !== '') {
          const stockFrom = f.stockFrom !== '' ? parseInt(f.stockFrom, 10) : 0;
          const stockTo = f.stockTo !== '' ? parseInt(f.stockTo, 10) : Infinity;
          const stock = metric.stock ?? null;

          if (stock === null || stock < stockFrom || stock > stockTo) {
            return false;
          }
        }

        // Фильтр по дням продаж
        if (f.daysRemainingFrom !== '' || f.daysRemainingTo !== '') {
          const daysRemainingFrom = f.daysRemainingFrom !== '' ? parseInt(f.daysRemainingFrom, 10) : 0;
          const daysRemainingTo = f.daysRemainingTo !== '' ? parseInt(f.daysRemainingTo, 10) : Infinity;
          const daysRemaining = metric.days_remaining ?? null;

          if (daysRemaining === null || daysRemaining < daysRemainingFrom || daysRemaining > daysRemainingTo) {
            return false;
          }
        }

        // Фильтр по Апрув %
        if (f.approveFrom !== '' || f.approveTo !== '') {
          const approveFrom = f.approveFrom !== '' ? parseFloat(f.approveFrom) : 0;
          const approveTo = f.approveTo !== '' ? parseFloat(f.approveTo) : Infinity;
          const approve = metric.approve_percent ?? null;

          if (approve === null || approve < approveFrom || approve > approveTo) {
            return false;
          }
        }

        // Фильтр по Выкуп %
        if (f.soldFrom !== '' || f.soldTo !== '') {
          const soldFrom = f.soldFrom !== '' ? parseFloat(f.soldFrom) : 0;
          const soldTo = f.soldTo !== '' ? parseFloat(f.soldTo) : Infinity;
          const sold = metric.sold_percent ?? null;

          if (sold === null || sold < soldFrom || sold > soldTo) {
            return false;
          }
        }
      }

      return true;
    }).sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [metrics, debouncedSearchTerm, sortField, sortDirection, appliedFilters, offerStatuses]);

  // useDeferredValue - отложенная версия для неблокирующего рендеринга списка
  // UI остается отзывчивым даже при большом количестве офферов
  const deferredFilteredMetrics = useDeferredValue(filteredMetrics);
  const isStale = deferredFilteredMetrics !== filteredMetrics;

  // Функция расчета высоты строки
  // Карточки байеров расположены горизонтально, поэтому высота почти фиксированная
  const getItemSize = useCallback((index) => {
    const metric = deferredFilteredMetrics[index];
    if (!metric) return 320;

    const assignments = allAssignments[metric.id] || [];
    const hasAnyBuyers = assignments.length > 0;

    // Структура высоты:
    // - Строка метрик: ~45px
    // - Заголовок панели байеров: ~35px
    // - Заголовки колонок (FB/Google/TikTok): ~45px
    // - Область карточек байеров: ~220px (или меньше если пусто)
    // - Отступы между строками: ~35px

    if (hasAnyBuyers) {
      return 380; // Полная высота с карточками + отступ
    } else {
      return 260; // Меньшая высота когда нет байеров + отступ
    }
  }, [deferredFilteredMetrics, allAssignments]);

  // itemData для виртуализированного списка - мемоизируем для предотвращения лишних ре-рендеров
  // Используем deferredFilteredMetrics для неблокирующего рендеринга
  const itemData = useMemo(() => ({
    filteredMetrics: deferredFilteredMetrics,
    offerStatuses,
    loadingState,
    openTooltip,
    handleStatusChange,
    user,
    allBuyers,
    allAssignments,
    handleAssignmentsChange,
    buyerMetricsData,
    buyerStatuses,
    articleOfferMap,
    loadingBuyerIds,
    offerSeasons,
    showExtendedColumns
  }), [deferredFilteredMetrics, offerStatuses, loadingState, openTooltip, handleStatusChange, user, allBuyers, allAssignments, handleAssignmentsChange, buyerMetricsData, buyerStatuses, articleOfferMap, loadingBuyerIds, offerSeasons, showExtendedColumns]);

  const handleSort = useCallback((field) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        return prevField;
      } else {
        setSortDirection('asc');
        return field;
      }
    });
  }, []);

  if (loading) {
    return <SkeletonOffersPage />;
  }

  return (
    <div className="h-full flex bg-slate-50">
      {/* Панель фильтров */}
      <OffersFilterPanel
        isOpen={showFilters}
        onClose={() => {
          setShowFilters(false);
          onToggleFilters?.(false);
        }}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={(newFilters) => setAppliedFilters({ ...newFilters })}
      />

      {/* Основной контент */}
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Офферы
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (tooltipManagerRef.current) {
                  tooltipManagerRef.current.closeAll();
                }
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
            >
              <X className="h-4 w-4 mr-2" />
              Закрыть все окна
            </button>
            <button
              onClick={() => setShowMigrationModal(true)}
              className="inline-flex items-center px-4 py-2 border border-blue-300 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200"
            >
              Миграция
            </button>
            <button
              onClick={updateBuyerStatuses}
              disabled={loadingBuyerStatuses}
              className="inline-flex items-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingBuyerStatuses ? 'animate-spin' : ''}`} />
              Обновить статусы
            </button>
            <button
              onClick={updateAllMetrics}
              disabled={loadingStocks || loadingLeadsData || loadingDays}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loadingStocks || loadingLeadsData || loadingDays) ? 'animate-spin' : ''}`} />
              Обновить метрики
            </button>
            <button
              onClick={updateEffectivityZones}
              disabled={loadingZones || metrics.length === 0}
              className="inline-flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
              title="Обновить зоны эффективности из API offers_collection"
            >
              <Target className={`h-4 w-4 mr-2 ${loadingZones ? 'animate-pulse' : ''}`} />
              Обновить зоны
            </button>
          </div>
        </div>
      </div>

      {/* Messages - только ошибки */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center shadow-sm">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Кнопка фильтров */}
          <button
            onClick={() => {
              setShowFilters(!showFilters);
              onToggleFilters?.(!showFilters);
            }}
            className={`p-2.5 rounded-lg border transition-all duration-200 ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Фильтры"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12L5 4" />
              <path d="M19 20L19 17" />
              <path d="M5 20L5 16" />
              <path d="M19 13L19 4" />
              <path d="M12 7L12 4" />
              <path d="M12 20L12 11" />
              <circle cx="5" cy="14" r="2" />
              <circle cx="12" cy="9" r="2" />
              <circle cx="19" cy="15" r="2" />
            </svg>
          </button>
          <div className="w-72 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors"
            />
          </div>

          {/* Тумблер расширенных колонок */}
          <button
            onClick={() => setShowExtendedColumns(!showExtendedColumns)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${
              showExtendedColumns
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Показать расширенные колонки по источникам"
          >
            {showExtendedColumns ? (
              <ToggleRight className="h-5 w-5" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">Байеры</span>
          </button>

          {/* Кнопка пресетов и панель пресетов */}
          <div className="flex items-center">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200 ${
                showPresets
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              Пресеты
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            {/* Панель пресетов с анимацией */}
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
              showPresets ? 'max-w-[600px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'
            }`}>
              {['Пресет 1', 'Пресет 2', 'Пресет 3', 'Пресет 4', 'Пресет 5'].map((preset, index) => (
                <div
                  key={index}
                  className="group relative flex items-center"
                >
                  <button
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap"
                  >
                    {preset}
                  </button>
                  {/* Иконки редактирования при наведении */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5 ml-1 pl-1">
                    <button
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Редактировать"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: редактирование пресета
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-colors"
                      title="Удалить"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: удаление пресета
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Cards with Sticky Header Row */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="h-16 w-16 text-slate-300 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Нет данных офферов
              </h3>
              <p className="text-slate-500 mb-4">
                Данные офферов будут загружены из метрик аналитика
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Sticky Header Row */}
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 overflow-hidden">
              <div className="flex items-center text-xs font-semibold text-slate-600 text-center">
                <div className="w-[3%] min-w-[32px]">№</div>
                <div className="w-[6%] min-w-[60px]">Артикул</div>
                <div className="w-[14%] min-w-[120px] text-left">Название</div>
                <div className="w-[8%] min-w-[80px]">Статус</div>
                <div className="w-[5%] min-w-[50px]">CPL</div>
                <div className="w-[4%] min-w-[40px]">Лиды</div>
                <div className="w-[4%] min-w-[36px]" title="Продажи на 1 заявку">
                  <Package className="h-3.5 w-3.5 mx-auto text-slate-500" />
                </div>
                <div className="w-[5%] min-w-[44px]" title="Рейтинг">
                  <Star className="h-3.5 w-3.5 mx-auto text-slate-500" />
                </div>

                {/* Расширенные колонки байеров - выезжают слева */}
                <div
                  className={`flex items-center transition-all duration-300 ease-in-out overflow-hidden ${
                    showExtendedColumns ? 'max-w-[800px] opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  <div className="min-w-[40px] px-1" title="Facebook CPL">
                    <FacebookIcon className="h-3.5 w-3.5 mx-auto" />
                  </div>
                  <div className="min-w-[40px] px-1" title="Google CPL">
                    <GoogleIcon className="h-3.5 w-3.5 mx-auto" />
                  </div>
                  <div className="min-w-[40px] px-1" title="TikTok CPL">
                    <TiktokIcon className="h-3.5 w-3.5 mx-auto" />
                  </div>
                  <div className="min-w-[44px] px-1" title="Новые Facebook">Нфб</div>
                  <div className="min-w-[40px] px-1" title="Новые Google">Нг</div>
                  <div className="min-w-[40px] px-1" title="Новые TikTok">Нтт</div>
                  <div className="min-w-[56px] px-1" title="Facebook всего">Фб всего</div>
                  <div className="min-w-[52px] px-1" title="Google всего">Г всего</div>
                  <div className="min-w-[56px] px-1" title="TikTok всего">ТТ всего</div>
                  <div className="min-w-[52px] px-1" title="Дней Н">Дней Н</div>
                  <div className="min-w-[80px] px-1" title="Активность за 30 дней">Актив. 30д</div>
                </div>

                <div className="w-[5%] min-w-[44px]" title="ROI зона эффективности">ROI</div>
                <div className="w-[6%] min-w-[56px]" title="Цена лида в зоне">CPL зона</div>
                <div className="w-[5%] min-w-[48px]" title="Прибыль">Прибыль</div>
                <div className="w-[5%] min-w-[48px]" title="Дней продаж">Дни</div>
                <div className="w-[5%] min-w-[48px]" title="Остаток">Ост.</div>
                <div className="w-[5%] min-w-[44px]" title="Дней до прихода">Приход</div>
                <div className="w-[5%] min-w-[44px]" title="% апрува">Апрув</div>
                <div className="w-[5%] min-w-[44px]" title="% выкупа">Выкуп</div>
                <div className="w-[5%] min-w-[44px]">Сезон</div>
                <div className="w-[6%] min-w-[50px]" title="Цена">Цена</div>
              </div>
            </div>

            {/* Виртуализированный список офферов */}
            <div
              ref={listContainerRef}
              className="flex-1 relative"
              style={{ opacity: (isPending || isStale) ? 0.7 : 1, transition: 'opacity 0.2s' }}
            >
              {/* Индикатор загрузки при фильтрации */}
              {(isPending || isStale) && (
                <div className="absolute top-2 right-4 z-10 flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
                  <MiniSpinner />
                  Фильтрация...
                </div>
              )}
              <List
                ref={listRef}
                height={listHeight}
                itemCount={deferredFilteredMetrics.length}
                itemSize={getItemSize}
                width="100%"
                itemData={itemData}
                overscanCount={3}
              >
                {VirtualizedRow}
              </List>
            </div>
          </>
        )}
      </div>

      {/* Изолированный менеджер tooltip'ов - не вызывает ре-рендер OffersTL */}
      <TooltipManager ref={tooltipManagerRef} />

      {/* Модальное окно миграции - lazy loaded */}
      {showMigrationModal && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center gap-3">
              <MiniSpinner />
              <span>Загрузка...</span>
            </div>
          </div>
        }>
          <MigrationModal
            isOpen={showMigrationModal}
            onClose={() => setShowMigrationModal(false)}
            onMigrationSuccess={handleMigrationSuccess}
            user={user}
            metrics={metrics}
            allBuyers={allBuyers}
          />
        </Suspense>
      )}
      </div>
    </div>
  );
}

export default OffersTL;
