/**
 * Компонент календаря метрик байера
 * Горизонтальное представление со скроллом в виде карточек
 * Иерархия: buyer > campaign_name_tracker > campaign_name > adv_group_name > adv_name
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { getAllBuyersMetricsCalendar, getTotalMetrics } from '../services/BuyerMetricsService';
import Portal from './Portal';

function BuyerMetricsCalendar({ allBuyers, selectedBuyerName, article, source, onClose, maxCPL = 3.5 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState(30); // Выбранный период в днях
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const dropdownRef = useRef(null);

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
    setExpandedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return { day, month, weekday };
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
    if (percentage <= 65) return 'text-blue-600';  // B
    if (percentage <= 90) return 'text-yellow-600'; // C
    return 'text-red-600'; // D
  };

  // Функция для определения фона карточки по CPL
  const getCPLCardBg = (cpl) => {
    if (!cpl || cpl === 0) return 'border-gray-200';

    const percentage = (cpl / maxCPL) * 100;

    if (percentage <= 35) return 'border-green-300 hover:border-green-400'; // A
    if (percentage <= 65) return 'border-blue-300 hover:border-blue-400';   // B
    if (percentage <= 90) return 'border-yellow-300 hover:border-yellow-400'; // C
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

  // Функция расчёта метрик для выбранного периода
  const getMetricsForItem = (item) => {
    if (!data || !data.hierarchy || sortedDates.length === 0) {
      return { cost: 0, valid: 0, cpl: 0, activeDays: 0, startDate: null, endDate: null, isActiveToday: false };
    }

    const today = new Date().toISOString().split('T')[0];
    let totalCost = 0;
    let totalValid = 0;
    let activeDays = 0;
    let startDate = null;
    let endDate = null;
    let isActiveToday = false;

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
      // Последняя активность - последний НЕПРЕРЫВНЫЙ период
      const activity = getLastContinuousPeriodForItem(item);
      if (activity.startDate && activity.endDate) {
        startDate = activity.startDate;
        endDate = activity.endDate;
        isActiveToday = activity.isActiveToday;

        // Суммируем метрики за непрерывный период
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
      isActiveToday
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

    // Строим плоскую иерархию с уровнем 0 - байер
    sortedBuyers.forEach(buyer => {
      const buyerInfo = allBuyersMap.get(buyer);
      const buyerKey = buyer;

      flatItems.push({
        key: buyerKey,
        level: 0,
        name: buyer,
        type: 'buyer',
        avatarUrl: buyerAvatarMap[buyer],
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
    });

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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full h-[90vh] flex flex-col" style={{ maxWidth: '95vw' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Календарь метрик</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span><span className="font-medium text-gray-700">Артикул:</span> {article}</span>
            <span>•</span>
            <span><span className="font-medium text-gray-700">Источник:</span> {source}</span>
            <span>•</span>
            <span><span className="font-medium text-gray-700">Байеров:</span> {data?.buyerOrder?.length || 0}</span>
            {data?.period && (
              <>
                <span>•</span>
                <span>
                  {formatDate(data.period.start).day}.{formatDate(data.period.start).month} - {formatDate(data.period.end).day}.{formatDate(data.period.end).month}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: 'fit-content' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 border-b-2 border-r border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-700" style={{ minWidth: '280px' }}>
                    Иерархия
                  </th>
                  <th className="sticky z-20 bg-gray-50 border-b-2 border-gray-200 px-2 py-3 text-center" style={{ minWidth: '140px', left: '280px' }}>
                    <div className="relative" ref={dropdownRef}>
                      <button
                        onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                        className="flex flex-col gap-0.5 items-center w-full hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                      >
                        <span className="text-gray-500 text-[10px] uppercase">итого</span>
                        <span className="text-gray-900 text-xs font-semibold flex items-center gap-1">
                          {periodOptions.find(p => p.value === selectedPeriod)?.label || '30 дней'}
                          <ChevronDown className="w-3 h-3" />
                        </span>
                      </button>
                      {showPeriodDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                          {periodOptions.map(option => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSelectedPeriod(option.value);
                                setShowPeriodDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-100 ${
                                selectedPeriod === option.value ? 'bg-gray-100 font-semibold' : ''
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
                        <th key={`gap-${idx}`} className="bg-gray-200 border-b-2 border-gray-300 px-2 py-3 text-center" style={{ minWidth: '80px' }}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-gray-500 text-[10px]">пропуск</span>
                            <span className="text-gray-600 text-xs font-semibold">{item.gapDays} д.</span>
                          </div>
                        </th>
                      );
                    }
                    const { day, month, weekday } = formatDate(item.date);
                    return (
                      <th key={item.date} className="bg-gray-50 border-b-2 border-gray-200 px-2 py-3 text-center" style={{ minWidth: '140px' }}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-500 text-[10px] uppercase">{weekday}</span>
                          <span className="text-gray-900 text-xs font-semibold">{day}.{month}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {flatHierarchy.map((item, index) => {
                  const hasChildren = item.hasChildren;
                  const isExpanded = expandedItems[item.key];
                  const baseIndent = 16;
                  const levelIndent = item.level * 24;
                  const paddingLeft = baseIndent + levelIndent;

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
                    <tr key={item.key} className="hover:bg-gray-50 border-b border-gray-100">
                      {/* Колонка иерархии */}
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-gray-200" style={{ minWidth: '280px' }}>
                        <div className="flex items-center gap-2 relative" style={{ paddingLeft: `${paddingLeft}px` }}>
                          {/* Визуальные линии иерархии */}
                          {item.level > 0 && (
                            <>
                              {/* Горизонтальная линия к родителю */}
                              <div
                                className="absolute"
                                style={{
                                  left: `${baseIndent + (item.level - 1) * 24 + 12}px`,
                                  top: '50%',
                                  width: '16px',
                                  height: '1px',
                                  backgroundColor: levelColors[item.level - 1],
                                  opacity: 0.4
                                }}
                              />
                              {/* Вертикальная линия от родителя */}
                              <div
                                className="absolute"
                                style={{
                                  left: `${baseIndent + (item.level - 1) * 24 + 12}px`,
                                  top: '-50%',
                                  width: '1px',
                                  height: '50%',
                                  backgroundColor: levelColors[item.level - 1],
                                  opacity: 0.4
                                }}
                              />
                            </>
                          )}

                          {hasChildren && (
                            <button
                              onClick={() => toggleItem(item.key)}
                              className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 flex-shrink-0 relative z-10"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3 text-gray-600" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-600" />
                              )}
                            </button>
                          )}
                          {!hasChildren && <div className="w-5" />}

                          {/* Аватарка для байера */}
                          {item.type === 'buyer' && (
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-medium">
                                  {item.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.type === 'buyer' && 'Байер'}
                              {item.type === 'tracker' && 'Трекер'}
                              {item.type === 'campaign' && 'Кампания'}
                              {item.type === 'group' && 'Группа'}
                              {item.type === 'ad' && 'Объявление'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Колонка периода - тёмная карточка (sticky) */}
                      <td className="sticky z-10 px-2 py-2 bg-white" style={{ minWidth: '140px', left: '280px' }}>
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-2">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-400">Лиды</span>
                              <span className="font-semibold text-white">{itemMetrics.valid}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-400">CPL</span>
                              <span className={`font-semibold ${itemMetrics.cpl > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                                {itemMetrics.valid > 0 ? formatCurrency(itemMetrics.cpl) : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-gray-400">Расх</span>
                              <span className="font-semibold text-white">{formatCurrency(itemMetrics.cost)}</span>
                            </div>
                            {/* Показать период активности и индикатор для режима lastActivity */}
                            {selectedPeriod === 'lastActivity' && itemMetrics.startDate && (
                              <>
                                <div className="border-t border-gray-600 pt-1 mt-1">
                                  <div className="text-[9px] text-gray-400 text-center">
                                    {formatDate(itemMetrics.startDate).day}.{formatDate(itemMetrics.startDate).month} - {formatDate(itemMetrics.endDate).day}.{formatDate(itemMetrics.endDate).month} • {itemMetrics.activeDays} д.
                                  </div>
                                </div>
                                <div className="flex items-center justify-center gap-1 text-[9px]">
                                  <span className={`w-2 h-2 rounded-full ${itemMetrics.isActiveToday ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                  <span className="text-gray-400">{itemMetrics.isActiveToday ? 'Активен' : 'Неактивен'}</span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      {datesWithGaps.map((dateItem, idx) => {
                        // Gap колонка - показываем затемнённую ячейку
                        if (dateItem.type === 'gap') {
                          return (
                            <td key={`gap-${idx}`} className="px-2 py-2 bg-gray-200" style={{ minWidth: '80px' }}>
                              <div className="h-full flex items-center justify-center">
                                <span className="text-gray-500 text-[10px] text-center">{dateItem.gapDays} д.</span>
                              </div>
                            </td>
                          );
                        }

                        const date = dateItem.date;
                        const dayData = data.hierarchy[date];
                        let cellData = null;

                        // Ищем данные для этого элемента в конкретную дату
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
                          <td key={date} className="px-2 py-2" style={{ minWidth: '140px' }}>
                            {hasCost ? (
                              <div className={`bg-white border rounded-lg p-2 hover:shadow-md transition-all ${getCPLCardBg(cellData.cpl)}`}>
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Лиды</span>
                                    <span className="font-semibold text-gray-900">{cellData.valid}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">CPL</span>
                                    <span className="font-semibold text-gray-900">{formatCPL(cellData.cpl, cellData.valid)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500">Расх</span>
                                    <span className="font-semibold text-gray-900">{formatCurrency(cellData.cost)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                                <div className="space-y-1">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-400">Лиды</span>
                                    <span className="font-medium text-gray-400">—</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-400">CPL</span>
                                    <span className="font-medium text-gray-400">—</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-400">Расх</span>
                                    <span className="font-medium text-gray-400">—</span>
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Закрыть
          </button>
        </div>
      </div>
      </div>
    </Portal>
  );
}

export default BuyerMetricsCalendar;
