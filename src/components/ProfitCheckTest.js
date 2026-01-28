// src/components/ProfitCheckTest.js
// Проверка прибыльности оффера по Offer ID
// Сопоставление source_id_tracker с users.buyer_settings.traffic_channels

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, ChevronDown, ChevronRight, AlertCircle, TrendingUp, Package, Calendar, Play, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

// URL API
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

// Статусы заказов
const SENT_STATUSES = ['1', '5', '6', '10', '11', '15', '16', '17', '18', '19', '20']; // Отправлено
const SOLD_STATUSES = ['2']; // Продано/Выполнено

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
function formatCurrency(value, currency = '₴') {
  const num = parseFloat(value) || 0;
  return `${num.toFixed(2)} ${currency}`;
}

// Форматирование валюты с двумя значениями (UAH и USD)
function formatCurrencyDual(uahValue, usdValue) {
  const uah = parseFloat(uahValue) || 0;
  const usd = parseFloat(usdValue) || 0;
  return (
    <span>
      {uah.toFixed(2)} ₴
      <span className="text-xs text-slate-400 ml-1">({usd.toFixed(2)} $)</span>
    </span>
  );
}

// Проверка, попадает ли дата в период доступа
function isDateInAccessPeriod(date, accessGranted, accessLimited) {
  if (!date) return false;
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const granted = accessGranted || '2020-01-01';
  const limited = accessLimited || '2099-12-31';
  return dateStr >= granted && dateStr <= limited;
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
  const [buyersChannelsMap, setBuyersChannelsMap] = useState({});

  // Фильтры
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(30));
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBuyers, setSelectedBuyers] = useState([]);

  // Раскрытые элементы иерархии
  const [expanded, setExpanded] = useState({});

  // Загрузка списка байеров из Supabase с traffic_channels
  useEffect(() => {
    loadBuyersWithChannels();
  }, []);

  const loadBuyersWithChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, buyer_settings')
        .not('buyer_settings', 'is', null);

      if (error) throw error;

      // Создаём маппинг: channel_id -> { buyer info, access_granted, access_limited }
      const map = {};
      data.forEach(user => {
        const settings = typeof user.buyer_settings === 'string'
          ? JSON.parse(user.buyer_settings)
          : user.buyer_settings;

        const channels = settings?.traffic_channels || [];
        channels.forEach(ch => {
          if (ch.channel_id) {
            if (!map[ch.channel_id]) {
              map[ch.channel_id] = [];
            }
            map[ch.channel_id].push({
              buyer_id: user.id,
              buyer_name: user.name,
              buyer_email: user.email,
              buyer_avatar: user.avatar_url,
              access_granted: ch.access_granted || '2020-01-01',
              access_limited: ch.access_limited || null,
              source: ch.source || 'unknown'
            });
          }
        });
      });
      setBuyersChannelsMap(map);
    } catch (err) {
      console.error('Error loading buyers:', err);
    }
  };

  // Найти байера по source_id_tracker и дате
  const findBuyerForSourceAndDate = (sourceId, date) => {
    const channelBuyers = buyersChannelsMap[sourceId] || [];
    for (const buyer of channelBuyers) {
      if (isDateInAccessPeriod(date, buyer.access_granted, buyer.access_limited)) {
        return buyer;
      }
    }
    // Если не нашли по дате, вернуть первого (или null)
    return channelBuyers[0] || null;
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
              delivery_price, ordered_list
            FROM sales_collection
            WHERE clickid IN (${clickIdsList})
          `;

          const chunkData = await executeQuery(salesQuery);
          if (chunkData && chunkData.length > 0) {
            salesData = [...salesData, ...chunkData];
          }
        }
      }

      // Шаг 4: Загрузка операционных расходов
      setProgress({ show: true, message: 'Загрузка операционных расходов...', percent: 60 });

      let operationalCosts = {};
      try {
        const opCostQuery = `
          SELECT month, year, cost_per_conversion
          FROM operational_cost_collection
          ORDER BY year DESC, month DESC
        `;
        const opCostData = await executeQuery(opCostQuery);
        if (opCostData && opCostData.length > 0) {
          opCostData.forEach(row => {
            const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
            operationalCosts[key] = parseFloat(row.cost_per_conversion) || 0;
          });
        }
      } catch (e) {
        console.warn('Не удалось загрузить операционные расходы:', e);
      }

      // Шаг 5: Загрузка курсов валют
      setProgress({ show: true, message: 'Загрузка курсов валют...', percent: 70 });

      let currencyRates = {};
      try {
        const currencyQuery = `
          SELECT month, year, value
          FROM currency_collection
          WHERE convert_from_currency = 'USD' AND convert_to_currency = 'UAH'
          ORDER BY year DESC, month DESC
        `;
        const currencyData = await executeQuery(currencyQuery);
        if (currencyData && currencyData.length > 0) {
          currencyData.forEach(row => {
            const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
            currencyRates[key] = parseFloat(row.value) || 41; // дефолтный курс 41
          });
        }
      } catch (e) {
        console.warn('Не удалось загрузить курсы валют:', e);
      }

      // Шаг 6: Построение иерархии
      setProgress({ show: true, message: 'Построение иерархии...', percent: 85 });

      const hierarchy = buildHierarchy(adsData, conversionsData, salesData, operationalCosts, currencyRates);

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
  const buildHierarchy = (adsData, conversionsData, salesData, operationalCosts, currencyRates) => {
    // Функция получения курса валюты по дате (если не найден - берем предыдущий месяц)
    const getExchangeRate = (dateStr) => {
      if (!dateStr) {
        // Берем самый последний доступный курс
        const sortedKeys = Object.keys(currencyRates).sort().reverse();
        return sortedKeys.length > 0 ? currencyRates[sortedKeys[0]] : 0;
      }

      let monthKey = dateStr.substring(0, 7); // YYYY-MM

      // Если курс найден - возвращаем
      if (currencyRates[monthKey]) {
        return currencyRates[monthKey];
      }

      // Ищем курс за предыдущие месяцы
      let [year, month] = monthKey.split('-').map(Number);
      for (let i = 0; i < 12; i++) { // максимум 12 попыток назад
        month--;
        if (month < 1) {
          month = 12;
          year--;
        }
        const prevKey = `${year}-${String(month).padStart(2, '0')}`;
        if (currencyRates[prevKey]) {
          return currencyRates[prevKey];
        }
      }

      // Если ничего не найдено, берем любой доступный курс
      const sortedKeys = Object.keys(currencyRates).sort().reverse();
      return sortedKeys.length > 0 ? currencyRates[sortedKeys[0]] : 0;
    };
    // Маппинги для быстрого доступа
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
      const sourceId = ad.source_id_tracker || 'unknown';
      const campaignId = ad.campaign_id_tracker || 'unknown';
      const groupId = ad.adv_group_id || 'unknown';
      const advId = ad.adv_id || 'unknown';
      const adDate = ad.adv_date;

      // Находим байера по source_id_tracker и дате
      const buyerInfo = findBuyerForSourceAndDate(sourceId, adDate);
      const buyerKey = buyerInfo ? buyerInfo.buyer_id : `source_${sourceId}`;
      const buyerName = buyerInfo ? buyerInfo.buyer_name : `Source #${sourceId}`;

      // Проверяем период доступа
      if (buyerInfo && !isDateInAccessPeriod(adDate, buyerInfo.access_granted, buyerInfo.access_limited)) {
        return; // Пропускаем данные вне периода доступа байера
      }

      // Инициализация байера
      if (!buyers[buyerKey]) {
        buyers[buyerKey] = {
          id: buyerKey,
          sourceId: sourceId,
          name: buyerName,
          email: buyerInfo?.buyer_email || '',
          avatar: buyerInfo?.buyer_avatar || null,
          accessGranted: buyerInfo?.access_granted,
          accessLimited: buyerInfo?.access_limited,
          campaigns: {},
          totals: createEmptyTotals()
        };
      }

      // Инициализация кампании
      if (!buyers[buyerKey].campaigns[campaignId]) {
        buyers[buyerKey].campaigns[campaignId] = {
          id: campaignId,
          name: ad.campaign_name_tracker || campaignId,
          groups: {},
          totals: createEmptyTotals()
        };
      }

      // Инициализация группы
      if (!buyers[buyerKey].campaigns[campaignId].groups[groupId]) {
        buyers[buyerKey].campaigns[campaignId].groups[groupId] = {
          id: groupId,
          name: ad.adv_group_name || groupId,
          ads: {},
          totals: createEmptyTotals()
        };
      }

      // Инициализация объявления
      if (!buyers[buyerKey].campaigns[campaignId].groups[groupId].ads[advId]) {
        buyers[buyerKey].campaigns[campaignId].groups[groupId].ads[advId] = {
          id: advId,
          name: ad.adv_name || advId,
          dates: {},
          conversions: conversionsByAdvId[advId] || [],
          totals: createEmptyTotals()
        };
      }

      // Добавляем данные за дату
      const adRef = buyers[buyerKey].campaigns[campaignId].groups[groupId].ads[advId];

      if (!adRef.dates[adDate]) {
        adRef.dates[adDate] = { cost: 0, costFromSources: 0, valid: 0 };
      }

      adRef.dates[adDate].cost += parseFloat(ad.cost) || 0;
      adRef.dates[adDate].costFromSources += parseFloat(ad.cost_from_sources) || 0;
      adRef.dates[adDate].valid += parseInt(ad.valid) || 0;
    });

    // Подсчитываем тоталы снизу вверх
    Object.values(buyers).forEach(buyer => {
      buyer.totals = createEmptyTotals();

      Object.values(buyer.campaigns).forEach(campaign => {
        campaign.totals = createEmptyTotals();

        Object.values(campaign.groups).forEach(group => {
          group.totals = createEmptyTotals();

          Object.values(group.ads).forEach(ad => {
            ad.totals = createEmptyTotals();

            // Тоталы по рекламе
            Object.entries(ad.dates).forEach(([date, data]) => {
              const exchangeRate = getExchangeRate(date);
              ad.totals.leads += data.valid;
              // USD значения
              ad.totals.costRedtrackUsd += data.cost;
              ad.totals.costCabinetUsd += data.costFromSources;
              // UAH значения (конвертированные)
              ad.totals.costRedtrackUah += data.cost * exchangeRate;
              ad.totals.costCabinetUah += data.costFromSources * exchangeRate;
            });

            // Считаем из конверсий и продаж
            ad.conversions.forEach(conv => {
              if (conv.sale) {
                const sale = conv.sale;
                const status = String(sale.order_status);

                // Операционные расходы по месяцу конверсии
                const convDate = conv.date_of_conversion || conv.date_of_click;
                if (convDate) {
                  const monthKey = convDate.substring(0, 7); // YYYY-MM
                  const opCost = operationalCosts[monthKey] || 0;
                  ad.totals.operationalCost += opCost;
                }

                // Расходы на доставку
                ad.totals.deliveryCost += parseFloat(sale.delivery_price) || 0;

                // Отправления (статусы отправлено)
                if (SENT_STATUSES.includes(status)) {
                  ad.totals.sentCount++;
                  ad.totals.sentSum += parseFloat(sale.order_end_price) || 0;
                  ad.totals.sentProfit += parseFloat(sale.order_profit) || 0;
                }

                // Продажи (статус выполнен)
                if (SOLD_STATUSES.includes(status)) {
                  ad.totals.soldCount++;
                  ad.totals.soldProfit += parseFloat(sale.order_profit) || 0;
                }
              }
            });

            // Агрегируем в группу
            aggregateTotals(group.totals, ad.totals);
          });

          // Агрегируем в кампанию
          aggregateTotals(campaign.totals, group.totals);
        });

        // Агрегируем в байера
        aggregateTotals(buyer.totals, campaign.totals);
      });
    });

    return buyers;
  };

  // Создать пустой объект тоталов
  function createEmptyTotals() {
    return {
      leads: 0,           // Количество лидов
      sentCount: 0,       // Количество отправлений
      sentSum: 0,         // Отправлено на сумму
      sentProfit: 0,      // Вал. прибыль с отправлений
      soldCount: 0,       // Количество продаж
      soldProfit: 0,      // Вал. прибыль с продаж
      operationalCost: 0, // Операционные расходы
      deliveryCost: 0,    // Расходы на доставку
      costRedtrackUsd: 0, // Расходы на рекламу с RedTrack (USD)
      costRedtrackUah: 0, // Расходы на рекламу с RedTrack (UAH)
      costCabinetUsd: 0,  // Расходы с рекламных кабинетов (USD)
      costCabinetUah: 0   // Расходы с рекламных кабинетов (UAH)
    };
  }

  // Агрегация тоталов
  function aggregateTotals(target, source) {
    target.leads += source.leads;
    target.sentCount += source.sentCount;
    target.sentSum += source.sentSum;
    target.sentProfit += source.sentProfit;
    target.soldCount += source.soldCount;
    target.soldProfit += source.soldProfit;
    target.operationalCost += source.operationalCost;
    target.deliveryCost += source.deliveryCost;
    target.costRedtrackUsd += source.costRedtrackUsd;
    target.costRedtrackUah += source.costRedtrackUah;
    target.costCabinetUsd += source.costCabinetUsd;
    target.costCabinetUah += source.costCabinetUah;
  }

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

    const totals = createEmptyTotals();

    Object.values(hierarchyData).forEach(buyer => {
      if (selectedBuyers.length > 0 && !selectedBuyers.includes(buyer.id)) return;
      aggregateTotals(totals, buyer.totals);
    });

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
    return Object.values(hierarchyData).map(b => ({ id: b.id, name: b.name, avatar: b.avatar }));
  }, [hierarchyData]);

  // Рендер строки метрик
  const renderMetricsCells = (totals, isHeader = false) => {
    const cellClass = isHeader
      ? 'px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap'
      : 'px-3 py-2 text-right text-slate-600 whitespace-nowrap';

    return (
      <>
        <td className={cellClass}>{totals.leads}</td>
        <td className={cellClass}>{totals.sentCount}</td>
        <td className={cellClass}>{formatCurrency(totals.sentSum)}</td>
        <td className={cellClass}>{formatCurrency(totals.sentProfit)}</td>
        <td className={cellClass}>{totals.soldCount}</td>
        <td className={cellClass}>{formatCurrency(totals.soldProfit)}</td>
        <td className={cellClass}>{formatCurrency(totals.operationalCost)}</td>
        <td className={cellClass}>{formatCurrency(totals.deliveryCost)}</td>
        <td className={cellClass}>{formatCurrencyDual(totals.costRedtrackUah, totals.costRedtrackUsd)}</td>
        <td className={cellClass}>{formatCurrencyDual(totals.costCabinetUah, totals.costCabinetUsd)}</td>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-full mx-auto">
        {/* Заголовок */}
        <div className="mb-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Проверка прибыльности оффера</h1>
            <p className="text-sm text-slate-500">Анализ по Offer ID с сопоставлением байеров из traffic_channels</p>
          </div>
        </div>

        {/* Форма поиска */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Offer ID */}
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Offer ID (offer_id_tracker)
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
                <Calendar className="inline w-4 h-4 mr-1" />
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
                <Calendar className="inline w-4 h-4 mr-1" />
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
            {/* Фильтр по байерам */}
            {availableBuyers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-500" />
                    <span className="font-medium text-slate-700">Байеры ({availableBuyers.length})</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={expandAll} className="text-sm text-indigo-600 hover:text-indigo-800">
                      Раскрыть всё
                    </button>
                    <button onClick={collapseAll} className="text-sm text-slate-500 hover:text-slate-700">
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
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        selectedBuyers.length === 0 || selectedBuyers.includes(buyer.id)
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {buyer.avatar && (
                        <img src={buyer.avatar} alt="" className="w-5 h-5 rounded-full" />
                      )}
                      {buyer.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Иерархическая таблица */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-500" />
                  {offerData.offerName}
                  <span className="text-sm font-normal text-slate-500">({offerData.offerId})</span>
                </h2>
              </div>

              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
                <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
                  <thead className="bg-slate-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-0 bg-slate-100 z-20 min-w-[300px]">
                        Иерархия
                      </th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Кол-во лидов</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Кол-во отправ.</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Отправ. на сумму</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Вал. приб. отпр.</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Кол-во продаж</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Вал. приб. продаж</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Операц. расх.</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Расх. доставка</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Расх. RedTrack</th>
                      <th className="px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Расх. кабинеты</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Общий итог */}
                    {overallTotals && (
                      <tr className="bg-indigo-100 border-b-2 border-indigo-200 font-semibold">
                        <td className="px-4 py-3 sticky left-0 bg-indigo-100 z-10">
                          <span className="text-indigo-800">ИТОГО</span>
                        </td>
                        {renderMetricsCells(overallTotals, true)}
                      </tr>
                    )}

                    {filteredBuyers.map(buyer => {
                      const buyerKey = `buyer-${buyer.id}`;
                      const isBuyerExpanded = expanded[buyerKey];

                      return (
                        <React.Fragment key={buyerKey}>
                          {/* Уровень байера */}
                          <tr
                            className="bg-blue-50 hover:bg-blue-100 border-b border-blue-100 cursor-pointer"
                            onClick={() => toggleExpand(buyerKey)}
                          >
                            <td className="px-4 py-3 sticky left-0 bg-blue-50 hover:bg-blue-100 z-10">
                              <div className="flex items-center gap-2">
                                {isBuyerExpanded ? (
                                  <ChevronDown className="w-5 h-5 text-blue-500" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-blue-500" />
                                )}
                                {buyer.avatar && (
                                  <img src={buyer.avatar} alt="" className="w-6 h-6 rounded-full" />
                                )}
                                <span className="font-semibold text-blue-900">{buyer.name}</span>
                                <span className="text-xs text-blue-400 font-mono">#{buyer.sourceId}</span>
                                {buyer.accessGranted && (
                                  <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded">
                                    {buyer.accessGranted} — {buyer.accessLimited || 'н.в.'}
                                  </span>
                                )}
                              </div>
                            </td>
                            {renderMetricsCells(buyer.totals)}
                          </tr>

                          {/* Кампании */}
                          {isBuyerExpanded && Object.values(buyer.campaigns).map(campaign => {
                            const campaignKey = `campaign-${buyer.id}-${campaign.id}`;
                            const isCampaignExpanded = expanded[campaignKey];

                            return (
                              <React.Fragment key={campaignKey}>
                                <tr
                                  className="bg-emerald-50/50 hover:bg-emerald-100/50 border-b border-emerald-100 cursor-pointer"
                                  onClick={() => toggleExpand(campaignKey)}
                                >
                                  <td className="px-4 py-2.5 pl-10 sticky left-0 bg-emerald-50/50 hover:bg-emerald-100/50 z-10">
                                    <div className="flex items-center gap-2">
                                      {isCampaignExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-emerald-500" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-emerald-500" />
                                      )}
                                      <span className="font-medium text-emerald-900 truncate max-w-md" title={campaign.name}>
                                        {campaign.name}
                                      </span>
                                    </div>
                                  </td>
                                  {renderMetricsCells(campaign.totals)}
                                </tr>

                                {/* Группы */}
                                {isCampaignExpanded && Object.values(campaign.groups).map(group => {
                                  const groupKey = `group-${buyer.id}-${campaign.id}-${group.id}`;
                                  const isGroupExpanded = expanded[groupKey];

                                  return (
                                    <React.Fragment key={groupKey}>
                                      <tr
                                        className="bg-amber-50/30 hover:bg-amber-100/30 border-b border-amber-100 cursor-pointer"
                                        onClick={() => toggleExpand(groupKey)}
                                      >
                                        <td className="px-4 py-2 pl-16 sticky left-0 bg-amber-50/30 hover:bg-amber-100/30 z-10">
                                          <div className="flex items-center gap-2">
                                            {isGroupExpanded ? (
                                              <ChevronDown className="w-4 h-4 text-amber-500" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 text-amber-500" />
                                            )}
                                            <span className="text-sm text-amber-800 truncate max-w-sm" title={group.name}>
                                              {group.name}
                                            </span>
                                          </div>
                                        </td>
                                        {renderMetricsCells(group.totals)}
                                      </tr>

                                      {/* Объявления */}
                                      {isGroupExpanded && Object.values(group.ads).map(ad => (
                                        <tr key={ad.id} className="bg-slate-50/50 hover:bg-slate-100/50 border-b border-slate-100">
                                          <td className="px-4 py-2 pl-24 sticky left-0 bg-slate-50/50 hover:bg-slate-100/50 z-10">
                                            <div className="flex items-center gap-2">
                                              <div className="w-2 h-2 rounded-full bg-slate-400" />
                                              <span className="text-xs text-slate-700 truncate max-w-xs" title={ad.name}>
                                                {ad.name}
                                              </span>
                                              {ad.conversions.length > 0 && (
                                                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                                  {ad.conversions.length} конв.
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          {renderMetricsCells(ad.totals)}
                                        </tr>
                                      ))}
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
