/**
 * Компонент календаря метрик байера
 * Отображает детальную статистику по дням с иерархией:
 * 1. campaign_name_tracker
 * 2. campaign_name
 * 3. adv_group_name
 * 4. adv_name
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, ChevronDown, ChevronRight, Calendar, TrendingUp, DollarSign, Users } from 'lucide-react';
import { getBuyerMetricsCalendar, getTotalMetrics } from '../services/BuyerMetricsService';

function BuyerMetricsCalendar({ offerId, sourceIds, article, buyerName, source, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedTrackers, setExpandedTrackers] = useState({});
  const [expandedCampaigns, setExpandedCampaigns] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    loadData();
  }, [offerId, sourceIds]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await getBuyerMetricsCalendar(offerId, sourceIds, article);
      setData(result);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date) => {
    setExpandedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const toggleTracker = (date, tracker) => {
    const key = `${date}-${tracker}`;
    setExpandedTrackers(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleCampaign = (date, tracker, campaign) => {
    const key = `${date}-${tracker}-${campaign}`;
    setExpandedCampaigns(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleGroup = (date, tracker, campaign, group) => {
    const key = `${date}-${tracker}-${campaign}-${group}`;
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
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
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200">
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
              className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-gray-700"
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
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                Календарь метрик
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="font-medium">Байер: <span className="text-blue-600">{buyerName}</span></span>
                <span>•</span>
                <span className="font-medium">Артикул: <span className="text-blue-600">{article}</span></span>
                <span>•</span>
                <span className="font-medium">Источник: <span className="text-blue-600">{source}</span></span>
                {data?.period && (
                  <>
                    <span>•</span>
                    <span className="font-medium">
                      Период: {formatDate(data.period.start)} - {formatDate(data.period.end)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Summary */}
          {totalMetrics && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span>Общий расход</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalMetrics.cost)}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Users className="w-4 h-4" />
                  <span>Всего лидов</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{totalMetrics.valid}</div>
              </div>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-purple-100">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Средний CPL</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalMetrics.cpl)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {sortedDates.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Нет данных за выбранный период</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDates.map(date => {
                const dayData = data.hierarchy[date];
                const isDateExpanded = expandedDates[date];

                // Подсчет итогов за день
                let dayTotal = { cost: 0, valid: 0, cpl: 0 };
                Object.keys(dayData).forEach(tracker => {
                  dayTotal.cost += dayData[tracker].cost;
                  dayTotal.valid += dayData[tracker].valid;
                });
                dayTotal.cpl = dayTotal.valid > 0 ? dayTotal.cost / dayTotal.valid : 0;

                return (
                  <div key={date} className="bg-white rounded-lg shadow-sm border border-gray-200">
                    {/* Day Header */}
                    <div
                      onClick={() => toggleDate(date)}
                      className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isDateExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-gray-900">{formatDate(date)}</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Расход</div>
                            <div className="font-mono font-semibold text-gray-900">{formatCurrency(dayTotal.cost)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Лиды</div>
                            <div className="font-mono font-semibold text-gray-900">{dayTotal.valid}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">CPL</div>
                            <div className="font-mono font-semibold text-blue-600">{formatCurrency(dayTotal.cpl)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Day Content */}
                    {isDateExpanded && (
                      <div className="p-4 space-y-2">
                        {Object.keys(dayData).map(tracker => {
                          const trackerData = dayData[tracker];
                          const trackerKey = `${date}-${tracker}`;
                          const isTrackerExpanded = expandedTrackers[trackerKey];

                          return (
                            <div key={trackerKey} className="border border-gray-200 rounded-md overflow-hidden">
                              {/* Level 1: Tracker */}
                              <div
                                onClick={() => toggleTracker(date, tracker)}
                                className="px-3 py-2 bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isTrackerExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-600" />
                                    )}
                                    <span className="font-medium text-sm text-gray-900 truncate max-w-md" title={tracker}>
                                      {tracker}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs">
                                    <span className="font-mono text-gray-700">{formatCurrency(trackerData.cost)}</span>
                                    <span className="font-mono text-gray-700">{trackerData.valid} лидов</span>
                                    <span className="font-mono text-blue-600">{formatCurrency(trackerData.cpl)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Level 2: Campaign */}
                              {isTrackerExpanded && (
                                <div className="bg-white">
                                  {Object.keys(trackerData.children).map(campaign => {
                                    const campaignData = trackerData.children[campaign];
                                    const campaignKey = `${date}-${tracker}-${campaign}`;
                                    const isCampaignExpanded = expandedCampaigns[campaignKey];

                                    return (
                                      <div key={campaignKey} className="border-t border-gray-100">
                                        <div
                                          onClick={() => toggleCampaign(date, tracker, campaign)}
                                          className="px-3 py-2 pl-8 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors"
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              {isCampaignExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-gray-600" />
                                              ) : (
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                              )}
                                              <span className="text-sm text-gray-800 truncate max-w-md" title={campaign}>
                                                {campaign}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs">
                                              <span className="font-mono text-gray-700">{formatCurrency(campaignData.cost)}</span>
                                              <span className="font-mono text-gray-700">{campaignData.valid} лидов</span>
                                              <span className="font-mono text-green-600">{formatCurrency(campaignData.cpl)}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Level 3: Group */}
                                        {isCampaignExpanded && (
                                          <div className="bg-white">
                                            {Object.keys(campaignData.children).map(group => {
                                              const groupData = campaignData.children[group];
                                              const groupKey = `${date}-${tracker}-${campaign}-${group}`;
                                              const isGroupExpanded = expandedGroups[groupKey];

                                              return (
                                                <div key={groupKey} className="border-t border-gray-100">
                                                  <div
                                                    onClick={() => toggleGroup(date, tracker, campaign, group)}
                                                    className="px-3 py-2 pl-12 bg-yellow-50 cursor-pointer hover:bg-yellow-100 transition-colors"
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                        {isGroupExpanded ? (
                                                          <ChevronDown className="w-4 h-4 text-gray-600" />
                                                        ) : (
                                                          <ChevronRight className="w-4 h-4 text-gray-600" />
                                                        )}
                                                        <span className="text-sm text-gray-800 truncate max-w-sm" title={group}>
                                                          {group}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-4 text-xs">
                                                        <span className="font-mono text-gray-700">{formatCurrency(groupData.cost)}</span>
                                                        <span className="font-mono text-gray-700">{groupData.valid} лидов</span>
                                                        <span className="font-mono text-orange-600">{formatCurrency(groupData.cpl)}</span>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* Level 4: Ad */}
                                                  {isGroupExpanded && (
                                                    <div className="bg-white">
                                                      {Object.keys(groupData.children).map(ad => {
                                                        const adData = groupData.children[ad];

                                                        return (
                                                          <div
                                                            key={`${groupKey}-${ad}`}
                                                            className="px-3 py-2 pl-16 border-t border-gray-100 hover:bg-gray-50"
                                                          >
                                                            <div className="flex items-center justify-between">
                                                              <span className="text-sm text-gray-700 truncate max-w-md" title={ad}>
                                                                {ad}
                                                              </span>
                                                              <div className="flex items-center gap-4 text-xs">
                                                                <span className="font-mono text-gray-700">{formatCurrency(adData.cost)}</span>
                                                                <span className="font-mono text-gray-700">{adData.valid} лидов</span>
                                                                <span className="font-mono text-purple-600">{formatCurrency(adData.cpl)}</span>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Всего дней: </span>
              <span className="text-gray-900">{sortedDates.length}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
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
