// Создайте новый файл: src/hooks/useZoneData.js

import { useState, useEffect, useCallback } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';

/**
 * Хук для загрузки зональных данных по артикулам из таблицы metrics_analytics
 */
export function useZoneData(creatives, autoLoad = true) {
  const [zoneDataMap, setZoneDataMap] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({ total: 0, found: 0, notFound: 0 });

  const loadZoneData = useCallback(async () => {
    if (!creatives || creatives.length === 0) {
      setZoneDataMap(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🎯 Загрузка зональных данных для креативов...');

      // Извлекаем уникальные артикулы из креативов
      const articles = [...new Set(
        creatives
          .map(creative => creative.article)
          .filter(article => article && article.trim())
      )];

      if (articles.length === 0) {
        console.log('❌ Нет артикулов для поиска зональных данных');
        setZoneDataMap(new Map());
        setStats({ total: 0, found: 0, notFound: 0 });
        return;
      }

            console.log(`🔍 Поиск зональных данных для ${articles.length} уникальных артикулов`);
      console.log('📋 Артикулы для поиска:', articles);

      // Получаем зональные данные батчевым запросом
      const zoneData = await metricsAnalyticsService.getZoneDataByArticles(articles);
      
      console.log('📦 Результат поиска зональных данных:', {
        найдено: zoneData.size,
        артикулы_с_данными: Array.from(zoneData.keys())
      });

      setZoneDataMap(zoneData);
      setLastUpdated(new Date());

      // Подсчитываем статистику
      const foundCount = zoneData.size;
      const notFoundCount = articles.length - foundCount;

      setStats({
        total: articles.length,
        found: foundCount,
        notFound: notFoundCount
      });

      console.log(`✅ Зональные данные загружены: ${foundCount}/${articles.length} найдено`);

    } catch (err) {
      console.error('❌ Ошибка загрузки зональных данных:', err);
      setError('Ошибка загрузки зональных данных: ' + err.message);
      setZoneDataMap(new Map());
      setStats({ total: 0, found: 0, notFound: 0 });
    } finally {
      setLoading(false);
    }
  }, [creatives]);

  // Автоматическая загрузка при изменении креативов
  useEffect(() => {
    if (autoLoad && creatives) {
      loadZoneData();
    }
  }, [creatives, autoLoad, loadZoneData]);

  // Получить зональные данные для конкретного артикула
  const getZoneDataForArticle = useCallback((article) => {
    if (!article || !article.trim()) {
      return null;
    }

    const zoneData = zoneDataMap.get(article.trim());
    return zoneData ? metricsAnalyticsService.formatZoneData(zoneData) : null;
  }, [zoneDataMap]);

  // Проверить есть ли зональные данные для артикула
  const hasZoneData = useCallback((article) => {
    if (!article || !article.trim()) {
      return false;
    }
    return zoneDataMap.has(article.trim());
  }, [zoneDataMap]);

  // Получить текущую зону для артикула
  const getCurrentZone = useCallback((article) => {
    const zoneData = getZoneDataForArticle(article);
    return zoneData ? zoneData.currentZone : null;
  }, [getZoneDataForArticle]);

  // Получить все цены зон в виде строки
  const getZonePricesString = useCallback((article) => {
    const zoneData = getZoneDataForArticle(article);
    if (!zoneData) {
      return null;
    }

    const prices = [];
    if (zoneData.red !== '—') prices.push(`Красная: ${zoneData.red}`);
    if (zoneData.pink !== '—') prices.push(`Розовая: ${zoneData.pink}`);
    if (zoneData.gold !== '—') prices.push(`Золотая: ${zoneData.gold}`);
    if (zoneData.green !== '—') prices.push(`Зеленая: ${zoneData.green}`);

    return prices.length > 0 ? prices.join(' | ') : null;
  }, [getZoneDataForArticle]);

  // Принудительное обновление
  const refresh = useCallback(async () => {
    console.log('🔄 Принудительное обновление зональных данных...');
    await loadZoneData();
  }, [loadZoneData]);

  return {
    zoneDataMap,
    loading,
    error,
    stats,
    lastUpdated,
    getZoneDataForArticle,
    hasZoneData,
    getCurrentZone,
    getZonePricesString,
    refresh
  };
}

export default useZoneData;
