// src/services/landingMetricsService.js
// Сервис для работы с метриками лендингов

import { landingMetricsService } from '../supabaseClient';

const LANDING_METRICS_API_URL = '/.netlify/functions/landing-metrics-proxy';

export class LandingMetricsService {
  /**
   * Получение метрик для массива UUID лендингов
   */
  static async getBatchLandingMetrics(landingUuids, options = {}) {
    const { dateFrom = null, dateTo = null } = options;

    if (!landingUuids || landingUuids.length === 0) {
      console.warn('⚠️ getBatchLandingMetrics: пустой массив UUID');
      return { success: false, results: [] };
    }

    console.log(`🚀 Загрузка метрик для ${landingUuids.length} лендингов`);

    try {
      const requestBody = {
        landing_uuids: landingUuids
      };

      if (dateFrom) requestBody.date_from = dateFrom;
      if (dateTo) requestBody.date_to = dateTo;

      const response = await fetch(LANDING_METRICS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      console.log(`✅ Получены метрики для лендингов:`, {
        resultsCount: data.results?.length || 0
      });

      return {
        success: true,
        results: data.results || []
      };

    } catch (error) {
      console.error('❌ Ошибка загрузки метрик лендингов:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Агрегирование дневных данных
   */
  static aggregateDailyData(dailyData) {
    if (!dailyData || dailyData.length === 0) {
      return {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        avg_duration: 0,
        days_count: 0,
        cost_from_sources: 0,
        clicks_on_link: 0
      };
    }

    const result = dailyData.reduce(
      (acc, day) => {
        return {
          leads: acc.leads + day.leads,
          cost: acc.cost + day.cost,
          clicks: acc.clicks + day.clicks,
          impressions: acc.impressions + day.impressions,
          duration_sum: acc.duration_sum + (day.avg_duration || 0),
          days_count: acc.days_count + 1,
          cost_from_sources: acc.cost_from_sources + (day.cost_from_sources || 0),
          clicks_on_link: acc.clicks_on_link + (day.clicks_on_link || 0)
        };
      },
      {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        duration_sum: 0,
        days_count: 0,
        cost_from_sources: 0,
        clicks_on_link: 0
      }
    );

    return {
      leads: result.leads,
      cost: result.cost,
      clicks: result.clicks,
      impressions: result.impressions,
      avg_duration: result.days_count > 0 ? result.duration_sum / result.days_count : 0,
      days_count: result.days_count,
      cost_from_sources: result.cost_from_sources,
      clicks_on_link: result.clicks_on_link
    };
  }

  /**
   * Вычисление производных метрик
   */
  static computeDerivedMetrics(aggregates) {
    const fix2 = (x) => (Number.isFinite(x) ? Number(x.toFixed(2)) : 0);

    const { leads, cost, clicks, impressions, avg_duration, days_count, cost_from_sources, clicks_on_link } = aggregates;

    const CPL = leads > 0 ? cost / leads : 0;
    const CTR = impressions > 0 ? (clicks_on_link / impressions) * 100 : 0;
    const CPC = clicks > 0 ? cost / clicks : 0;
    const CPM = impressions > 0 ? (cost_from_sources / impressions) * 1000 : 0;

    return {
      leads,
      cost: fix2(cost),
      clicks,
      impressions,
      avg_duration: fix2(avg_duration),
      days_count,
      cost_from_sources: fix2(cost_from_sources),
      clicks_on_link,
      cpl: fix2(CPL),
      ctr_percent: fix2(CTR),
      cpc: fix2(CPC),
      cpm: fix2(CPM)
    };
  }

  /**
   * Форматирование метрик
   */
  static formatMetrics(metrics) {
    const formatInt = (n) => String(Math.round(Number(n) || 0));
    const formatMoney = (n) => (Number(n) || 0).toFixed(2) + "$";
    const formatPercent = (n) => (Number(n) || 0).toFixed(2) + "%";
    const formatDuration = (n) => (Number(n) || 0).toFixed(1) + "с";

    return {
      leads: formatInt(metrics.leads),
      cpl: formatMoney(metrics.cpl),
      cost: formatMoney(metrics.cost),
      ctr: formatPercent(metrics.ctr_percent),
      cpc: formatMoney(metrics.cpc),
      cpm: formatMoney(metrics.cpm),
      clicks: formatInt(metrics.clicks),
      impressions: formatInt(metrics.impressions),
      avg_duration: formatDuration(metrics.avg_duration),
      days: formatInt(metrics.days_count) + " дн."
    };
  }

  /**
   * Фильтрация данных по периоду
   */
  static filterDataByPeriod(dailyData, period) {
    if (!dailyData || dailyData.length === 0) {
      return [];
    }

    if (period === 'all') {
      return dailyData;
    }

    if (period === '4days') {
      const daysToTake = Math.min(4, dailyData.length);
      return dailyData.slice(0, daysToTake);
    }

    return dailyData;
  }
}

export default LandingMetricsService;
