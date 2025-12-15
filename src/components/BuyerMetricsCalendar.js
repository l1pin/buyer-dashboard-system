/**
 * Компонент календаря метрик байера
 * Горизонтальное представление со скроллом в виде карточек
 * Иерархия: buyer > campaign_name_tracker > campaign_name > adv_group_name > adv_name
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, ChevronLeft, Calendar } from 'lucide-react';
import { getAllBuyersMetricsCalendar, getTotalMetrics } from '../services/BuyerMetricsService';
import Portal from './Portal';

function BuyerMetricsCalendar({ allBuyers, selectedBuyerName, article, source, onClose, maxCPL = 3.5 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState(30); // Выбранный период в днях
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [periodIndexes, setPeriodIndexes] = useState({}); // Индексы выбранных периодов для каждого элемента
  const dropdownRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const savedScrollPosition = useRef({ top: 0, left: 0 });

  // Восстанавливаем скролл после изменения expandedItems (useLayoutEffect - синхронно до перерисовки)
  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && (savedScrollPosition.current.top !== 0 || savedScrollPosition.current.left !== 0)) {
      scrollContainer.scrollTop = savedScrollPosition.current.top;
      scrollContainer.scrollLeft = savedScrollPosition.current.left;
    }
  }, [expandedItems]);

  // Варианты периодов
  const periodOptions = [
    { value: 4, label: '4 дня' },
    { value: 7, label: '7 дней' },
    { value: 14, label: '14 дней' },
    { value: 30, label: '30 дней' },
    { value: 60, label: '60 дней' },
    { value: 90, label: '90 дней' },
    { value: 'lastActivity', label: 'Последняя активность' },
    { value: 'all', label: 'Все время' }
  ];

  useEffect(() => {
    loadData();
  }, [allBuyers, article, selectedBuyerName]);

  // Закрытие дропдауна при клике вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowPeriodDropdown(false);
      }
    };
    if (showPeriodDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPeriodDropdown]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getAllBuyersMetricsCalendar(allBuyers, article, selectedBuyerName);
      setData(result);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (key) => {
    // Сохраняем позицию скролла в ref ПЕРЕД изменением состояния
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      savedScrollPosition.current = {
        top: scrollContainer.scrollTop,
        left: scrollContainer.scrollLeft
      };
    }

    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    // Восстановление скролла происходит в useLayoutEffect
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2); // Последние 2 цифры года
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return { day, month, year, weekday };
  };

  const formatCurrency = (value) => {
    return `$${Number(value).toFixed(2)}`;
  };

  const formatCPL = (cpl, valid) => {
    if (!valid || valid === 0) return '—';
    return formatCurrency(cpl);
  };

  // Функция для определения цвета CPL на основе рейтинга
  const getCPLColor = (cpl) => {
    if (!cpl || cpl === 0) return 'text-gray-400';

    const percentage = (cpl / maxCPL) * 100;

    if (percentage <= 35) return 'text-green-600'; // A
    if (percentage <= 65) return 'text-yellow-600';  // B
    if (percentage <= 90) return 'text-orange-600'; // C
    return 'text-red-600'; // D
  };

  // Функция для определения фона карточки по CPL
  const getCPLCardBg = (cpl) => {
    if (!cpl || cpl === 0) return 'border-gray-200';

    const percentage = (cpl / maxCPL) * 100;

    if (percentage <= 35) return 'border-green-300 hover:border-green-400'; // A
    if (percentage <= 65) return 'border-yellow-300 hover:border-yellow-400';   // B
    if (percentage <= 90) return 'border-orange-300 hover:border-orange-400'; // C
    return 'border-red-300 hover:border-red-400'; // D
  };

  const totalMetrics = useMemo(() => {
    if (!data || !data.hierarchy) return null;
    return getTotalMetrics(data.hierarchy);
  }, [data]);

  // Сортируем даты слева направо (от старых к новым)
  const sortedDates = useMemo(() => {
    if (!data || !data.hierarchy) return [];
    return Object.keys(data.hierarchy).sort((a, b) => new Date(a) - new Date(b));
  }, [data]);

  // Создаём структуру дат с учётом пропусков (gap колонки между датами)
  const datesWithGaps = useMemo(() => {
    if (sortedDates.length === 0) return [];

    const result = [];
    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = sortedDates[i];

      // Если это не первая дата, проверяем есть ли пропуск
      if (i > 0) {
        const prevDate = sortedDates[i - 1];
        const prevDateObj = new Date(prevDate);
        const currentDateObj = new Date(currentDate);
        const daysDiff = Math.floor((currentDateObj - prevDateObj) / (1000 * 60 * 60 * 24));

        // Если пропуск больше 1 дня - добавляем gap колонку
        if (daysDiff > 1) {
          result.push({
            type: 'gap',
            gapDays: daysDiff - 1,
            fromDate: prevDate,
            toDate: currentDate
          });
        }
      }

      result.push({
        type: 'date',
        date: currentDate
      });
    }

    return result;
  }, [sortedDates]);

  // Получить данные ячейки для элемента
  const getCellDataForItem = (dayData, item) => {
    if (!dayData) return null;
    if (item.type === 'buyer' && dayData[item.name]) {
      return dayData[item.name];
    } else if (item.type === 'tracker' && dayData[item.buyerName]?.children[item.name]) {
      return dayData[item.buyerName].children[item.name];
    } else if (item.type === 'campaign' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.name]) {
      return dayData[item.buyerName].children[item.trackerName].children[item.name];
    } else if (item.type === 'group' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.campaignName]?.children[item.name]) {
      return dayData[item.buyerName].children[item.trackerName].children[item.campaignName].children[item.name];
    } else if (item.type === 'ad' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.campaignName]?.children[item.groupName]?.children[item.name]) {
      return dayData[item.buyerName].children[item.trackerName].children[item.campaignName].children[item.groupName].children[item.name];
    }
    return null;
  };

  // Найти последний НЕПРЕРЫВНЫЙ период активности (последовательные дни с расходом до перерыва)
  const getLastContinuousPeriodForItem = (item) => {
    if (!data || !data.hierarchy || sortedDates.length === 0) {
      return { startDate: null, endDate: null, days: 0, isActiveToday: false };
    }

    const today = new Date().toISOString().split('T')[0];

    // Идём с конца и ищем последний непрерывный период активности
    let endDate = null;
    let startDate = null;
    let days = 0;

    // Сначала находим последний активный день
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const date = sortedDates[i];
      const cellData = getCellDataForItem(data.hierarchy[date], item);
      if (cellData && (cellData.cost > 0 || cellData.valid > 0)) {
        endDate = date;
        startDate = date;
        days = 1;

        // Теперь идём назад и ищем начало непрерывного периода
        for (let j = i - 1; j >= 0; j--) {
          const prevDate = sortedDates[j];
          const prevCellData = getCellDataForItem(data.hierarchy[prevDate], item);

          // Проверяем что даты идут последовательно (разница 1 день)
          const currentDateObj = new Date(sortedDates[j + 1]);
          const prevDateObj = new Date(prevDate);
          const daysDiff = Math.floor((currentDateObj - prevDateObj) / (1000 * 60 * 60 * 24));

          // Если разница больше 1 дня или нет активности - прерываем
          if (daysDiff > 1 || !prevCellData || (prevCellData.cost === 0 && prevCellData.valid === 0)) {
            break;
          }

          startDate = prevDate;
          days++;
        }
        break;
      }
    }

    if (!startDate || !endDate) {
      return { startDate: null, endDate: null, days: 0, isActiveToday: false };
    }

    const isActiveToday = endDate === today;
    return { startDate, endDate, days, isActiveToday };
  };

  // Получить ВСЕ непрерывные периоды активности для элемента (от старых к новым)
  const getAllActivityPeriodsForItem = (item) => {
    if (!data || !data.hierarchy || sortedDates.length === 0) {
      return [];
    }

    const today = new Date().toISOString().split('T')[0];
    const periods = [];
    let currentPeriod = null;

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const cellData = getCellDataForItem(data.hierarchy[date], item);
      const hasActivity = cellData && (cellData.cost > 0 || cellData.valid > 0);

      if (hasActivity) {
        if (!currentPeriod) {
          // Начинаем новый период
          currentPeriod = { startDate: date, endDate: date, days: 1 };
        } else {
          // Проверяем последовательность
          const prevDateObj = new Date(currentPeriod.endDate);
          const currentDateObj = new Date(date);
          const daysDiff = Math.floor((currentDateObj - prevDateObj) / (1000 * 60 * 60 * 24));

          if (daysDiff === 1) {
            // Продолжаем текущий период
            currentPeriod.endDate = date;
            currentPeriod.days++;
          } else {
            // Разрыв - завершаем текущий период и начинаем новый
            currentPeriod.isActiveToday = currentPeriod.endDate === today;
            periods.push(currentPeriod);
            currentPeriod = { startDate: date, endDate: date, days: 1 };
          }
        }
      } else if (currentPeriod) {
        // День без активности - завершаем текущий период
        currentPeriod.isActiveToday = currentPeriod.endDate === today;
        periods.push(currentPeriod);
        currentPeriod = null;
      }
    }

    // Не забываем последний период
    if (currentPeriod) {
      currentPeriod.isActiveToday = currentPeriod.endDate === today;
      periods.push(currentPeriod);
    }

    return periods;
  };

  // Функция расчёта метрик для выбранного периода
  const getMetricsForItem = (item) => {
    if (!data || !data.hierarchy || sortedDates.length === 0) {
      return { cost: 0, valid: 0, cpl: 0, activeDays: 0, startDate: null, endDate: null, isActiveToday: false, totalPeriods: 0, currentPeriodIndex: 0 };
    }

    const today = new Date().toISOString().split('T')[0];
    let totalCost = 0;
    let totalValid = 0;
    let activeDays = 0;
    let startDate = null;
    let endDate = null;
    let isActiveToday = false;
    let totalPeriods = 0;
    let currentPeriodIndex = 0;

    if (selectedPeriod === 'all') {
      // Все время - суммируем все активные дни
      sortedDates.forEach(date => {
        const cellData = getCellDataForItem(data.hierarchy[date], item);
        if (cellData && (cellData.cost > 0 || cellData.valid > 0)) {
          totalCost += cellData.cost || 0;
          totalValid += cellData.valid || 0;
          activeDays++;
        }
      });
    } else if (selectedPeriod === 'lastActivity') {
      // Последняя активность - выбранный НЕПРЕРЫВНЫЙ период
      const allPeriods = getAllActivityPeriodsForItem(item);
      totalPeriods = allPeriods.length;

      if (allPeriods.length > 0) {
        // По умолчанию последний период (самый новый)
        currentPeriodIndex = periodIndexes[item.key] !== undefined
          ? periodIndexes[item.key]
          : allPeriods.length - 1;

        // Ограничиваем индекс
        currentPeriodIndex = Math.max(0, Math.min(currentPeriodIndex, allPeriods.length - 1));

        const activity = allPeriods[currentPeriodIndex];
        startDate = activity.startDate;
        endDate = activity.endDate;
        isActiveToday = activity.isActiveToday;

        // Суммируем метрики за выбранный период
        sortedDates.filter(d => d >= activity.startDate && d <= activity.endDate).forEach(date => {
          const cellData = getCellDataForItem(data.hierarchy[date], item);
          if (cellData && (cellData.cost > 0 || cellData.valid > 0)) {
            totalCost += cellData.cost || 0;
            totalValid += cellData.valid || 0;
            activeDays++;
          }
        });
      }
    } else {
      // Числовой период (4, 7, 14, 30, 60, 90) - ищем последние N АКТИВНЫХ дней
      // Идём с конца и собираем N дней с расходом (даже если с перерывами)
      const targetDays = selectedPeriod;
      const activeDatesList = [];

      for (let i = sortedDates.length - 1; i >= 0 && activeDatesList.length < targetDays; i--) {
        const date = sortedDates[i];
        const cellData = getCellDataForItem(data.hierarchy[date], item);
        if (cellData && (cellData.cost > 0 || cellData.valid > 0)) {
          activeDatesList.push({ date, cellData });
        }
      }

      // Суммируем метрики за найденные активные дни
      activeDatesList.forEach(({ date, cellData }) => {
        totalCost += cellData.cost || 0;
        totalValid += cellData.valid || 0;
        activeDays++;
      });
    }

    return {
      cost: totalCost,
      valid: totalValid,
      cpl: totalValid > 0 ? totalCost / totalValid : 0,
      activeDays,
      startDate,
      endDate,
      isActiveToday,
      totalPeriods,
      currentPeriodIndex
    };
  };

  // Расчёт метрик за последние 30 АКТИВНЫХ дней (дни с расходом) - общие
  const last30DaysMetrics = useMemo(() => {
    if (!data || !data.hierarchy || sortedDates.length === 0) {
      return { cost: 0, valid: 0, cpl: 0, activeDays: 0 };
    }

    // Берём последние 30 дат (они уже отсортированы от старых к новым)
    const last30Dates = sortedDates.slice(-30);

    let totalCost = 0;
    let totalValid = 0;

    last30Dates.forEach(date => {
      const dayData = data.hierarchy[date];
      if (dayData) {
        // Суммируем метрики по всем байерам за этот день
        Object.keys(dayData).forEach(buyer => {
          totalCost += dayData[buyer].cost || 0;
          totalValid += dayData[buyer].valid || 0;
        });
      }
    });

    return {
      cost: totalCost,
      valid: totalValid,
      cpl: totalValid > 0 ? totalCost / totalValid : 0,
      activeDays: last30Dates.length
    };
  }, [data, sortedDates]);

  // Создаём маппинг имени байера -> аватарка
  const buyerAvatarMap = useMemo(() => {
    const map = {};
    (allBuyers || []).forEach(b => {
      map[b.buyerName] = b.avatarUrl;
    });
    return map;
  }, [allBuyers]);

  // Создаём маппинг имени байера -> archived статус
  const buyerArchivedMap = useMemo(() => {
    const map = {};
    (allBuyers || []).forEach(b => {
      map[b.buyerName] = b.archived || false;
    });
    return map;
  }, [allBuyers]);

  // Построение плоской структуры иерархии для таблицы (с уровнем байера)
  const buildFlatHierarchy = () => {
    if (!data || !data.hierarchy) return [];

    const flatItems = [];
    const buyerOrder = data.buyerOrder || [];

    // Собираем все уникальные байеры и их иерархию из всех дней
    const allBuyersMap = new Map();
    sortedDates.forEach(date => {
      const dayData = data.hierarchy[date];
      Object.keys(dayData).forEach(buyer => {
        if (!allBuyersMap.has(buyer)) {
          allBuyersMap.set(buyer, {
            name: buyer,
            trackers: new Map()
          });
        }

        const buyerInfo = allBuyersMap.get(buyer);
        const buyerData = dayData[buyer];

        // Собираем трекеры этого байера
        Object.keys(buyerData.children || {}).forEach(tracker => {
          if (!buyerInfo.trackers.has(tracker)) {
            buyerInfo.trackers.set(tracker, {
              name: tracker,
              campaigns: new Map()
            });
          }

          const trackerInfo = buyerInfo.trackers.get(tracker);
          const trackerData = buyerData.children[tracker];

          // Собираем кампании этого трекера
          Object.keys(trackerData.children || {}).forEach(campaign => {
            if (!trackerInfo.campaigns.has(campaign)) {
              trackerInfo.campaigns.set(campaign, {
                name: campaign,
                groups: new Map()
              });
            }

            const campaignInfo = trackerInfo.campaigns.get(campaign);
            const campaignData = trackerData.children[campaign];

            // Собираем группы этой кампании
            Object.keys(campaignData.children || {}).forEach(group => {
              if (!campaignInfo.groups.has(group)) {
                campaignInfo.groups.set(group, {
                  name: group,
                  ads: new Set()
                });
              }

              const groupInfo = campaignInfo.groups.get(group);
              const groupData = campaignData.children[group];

              // Собираем объявления этой группы
              Object.keys(groupData.children || {}).forEach(ad => {
                groupInfo.ads.add(ad);
              });
            });
          });
        });
      });
    });

    // Сортируем байеров согласно buyerOrder (выбранный первый)
    const sortedBuyers = [...allBuyersMap.keys()].sort((a, b) => {
      const indexA = buyerOrder.indexOf(a);
      const indexB = buyerOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Разделяем на активных и архивированных
    const activeBuyers = sortedBuyers.filter(b => !buyerArchivedMap[b]);
    const archivedBuyers = sortedBuyers.filter(b => buyerArchivedMap[b]);

    // Функция для добавления байера и его детей в иерархию
    const addBuyerToHierarchy = (buyer, isArchived) => {
      const buyerInfo = allBuyersMap.get(buyer);
      const buyerKey = buyer;

      flatItems.push({
        key: buyerKey,
        level: 0,
        name: buyer,
        type: 'buyer',
        avatarUrl: buyerAvatarMap[buyer],
        archived: isArchived,
        hasChildren: buyerInfo.trackers.size > 0
      });

      if (expandedItems[buyerKey]) {
        buyerInfo.trackers.forEach((trackerInfo, tracker) => {
          const trackerKey = `${buyer}-${tracker}`;

          flatItems.push({
            key: trackerKey,
            level: 1,
            name: tracker,
            type: 'tracker',
            parentKey: buyerKey,
            buyerName: buyer,
            hasChildren: trackerInfo.campaigns.size > 0
          });

          if (expandedItems[trackerKey]) {
            trackerInfo.campaigns.forEach((campaignInfo, campaign) => {
              const campaignKey = `${buyer}-${tracker}-${campaign}`;

              flatItems.push({
                key: campaignKey,
                level: 2,
                name: campaign,
                type: 'campaign',
                parentKey: trackerKey,
                buyerName: buyer,
                trackerName: tracker,
                hasChildren: campaignInfo.groups.size > 0
              });

              if (expandedItems[campaignKey]) {
                campaignInfo.groups.forEach((groupInfo, group) => {
                  const groupKey = `${buyer}-${tracker}-${campaign}-${group}`;

                  flatItems.push({
                    key: groupKey,
                    level: 3,
                    name: group,
                    type: 'group',
                    parentKey: campaignKey,
                    buyerName: buyer,
                    trackerName: tracker,
                    campaignName: campaign,
                    hasChildren: groupInfo.ads.size > 0
                  });

                  if (expandedItems[groupKey]) {
                    groupInfo.ads.forEach(ad => {
                      const adKey = `${buyer}-${tracker}-${campaign}-${group}-${ad}`;

                      flatItems.push({
                        key: adKey,
                        level: 4,
                        name: ad,
                        type: 'ad',
                        parentKey: groupKey,
                        buyerName: buyer,
                        trackerName: tracker,
                        campaignName: campaign,
                        groupName: group,
                        hasChildren: false
                      });
                    });
                  }
                });
              }
            });
          }
        });
      }
    };

    // Добавляем активных байеров
    activeBuyers.forEach(buyer => addBuyerToHierarchy(buyer, false));

    // Добавляем разделитель если есть архивированные
    if (archivedBuyers.length > 0) {
      flatItems.push({
        key: '__archived_separator__',
        type: 'separator',
        name: `Архивированные байеры (${archivedBuyers.length})`
      });

      // Добавляем архивированных байеров
      archivedBuyers.forEach(buyer => addBuyerToHierarchy(buyer, true));
    }

    return flatItems;
  };

  const flatHierarchy = buildFlatHierarchy();

  if (loading) {
    return (
      <Portal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600">Загрузка данных...</p>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  if (error) {
    return (
      <Portal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-red-600">Ошибка</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-700">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  if (!data || sortedDates.length === 0) {
    return (
      <Portal>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Календарь метрик</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Нет данных за выбранный период</p>
              <button
                onClick={onClose}
                className="mt-6 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-b from-slate-50 to-white rounded-2xl shadow-2xl w-full h-[90vh] flex flex-col border border-slate-200" style={{ maxWidth: '95vw' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex-shrink-0 bg-white rounded-t-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Календарь метрик</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all hover:scale-105"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Артикул:</span>
              <span className="font-semibold text-slate-800">{article}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Источник:</span>
              <span className="font-semibold text-slate-800">{source}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg">
              <span className="text-slate-500">Байеров:</span>
              <span className="font-semibold text-slate-800">{data?.buyerOrder?.length || 0}</span>
            </div>
            {data?.period && (
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-blue-700">
                  {formatDate(data.period.start).day}.{formatDate(data.period.start).month} — {formatDate(data.period.end).day}.{formatDate(data.period.end).month}.{formatDate(data.period.end).year}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="h-full overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: 'fit-content' }}>
              <thead>
                <tr>
                  {/* Sticky: Иерархия */}
                  <th
                    className="sticky left-0 z-30 bg-slate-100 border-b-2 border-slate-300 px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
                    style={{ minWidth: '300px', boxShadow: '2px 0 8px -2px rgba(0,0,0,0.1)' }}
                  >
                    Иерархия
                  </th>
                  {/* Итого за период - НЕ sticky */}
                  <th
                    className="bg-slate-800 border-b-2 border-slate-700 px-3 py-3 text-center"
                    style={{ minWidth: '160px' }}
                  >
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                        className="flex flex-col gap-1 items-center w-full hover:bg-slate-700 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <span className="text-slate-400 text-[10px] uppercase tracking-wider">итого</span>
                        <span className="text-white text-sm font-bold flex items-center gap-1.5">
                          {periodOptions.find(p => p.value === selectedPeriod)?.label || '30 дней'}
                          <ChevronDown className="w-4 h-4" />
                        </span>
                      </button>
                      {showPeriodDropdown && (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-2 min-w-[160px]">
                          {periodOptions.map(option => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSelectedPeriod(option.value);
                                setShowPeriodDropdown(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors ${
                                selectedPeriod === option.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                  {datesWithGaps.map((item, idx) => {
                    if (item.type === 'gap') {
                      return (
                        <th key={`gap-${idx}`} className="bg-amber-50 border-b-2 border-amber-200 px-2 py-3 text-center" style={{ minWidth: '80px' }}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-amber-500 text-[10px] font-medium">ПАУЗА</span>
                            <span className="text-amber-600 text-xs font-bold">{item.gapDays} д.</span>
                          </div>
                        </th>
                      );
                    }
                    const { day, month, year, weekday } = formatDate(item.date);
                    return (
                      <th key={item.date} className="bg-slate-50 border-b-2 border-slate-200 px-2 py-3 text-center" style={{ minWidth: '150px' }}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 text-[10px] uppercase font-medium">{weekday}</span>
                          <span className="text-slate-700 text-sm font-bold">{day}.{month}.{year}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {flatHierarchy.map((item, index) => {
                  // Разделитель для архивированных - красивый дизайн
                  if (item.type === 'separator') {
                    // Извлекаем число из item.name (например "Архивированные байеры (3)")
                    const countMatch = item.name.match(/\((\d+)\)/);
                    const count = countMatch ? countMatch[1] : '';

                    return (
                      <tr key={item.key}>
                        <td
                          colSpan={2 + datesWithGaps.length}
                          className="bg-slate-100 border-y border-slate-200 p-0 relative h-14"
                        >
                          {/* Плашка по центру видимой области */}
                          <div
                            className="sticky left-1/2 -translate-x-1/2 inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full shadow border border-slate-200"
                            style={{ marginLeft: 'calc(50vw - 47.5vw)' }}
                          >
                            <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </div>
                            <span className="text-sm font-semibold text-slate-600">Неактивные аккаунты{count ? ` (${count})` : ''}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const hasChildren = item.hasChildren;
                  const isExpanded = expandedItems[item.key];
                  const baseIndent = 16;
                  const levelIndent = item.level * 24;
                  const paddingLeft = baseIndent + levelIndent;
                  const isArchived = item.archived;

                  // Цвета для линий по уровням
                  const levelColors = {
                    0: '#ef4444', // red - байер
                    1: '#3b82f6', // blue - трекер
                    2: '#10b981', // green - кампания
                    3: '#f59e0b', // yellow - группа
                    4: '#a855f7'  // purple - объявление
                  };

                  // Рассчитываем метрики для выбранного периода
                  const itemMetrics = getMetricsForItem(item);

                  return (
                    <tr key={item.key} className="hover:bg-slate-50/50 border-b border-slate-100 transition-colors">
                      {/* Колонка иерархии - STICKY */}
                      <td
                        className="sticky left-0 z-20 bg-white px-4 py-2.5"
                        style={{ minWidth: '300px', boxShadow: '2px 0 8px -2px rgba(0,0,0,0.08)' }}
                      >
                        <div className="flex items-center gap-2 relative" style={{ paddingLeft: `${paddingLeft}px` }}>
                          {/* Визуальные линии иерархии */}
                          {item.level > 0 && (
                            <>
                              <div
                                className="absolute rounded-full"
                                style={{
                                  left: `${baseIndent + (item.level - 1) * 24 + 11}px`,
                                  top: 0,
                                  width: '2px',
                                  height: '50%',
                                  backgroundColor: levelColors[item.level - 1],
                                  opacity: 0.6
                                }}
                              />
                              <div
                                className="absolute rounded-full"
                                style={{
                                  left: `${baseIndent + (item.level - 1) * 24 + 11}px`,
                                  top: '50%',
                                  width: '14px',
                                  height: '2px',
                                  backgroundColor: levelColors[item.level - 1],
                                  opacity: 0.6
                                }}
                              />
                              <div
                                className="absolute rounded-full"
                                style={{
                                  left: `${baseIndent + (item.level - 1) * 24 + 9}px`,
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  width: '6px',
                                  height: '6px',
                                  backgroundColor: levelColors[item.level - 1],
                                  opacity: 0.8
                                }}
                              />
                            </>
                          )}

                          {hasChildren && (
                            <button
                              onClick={() => toggleItem(item.key)}
                              className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 flex-shrink-0 relative z-10 transition-all shadow-sm"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </button>
                          )}
                          {!hasChildren && <div className="w-6" />}

                          {/* Аватарка для байера */}
                          {item.type === 'buyer' && (
                            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 ring-2 ring-white shadow">
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm font-semibold">
                                  {item.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                              {item.type === 'buyer' && 'Байер'}
                              {item.type === 'tracker' && 'Трекер'}
                              {item.type === 'campaign' && 'Кампания'}
                              {item.type === 'group' && 'Группа'}
                              {item.type === 'ad' && 'Объявление'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Колонка периода - тёмная карточка */}
                      <td
                        className="px-2 py-2 bg-white"
                        style={{ minWidth: '160px' }}
                      >
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-2.5 shadow-lg">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-[10px]">Лиды</span>
                              <span className="font-bold text-white text-base">{itemMetrics.valid}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-[10px]">CPL</span>
                              <span className="font-bold text-base text-white">
                                {itemMetrics.valid > 0 ? formatCurrency(itemMetrics.cpl) : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400 text-[10px]">Расход</span>
                              <span className="font-bold text-white text-sm">{formatCurrency(itemMetrics.cost)}</span>
                            </div>
                            {/* Период активности для режима lastActivity */}
                            {selectedPeriod === 'lastActivity' && itemMetrics.startDate && (
                              <>
                                <div className="border-t border-slate-600 pt-2 mt-1">
                                  <div className="text-[10px] text-slate-300 text-center font-medium">
                                    {formatDate(itemMetrics.startDate).day}.{formatDate(itemMetrics.startDate).month} — {formatDate(itemMetrics.endDate).day}.{formatDate(itemMetrics.endDate).month} • {itemMetrics.activeDays} д.
                                  </div>
                                </div>
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full ${itemMetrics.isActiveToday ? 'bg-green-400 shadow-green-400/50 shadow-sm' : 'bg-red-400'}`}></span>
                                  <span className="text-[10px] text-slate-300 font-medium">{itemMetrics.isActiveToday ? 'Активен' : 'Неактивен'}</span>
                                </div>
                                {/* Навигация между периодами */}
                                {itemMetrics.totalPeriods > 1 && (
                                  <div className="flex items-center justify-center gap-2 mt-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (itemMetrics.currentPeriodIndex > 0) {
                                          setPeriodIndexes(prev => ({ ...prev, [item.key]: itemMetrics.currentPeriodIndex - 1 }));
                                        }
                                      }}
                                      disabled={itemMetrics.currentPeriodIndex === 0}
                                      className="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-30"
                                    >
                                      <ChevronLeft className="w-3 h-3 text-white" />
                                    </button>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {itemMetrics.currentPeriodIndex + 1} / {itemMetrics.totalPeriods}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (itemMetrics.currentPeriodIndex < itemMetrics.totalPeriods - 1) {
                                          setPeriodIndexes(prev => ({ ...prev, [item.key]: itemMetrics.currentPeriodIndex + 1 }));
                                        }
                                      }}
                                      disabled={itemMetrics.currentPeriodIndex >= itemMetrics.totalPeriods - 1}
                                      className="p-1 hover:bg-slate-700 rounded transition-colors disabled:opacity-30"
                                    >
                                      <ChevronRight className="w-3 h-3 text-white" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      {datesWithGaps.map((dateItem, idx) => {
                        // Gap колонка - пауза
                        if (dateItem.type === 'gap') {
                          return (
                            <td key={`gap-${idx}`} className="px-2 py-2 bg-amber-50/50" style={{ minWidth: '80px' }}>
                              <div className="h-full flex flex-col items-center justify-center gap-0.5">
                                <span className="text-amber-400 text-[10px] font-medium">ПАУЗА</span>
                                <span className="text-amber-500 text-sm font-bold">{dateItem.gapDays} д.</span>
                              </div>
                            </td>
                          );
                        }

                        const date = dateItem.date;
                        const dayData = data.hierarchy[date];
                        let cellData = null;

                        if (dayData) {
                          if (item.type === 'buyer' && dayData[item.name]) {
                            cellData = dayData[item.name];
                          } else if (item.type === 'tracker' && dayData[item.buyerName]?.children[item.name]) {
                            cellData = dayData[item.buyerName].children[item.name];
                          } else if (item.type === 'campaign' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.name]) {
                            cellData = dayData[item.buyerName].children[item.trackerName].children[item.name];
                          } else if (item.type === 'group' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.campaignName]?.children[item.name]) {
                            cellData = dayData[item.buyerName].children[item.trackerName].children[item.campaignName].children[item.name];
                          } else if (item.type === 'ad' && dayData[item.buyerName]?.children[item.trackerName]?.children[item.campaignName]?.children[item.groupName]?.children[item.name]) {
                            cellData = dayData[item.buyerName].children[item.trackerName].children[item.campaignName].children[item.groupName].children[item.name];
                          }
                        }

                        const hasCost = cellData && (cellData.cost > 0 || cellData.valid > 0);

                        return (
                          <td key={date} className="px-1.5 py-1.5" style={{ minWidth: '130px' }}>
                            {hasCost ? (
                              <div className={`bg-white border-2 rounded-lg p-2 hover:shadow-lg transition-all duration-200 ${getCPLCardBg(cellData.cpl)}`}>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[10px] font-medium">Лиды</span>
                                    <span className="font-bold text-slate-800 text-sm">{cellData.valid}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[10px] font-medium">CPL</span>
                                    <span className={`font-bold text-sm ${getCPLColor(cellData.cpl)}`}>
                                      {formatCPL(cellData.cpl, cellData.valid)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[10px] font-medium">Расход</span>
                                    <span className="font-semibold text-slate-700 text-xs">{formatCurrency(cellData.cost)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-50/50 border border-slate-200 border-dashed rounded-lg p-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-300 text-[10px]">Лиды</span>
                                    <span className="font-medium text-slate-300 text-sm">—</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-300 text-[10px]">CPL</span>
                                    <span className="font-medium text-slate-300 text-sm">—</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-300 text-[10px]">Расход</span>
                                    <span className="font-medium text-slate-300 text-xs">—</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      </div>
    </Portal>
  );
}

export default BuyerMetricsCalendar;
