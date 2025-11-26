/**
 * Компонент календаря метрик байера
 * Горизонтальное представление со скроллом в виде карточек
 * Иерархия: campaign_name_tracker > campaign_name > adv_group_name > adv_name
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { getBuyerMetricsCalendar, getTotalMetrics } from '../services/BuyerMetricsService';

function BuyerMetricsCalendar({ sourceIds, article, buyerName, source, onClose }) {
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

  const totalMetrics = useMemo(() => {
    if (!data || !data.hierarchy) return null;
    return getTotalMetrics(data.hierarchy);
  }, [data]);

  // Сортируем даты в обратном порядке (от новых к старым)
  const sortedDates = useMemo(() => {
    if (!data || !data.hierarchy) return [];
    return Object.keys(data.hierarchy).sort((a, b) => new Date(b) - new Date(a));
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600">Загрузка данных...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
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
    );
  }

  if (!data || sortedDates.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
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
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full h-[90vh] flex flex-col" style={{ maxWidth: '95vw' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-gray-900">Календарь метрик</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="font-medium">Байер: <span className="text-blue-600">{buyerName}</span></span>
            <span>•</span>
            <span className="font-medium">Артикул: <span className="text-blue-600">{article}</span></span>
            <span>•</span>
            <span className="font-medium">Источник: <span className="text-blue-600">{source}</span></span>
            {data?.period && (
              <>
                <span>•</span>
                <span className="font-medium">
                  {formatDate(data.period.start).day}.{formatDate(data.period.start).month} - {formatDate(data.period.end).day}.{formatDate(data.period.end).month}
                </span>
              </>
            )}
          </div>

          {/* Summary */}
          {totalMetrics && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Общий расход</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalMetrics.cost)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Всего лидов</div>
                <div className="text-lg font-bold text-gray-900">{totalMetrics.valid}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">Средний CPL</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(totalMetrics.cpl)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full border-collapse" style={{ minWidth: 'fit-content' }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider shadow-md" style={{ minWidth: '280px' }}>
                    Иерархия
                  </th>
                  {sortedDates.map(date => {
                    const { day, month, weekday } = formatDate(date);
                    return (
                      <th key={date} className="bg-gray-50 border-b-2 border-gray-200 px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase" style={{ minWidth: '100px' }}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-500 text-[10px]">{weekday}</span>
                          <span className="text-gray-900 text-sm font-bold">{day}.{month}</span>
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
                  const paddingLeft = 16 + (item.level - 1) * 20;

                  // Цвета для разных уровней
                  const levelColors = {
                    1: 'bg-blue-50 border-blue-200',
                    2: 'bg-green-50 border-green-200',
                    3: 'bg-yellow-50 border-yellow-200',
                    4: 'bg-purple-50 border-purple-200'
                  };

                  return (
                    <tr key={item.key} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-gray-200 shadow-sm" style={{ minWidth: '280px' }}>
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${paddingLeft}px` }}>
                          {hasChildren && (
                            <button
                              onClick={() => toggleItem(item.key)}
                              className="w-5 h-5 flex items-center justify-center rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 flex-shrink-0"
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
                          <td key={date} className="px-2 py-2 text-center" style={{ minWidth: '100px' }}>
                            {hasCost ? (
                              <div className={`rounded-lg p-2 border ${levelColors[item.level]}`}>
                                <div className="text-xs font-semibold text-gray-900">{formatCurrency(cellData.cost)}</div>
                                <div className="text-xs text-gray-600 mt-0.5">{cellData.valid} лидов</div>
                                <div className="text-xs font-bold text-blue-600 mt-0.5">{formatCurrency(cellData.cpl)}</div>
                              </div>
                            ) : (
                              <div className="text-gray-300 text-xs">—</div>
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Всего дней: </span>
              <span className="text-gray-900">{sortedDates.length}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuyerMetricsCalendar;
