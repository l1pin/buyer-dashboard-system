// src/components/ProfitCheckTest.js
// Проверка прибыльности оффера по Offer ID

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, ChevronDown, ChevronRight, AlertCircle, TrendingUp, DollarSign, Users, Target, Package, Calendar, Filter, X, Play } from 'lucide-react';
import { supabase } from '../supabaseClient';

// URL API
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Функция выполнения SQL запроса
async function executeQuery(sql) {
  const response = await fetch(CORE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assoc: true, sql }),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }

  return json;
}

// Получить дату N дней назад
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Форматирование валюты
function formatCurrency(value, currency = '$') {
  const num = parseFloat(value) || 0;
  return `${currency}${num.toFixed(2)}`;
}

// Форматирование даты
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ProfitCheckTest() {
  // Состояния
  const [offerId, setOfferId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ show: false, message: '', percent: 0 });

  // Данные
  const [offerData, setOfferData] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [buyersMap, setBuyersMap] = useState({});

  // Фильтры
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(30));
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBuyers, setSelectedBuyers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Раскрытые элементы иерархии
  const [expanded, setExpanded] = useState({});

  // Загрузка списка байеров из Supabase
  useEffect(() => {
    loadBuyers();
  }, []);

  const loadBuyers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, buyer_settings')
        .not('buyer_settings', 'is', null);

      if (error) throw error;

      const map = {};
      data.forEach(user => {
        // buyer_settings может содержать source_id_tracker
        const settings = typeof user.buyer_settings === 'string'
          ? JSON.parse(user.buyer_settings)
          : user.buyer_settings;

        if (settings?.source_id_tracker) {
          map[settings.source_id_tracker] = {
            id: user.id,
            name: user.name,
            email: user.email,
            source_id_tracker: settings.source_id_tracker
          };
        }
      });
      setBuyersMap(map);
    } catch (err) {
      console.error('Error loading buyers:', err);
    }
  };

  // Основной поиск
  const handleSearch = async () => {
    if (!offerId.trim()) {
      setError('Введите Offer ID');
      return;
    }

    setLoading(true);
    setError(null);
    setOfferData(null);
    setHierarchyData(null);
    setExpanded({});

    try {
      // Шаг 1: Загрузка рекламных данных
      setProgress({ show: true, message: 'Загрузка рекламных данных...', percent: 10 });

      const adsQuery = `
        SELECT
          offer_id_tracker, campaign_name, source_id_tracker,
          campaign_id_tracker, campaign_name_tracker,
          adv_group_id, adv_group_name,
          adv_id, adv_name, adv_date, cost, cost_from_sources, valid
        FROM ads_collection
        WHERE offer_id_tracker = '${offerId.trim().replace(/'/g, "''")}'
          AND adv_date >= '${dateFrom}'
          AND adv_date <= '${dateTo}'
        ORDER BY adv_date DESC
      `;

      const adsData = await executeQuery(adsQuery);

      if (!adsData || adsData.length === 0) {
        throw new Error('Данные по этому Offer ID не найдены за указанный период');
      }

      // Шаг 2: Собираем уникальные adv_id для поиска конверсий
      setProgress({ show: true, message: 'Загрузка конверсий...', percent: 30 });

      const advIds = [...new Set(adsData.map(row => row.adv_id).filter(Boolean))];

      let conversionsData = [];
      if (advIds.length > 0) {
        // Запрос конверсий порциями (если много adv_id)
        const chunkSize = 100;
        for (let i = 0; i < advIds.length; i += chunkSize) {
          const chunk = advIds.slice(i, i + chunkSize);
          const advIdsList = chunk.map(id => `'${id}'`).join(',');

          const convQuery = `
            SELECT
              clickid, adv_id, offer_id, offer, campaign_id, campaign,
              date_of_click, date_of_conversion, conv_type, source,
              sub1, sub2, sub3, sub4, sub5, sub6
            FROM conversions_collection
            WHERE adv_id IN (${advIdsList})
              AND date_of_click >= '${dateFrom}'
              AND date_of_click <= '${dateTo}'
          `;

          const chunkData = await executeQuery(convQuery);
          if (chunkData && chunkData.length > 0) {
            conversionsData = [...conversionsData, ...chunkData];
          }
        }
      }

      // Шаг 3: Собираем clickid для поиска продаж
      setProgress({ show: true, message: 'Загрузка продаж...', percent: 50 });

      const clickIds = [...new Set(conversionsData.map(row => row.clickid).filter(Boolean))];

      let salesData = [];
      if (clickIds.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < clickIds.length; i += chunkSize) {
          const chunk = clickIds.slice(i, i + chunkSize);
          const clickIdsList = chunk.map(id => `'${id}'`).join(',');

          const salesQuery = `
            SELECT
              id, clickid, order_id, order_status, order_date,
              order_base_price, order_price, order_end_price, order_profit,
              order_aditional_sell, initial_sku, initial_offer_name,
              ordered_list
            FROM sales_collection
            WHERE clickid IN (${clickIdsList})
          `;

          const chunkData = await executeQuery(salesQuery);
          if (chunkData && chunkData.length > 0) {
            salesData = [...salesData, ...chunkData];
          }
        }
      }

      // Шаг 4: Построение иерархии
      setProgress({ show: true, message: 'Построение иерархии...', percent: 70 });

      const hierarchy = buildHierarchy(adsData, conversionsData, salesData);

      // Сохраняем данные
      setOfferData({
        offerId,
        offerName: adsData[0]?.campaign_name || offerId,
        totalAds: adsData.length,
        totalConversions: conversionsData.length,
        totalSales: salesData.length
      });

      setHierarchyData(hierarchy);

      setProgress({ show: true, message: 'Готово!', percent: 100 });

      setTimeout(() => {
        setProgress({ show: false, message: '', percent: 0 });
      }, 1000);

    } catch (err) {
      setError(err.message);
      setProgress({ show: false, message: '', percent: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Построение иерархической структуры
  const buildHierarchy = (adsData, conversionsData, salesData) => {
    // Создаём маппинги для быстрого доступа
    const salesByClickId = {};
    salesData.forEach(sale => {
      salesByClickId[sale.clickid] = sale;
    });

    const conversionsByAdvId = {};
    conversionsData.forEach(conv => {
      if (!conversionsByAdvId[conv.adv_id]) {
        conversionsByAdvId[conv.adv_id] = [];
      }
      conversionsByAdvId[conv.adv_id].push({
        ...conv,
        sale: salesByClickId[conv.clickid] || null
      });
    });

    // Строим иерархию: Buyer -> Campaign -> Group -> Ad
    const buyers = {};

    adsData.forEach(ad => {
      const buyerId = ad.source_id_tracker || 'unknown';
      const campaignId = ad.campaign_id_tracker || 'unknown';
      const groupId = ad.adv_group_id || 'unknown';
      const advId = ad.adv_id || 'unknown';

      // Инициализация байера
      if (!buyers[buyerId]) {
        const buyerInfo = buyersMap[buyerId] || {};
        buyers[buyerId] = {
          id: buyerId,
          name: buyerInfo.name || `Байер #${buyerId}`,
          email: buyerInfo.email || '',
          campaigns: {},
          totals: { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 }
        };
      }

      // Инициализация кампании
      if (!buyers[buyerId].campaigns[campaignId]) {
        buyers[buyerId].campaigns[campaignId] = {
          id: campaignId,
          name: ad.campaign_name_tracker || campaignId,
          groups: {},
          totals: { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 }
        };
      }

      // Инициализация группы
      if (!buyers[buyerId].campaigns[campaignId].groups[groupId]) {
        buyers[buyerId].campaigns[campaignId].groups[groupId] = {
          id: groupId,
          name: ad.adv_group_name || groupId,
          ads: {},
          totals: { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 }
        };
      }

      // Инициализация объявления
      if (!buyers[buyerId].campaigns[campaignId].groups[groupId].ads[advId]) {
        buyers[buyerId].campaigns[campaignId].groups[groupId].ads[advId] = {
          id: advId,
          name: ad.adv_name || advId,
          dates: {},
          conversions: conversionsByAdvId[advId] || [],
          totals: { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 }
        };
      }

      // Добавляем данные за дату
      const dateKey = ad.adv_date;
      const adRef = buyers[buyerId].campaigns[campaignId].groups[groupId].ads[advId];

      if (!adRef.dates[dateKey]) {
        adRef.dates[dateKey] = { cost: 0, valid: 0 };
      }

      adRef.dates[dateKey].cost += parseFloat(ad.cost) || 0;
      adRef.dates[dateKey].valid += parseInt(ad.valid) || 0;
    });

    // Подсчитываем тоталы снизу вверх
    Object.values(buyers).forEach(buyer => {
      buyer.totals = { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 };

      Object.values(buyer.campaigns).forEach(campaign => {
        campaign.totals = { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 };

        Object.values(campaign.groups).forEach(group => {
          group.totals = { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 };

          Object.values(group.ads).forEach(ad => {
            // Тоталы по объявлению
            ad.totals = { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 };

            Object.values(ad.dates).forEach(date => {
              ad.totals.cost += date.cost;
              ad.totals.valid += date.valid;
            });

            // Считаем продажи из конверсий
            ad.conversions.forEach(conv => {
              if (conv.sale) {
                ad.totals.sales++;
                ad.totals.profit += parseFloat(conv.sale.order_profit) || 0;
                ad.totals.revenue += parseFloat(conv.sale.order_end_price) || 0;
              }
            });

            // Агрегируем в группу
            group.totals.cost += ad.totals.cost;
            group.totals.valid += ad.totals.valid;
            group.totals.sales += ad.totals.sales;
            group.totals.profit += ad.totals.profit;
            group.totals.revenue += ad.totals.revenue;
          });

          // Агрегируем в кампанию
          campaign.totals.cost += group.totals.cost;
          campaign.totals.valid += group.totals.valid;
          campaign.totals.sales += group.totals.sales;
          campaign.totals.profit += group.totals.profit;
          campaign.totals.revenue += group.totals.revenue;
        });

        // Агрегируем в байера
        buyer.totals.cost += campaign.totals.cost;
        buyer.totals.valid += campaign.totals.valid;
        buyer.totals.sales += campaign.totals.sales;
        buyer.totals.profit += campaign.totals.profit;
        buyer.totals.revenue += campaign.totals.revenue;
      });
    });

    return buyers;
  };

  // Переключение раскрытия элемента
  const toggleExpand = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Раскрыть всё
  const expandAll = () => {
    if (!hierarchyData) return;
    const newExpanded = {};
    Object.keys(hierarchyData).forEach(buyerId => {
      newExpanded[`buyer-${buyerId}`] = true;
      Object.keys(hierarchyData[buyerId].campaigns).forEach(campaignId => {
        newExpanded[`campaign-${buyerId}-${campaignId}`] = true;
        Object.keys(hierarchyData[buyerId].campaigns[campaignId].groups).forEach(groupId => {
          newExpanded[`group-${buyerId}-${campaignId}-${groupId}`] = true;
        });
      });
    });
    setExpanded(newExpanded);
  };

  // Свернуть всё
  const collapseAll = () => {
    setExpanded({});
  };

  // Расчет общих показателей
  const overallTotals = useMemo(() => {
    if (!hierarchyData) return null;

    const totals = { cost: 0, valid: 0, sales: 0, profit: 0, revenue: 0 };

    Object.values(hierarchyData).forEach(buyer => {
      // Фильтр по выбранным байерам
      if (selectedBuyers.length > 0 && !selectedBuyers.includes(buyer.id)) return;

      totals.cost += buyer.totals.cost;
      totals.valid += buyer.totals.valid;
      totals.sales += buyer.totals.sales;
      totals.profit += buyer.totals.profit;
      totals.revenue += buyer.totals.revenue;
    });

    // Чистая прибыль = прибыль с продаж - расходы на рекламу
    totals.netProfit = totals.profit - totals.cost;
    // ROI
    totals.roi = totals.cost > 0 ? ((totals.netProfit / totals.cost) * 100) : 0;
    // CPL
    totals.cpl = totals.valid > 0 ? (totals.cost / totals.valid) : 0;

    return totals;
  }, [hierarchyData, selectedBuyers]);

  // Фильтрация байеров
  const filteredBuyers = useMemo(() => {
    if (!hierarchyData) return [];
    return Object.values(hierarchyData).filter(buyer => {
      if (selectedBuyers.length > 0 && !selectedBuyers.includes(buyer.id)) return false;
      return true;
    });
  }, [hierarchyData, selectedBuyers]);

  // Список всех байеров для фильтра
  const availableBuyers = useMemo(() => {
    if (!hierarchyData) return [];
    return Object.values(hierarchyData).map(b => ({ id: b.id, name: b.name }));
  }, [hierarchyData]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Проверка прибыльности оффера</h1>
            <p className="text-sm text-slate-500">Анализ расходов, конверсий и продаж по Offer ID</p>
          </div>
        </div>

        {/* Форма поиска */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Offer ID */}
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Offer ID
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={offerId}
                  onChange={(e) => setOfferId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Введите Offer ID (например: 65a00dbd13f2cf0001e1aca8)"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Дата от */}
            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Дата от
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Дата до */}
            <div className="w-40">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Дата до
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Кнопка поиска */}
            <button
              onClick={handleSearch}
              disabled={loading || !offerId.trim()}
              className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                loading || !offerId.trim()
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Анализировать
                </>
              )}
            </button>
          </div>

          {/* Прогресс */}
          {progress.show && (
            <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-indigo-700">{progress.message}</span>
                <span className="text-sm text-indigo-600">{progress.percent}%</span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Ошибка</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Результаты */}
        {offerData && hierarchyData && (
          <>
            {/* Общая статистика */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <DollarSign className="w-4 h-4" />
                  Расход
                </div>
                <div className="text-xl font-bold text-slate-800">{formatCurrency(overallTotals?.cost)}</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Target className="w-4 h-4" />
                  Лиды
                </div>
                <div className="text-xl font-bold text-slate-800">{overallTotals?.valid || 0}</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Package className="w-4 h-4" />
                  Продажи
                </div>
                <div className="text-xl font-bold text-slate-800">{overallTotals?.sales || 0}</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Выручка
                </div>
                <div className="text-xl font-bold text-slate-800">{formatCurrency(overallTotals?.revenue)}</div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <DollarSign className="w-4 h-4" />
                  Чистая прибыль
                </div>
                <div className={`text-xl font-bold ${overallTotals?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(overallTotals?.netProfit)}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  ROI
                </div>
                <div className={`text-xl font-bold ${overallTotals?.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {overallTotals?.roi?.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Фильтр по байерам */}
            {availableBuyers.length > 1 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-500" />
                    <span className="font-medium text-slate-700">Фильтр по байерам</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={expandAll}
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Раскрыть всё
                    </button>
                    <button
                      onClick={collapseAll}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Свернуть
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableBuyers.map(buyer => (
                    <button
                      key={buyer.id}
                      onClick={() => {
                        if (selectedBuyers.includes(buyer.id)) {
                          setSelectedBuyers(selectedBuyers.filter(id => id !== buyer.id));
                        } else {
                          setSelectedBuyers([...selectedBuyers, buyer.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedBuyers.length === 0 || selectedBuyers.includes(buyer.id)
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {buyer.name}
                    </button>
                  ))}
                  {selectedBuyers.length > 0 && (
                    <button
                      onClick={() => setSelectedBuyers([])}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-600 border border-red-200 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Сбросить
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Иерархическая таблица */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" />
                  {offerData.offerName}
                </h2>
              </div>

              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600">Иерархия</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Расход</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Лиды</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">CPL</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Продажи</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Выручка</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Маржа</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">Чистая прибыль</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuyers.map(buyer => {
                      const buyerKey = `buyer-${buyer.id}`;
                      const isBuyerExpanded = expanded[buyerKey];
                      const buyerNetProfit = buyer.totals.profit - buyer.totals.cost;
                      const buyerRoi = buyer.totals.cost > 0 ? ((buyerNetProfit / buyer.totals.cost) * 100) : 0;
                      const buyerCpl = buyer.totals.valid > 0 ? (buyer.totals.cost / buyer.totals.valid) : 0;

                      return (
                        <React.Fragment key={buyerKey}>
                          {/* Уровень байера */}
                          <tr className="bg-indigo-50 hover:bg-indigo-100 border-b border-indigo-100 cursor-pointer" onClick={() => toggleExpand(buyerKey)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {isBuyerExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-indigo-500" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-indigo-500" />
                                )}
                                <Users className="w-5 h-5 text-indigo-600" />
                                <span className="font-semibold text-indigo-900">{buyer.name}</span>
                                <span className="text-xs text-indigo-400 font-mono">#{buyer.id}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(buyer.totals.cost)}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{buyer.totals.valid}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(buyerCpl)}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{buyer.totals.sales}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(buyer.totals.revenue)}</td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(buyer.totals.profit)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${buyerNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(buyerNetProfit)}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${buyerRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {buyerRoi.toFixed(1)}%
                            </td>
                          </tr>

                          {/* Кампании байера */}
                          {isBuyerExpanded && Object.values(buyer.campaigns).map(campaign => {
                            const campaignKey = `campaign-${buyer.id}-${campaign.id}`;
                            const isCampaignExpanded = expanded[campaignKey];
                            const campaignNetProfit = campaign.totals.profit - campaign.totals.cost;
                            const campaignRoi = campaign.totals.cost > 0 ? ((campaignNetProfit / campaign.totals.cost) * 100) : 0;
                            const campaignCpl = campaign.totals.valid > 0 ? (campaign.totals.cost / campaign.totals.valid) : 0;

                            return (
                              <React.Fragment key={campaignKey}>
                                {/* Уровень кампании */}
                                <tr className="bg-blue-50/50 hover:bg-blue-100/50 border-b border-blue-100 cursor-pointer" onClick={() => toggleExpand(campaignKey)}>
                                  <td className="px-4 py-2.5 pl-10">
                                    <div className="flex items-center gap-2">
                                      {isCampaignExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-blue-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-blue-500" />
                                      )}
                                      <Target className="w-4 h-4 text-blue-600" />
                                      <span className="font-medium text-blue-900 truncate max-w-md" title={campaign.name}>
                                        {campaign.name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(campaign.totals.cost)}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{campaign.totals.valid}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(campaignCpl)}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{campaign.totals.sales}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-600">{formatCurrency(campaign.totals.revenue)}</td>
                                  <td className="px-4 py-2.5 text-right text-green-600">{formatCurrency(campaign.totals.profit)}</td>
                                  <td className={`px-4 py-2.5 text-right font-medium ${campaignNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(campaignNetProfit)}
                                  </td>
                                  <td className={`px-4 py-2.5 text-right font-medium ${campaignRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {campaignRoi.toFixed(1)}%
                                  </td>
                                </tr>

                                {/* Группы кампании */}
                                {isCampaignExpanded && Object.values(campaign.groups).map(group => {
                                  const groupKey = `group-${buyer.id}-${campaign.id}-${group.id}`;
                                  const isGroupExpanded = expanded[groupKey];
                                  const groupNetProfit = group.totals.profit - group.totals.cost;
                                  const groupRoi = group.totals.cost > 0 ? ((groupNetProfit / group.totals.cost) * 100) : 0;
                                  const groupCpl = group.totals.valid > 0 ? (group.totals.cost / group.totals.valid) : 0;

                                  return (
                                    <React.Fragment key={groupKey}>
                                      {/* Уровень группы */}
                                      <tr className="bg-emerald-50/30 hover:bg-emerald-100/30 border-b border-emerald-100 cursor-pointer" onClick={() => toggleExpand(groupKey)}>
                                        <td className="px-4 py-2 pl-16">
                                          <div className="flex items-center gap-2">
                                            {isGroupExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-emerald-500" />
                                            )}
                                            <span className="text-sm text-emerald-800 truncate max-w-sm" title={group.name}>
                                              {group.name}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-500 text-sm">{formatCurrency(group.totals.cost)}</td>
                                        <td className="px-4 py-2 text-right text-slate-500 text-sm">{group.totals.valid}</td>
                                        <td className="px-4 py-2 text-right text-slate-500 text-sm">{formatCurrency(groupCpl)}</td>
                                        <td className="px-4 py-2 text-right text-slate-500 text-sm">{group.totals.sales}</td>
                                        <td className="px-4 py-2 text-right text-slate-500 text-sm">{formatCurrency(group.totals.revenue)}</td>
                                        <td className="px-4 py-2 text-right text-green-500 text-sm">{formatCurrency(group.totals.profit)}</td>
                                        <td className={`px-4 py-2 text-right text-sm ${groupNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {formatCurrency(groupNetProfit)}
                                        </td>
                                        <td className={`px-4 py-2 text-right text-sm ${groupRoi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {groupRoi.toFixed(1)}%
                                        </td>
                                      </tr>

                                      {/* Объявления группы */}
                                      {isGroupExpanded && Object.values(group.ads).map(ad => {
                                        const adNetProfit = ad.totals.profit - ad.totals.cost;
                                        const adRoi = ad.totals.cost > 0 ? ((adNetProfit / ad.totals.cost) * 100) : 0;
                                        const adCpl = ad.totals.valid > 0 ? (ad.totals.cost / ad.totals.valid) : 0;

                                        return (
                                          <tr key={ad.id} className="bg-amber-50/20 hover:bg-amber-100/30 border-b border-amber-100">
                                            <td className="px-4 py-2 pl-24">
                                              <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                <span className="text-xs text-amber-800 truncate max-w-xs" title={ad.name}>
                                                  {ad.name}
                                                </span>
                                                {ad.conversions.length > 0 && (
                                                  <span className="text-[10px] bg-amber-200 text-amber-700 px-1.5 py-0.5 rounded">
                                                    {ad.conversions.length} конв.
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-400 text-xs">{formatCurrency(ad.totals.cost)}</td>
                                            <td className="px-4 py-2 text-right text-slate-400 text-xs">{ad.totals.valid}</td>
                                            <td className="px-4 py-2 text-right text-slate-400 text-xs">{formatCurrency(adCpl)}</td>
                                            <td className="px-4 py-2 text-right text-slate-400 text-xs">{ad.totals.sales}</td>
                                            <td className="px-4 py-2 text-right text-slate-400 text-xs">{formatCurrency(ad.totals.revenue)}</td>
                                            <td className="px-4 py-2 text-right text-green-400 text-xs">{formatCurrency(ad.totals.profit)}</td>
                                            <td className={`px-4 py-2 text-right text-xs ${adNetProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                              {formatCurrency(adNetProfit)}
                                            </td>
                                            <td className={`px-4 py-2 text-right text-xs ${adRoi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                              {adRoi.toFixed(1)}%
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProfitCheckTest;
