/**
 * Компонент календаря метрик байера
 * Горизонтальное представление со скроллом в виде карточек
 * Иерархия: campaign_name_tracker > campaign_name > adv_group_name > adv_name
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { getBuyerMetricsCalendar, getTotalMetrics } from '../services/BuyerMetricsService';
import Portal from './Portal';

function BuyerMetricsCalendar({ sourceIds, article, buyerName, source, onClose, maxCPL = 3.5 }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

  useEffect(() => {
    loadData();
  }, [sourceIds, article]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getBuyerMetricsCalendar(sourceIds, article);
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

  // Построение плоской структуры иерархии для таблицы
  const buildFlatHierarchy = () => {
    if (!data || !data.hierarchy) return [];

    const flatItems = [];

    // Собираем все уникальные трекеры из всех дней
    const allTrackers = new Map();
    sortedDates.forEach(date => {
      const dayData = data.hierarchy[date];
      Object.keys(dayData).forEach(tracker => {
        if (!allTrackers.has(tracker)) {
          allTrackers.set(tracker, {
            name: tracker,
            campaigns: new Map()
          });
        }

        const trackerInfo = allTrackers.get(tracker);
        const trackerData = dayData[tracker];

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

    // Строим плоскую иерархию
    allTrackers.forEach((trackerInfo, tracker) => {
      const trackerKey = tracker;

      flatItems.push({
        key: trackerKey,
        level: 1,
        name: tracker,
        type: 'tracker',
        hasChildren: trackerInfo.campaigns.size > 0
      });

      if (expandedItems[trackerKey]) {
        trackerInfo.campaigns.forEach((campaignInfo, campaign) => {
          const campaignKey = `${tracker}-${campaign}`;

          flatItems.push({
            key: campaignKey,
            level: 2,
            name: campaign,
            type: 'campaign',
            parentKey: trackerKey,
            trackerName: tracker,
            hasChildren: campaignInfo.groups.size > 0
          });

          if (expandedItems[campaignKey]) {
            campaignInfo.groups.forEach((groupInfo, group) => {
              const groupKey = `${tracker}-${campaign}-${group}`;

              flatItems.push({
                key: groupKey,
                level: 3,
                name: group,
                type: 'group',
                parentKey: campaignKey,
                trackerName: tracker,
                campaignName: campaign,
                hasChildren: groupInfo.ads.size > 0
              });

              if (expandedItems[groupKey]) {
                groupInfo.ads.forEach(ad => {
                  const adKey = `${tracker}-${campaign}-${group}-${ad}`;

                  flatItems.push({
                    key: adKey,
                    level: 4,
                    name: ad,
                    type: 'ad',
                    parentKey: groupKey,
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
            <span><span className="font-medium text-gray-700">Байер:</span> {buyerName}</span>
            <span>•</span>
            <span><span className="font-medium text-gray-700">Артикул:</span> {article}</span>
            <span>•</span>
            <span><span className="font-medium text-gray-700">Источник:</span> {source}</span>
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
                  {sortedDates.map(date => {
                    const { day, month, weekday } = formatDate(date);
                    return (
                      <th key={date} className="bg-gray-50 border-b-2 border-gray-200 px-2 py-3 text-center" style={{ minWidth: '140px' }}>
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
                  const levelIndent = (item.level - 1) * 24;
                  const paddingLeft = baseIndent + levelIndent;

                  // Цвета для линий по уровням
                  const levelColors = {
                    1: '#3b82f6', // blue
                    2: '#10b981', // green
                    3: '#f59e0b', // yellow
                    4: '#a855f7'  // purple
                  };

                  return (
                    <tr key={item.key} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-gray-200" style={{ minWidth: '280px' }}>
                        <div className="flex items-center gap-2 relative" style={{ paddingLeft: `${paddingLeft}px` }}>
                          {/* Визуальные линии иерархии */}
                          {item.level > 1 && (
                            <>
                              {/* Горизонтальная линия к родителю */}
                              <div
                                className="absolute"
                                style={{
                                  left: `${baseIndent + (item.level - 2) * 24 + 12}px`,
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
                                  left: `${baseIndent + (item.level - 2) * 24 + 12}px`,
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
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.type === 'tracker' && 'Трекер'}
                              {item.type === 'campaign' && 'Кампания'}
                              {item.type === 'group' && 'Группа'}
                              {item.type === 'ad' && 'Объявление'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {sortedDates.map(date => {
                        const dayData = data.hierarchy[date];
                        let cellData = null;

                        // Ищем данные для этого элемента в конкретную дату
                        if (dayData) {
                          if (item.type === 'tracker' && dayData[item.name]) {
                            cellData = dayData[item.name];
                          } else if (item.type === 'campaign' && dayData[item.trackerName]?.children[item.name]) {
                            cellData = dayData[item.trackerName].children[item.name];
                          } else if (item.type === 'group' && dayData[item.trackerName]?.children[item.campaignName]?.children[item.name]) {
                            cellData = dayData[item.trackerName].children[item.campaignName].children[item.name];
                          } else if (item.type === 'ad' && dayData[item.trackerName]?.children[item.campaignName]?.children[item.groupName]?.children[item.name]) {
                            cellData = dayData[item.trackerName].children[item.campaignName].children[item.groupName].children[item.name];
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
