// src/components/MigrationModal.js
import React, { useState, useMemo } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { offerStatusService, offerSeasonService, offerBuyersService, articleOfferMappingService } from '../services/OffersSupabase';
import { getDataBySql } from '../scripts/offers/Sql_leads';
import Portal from './Portal';

// Источники трафика
const TRAFFIC_SOURCES = ['Facebook', 'Google', 'TikTok'];

// Парсинг даты из разных форматов
const parseDate = (dateStr) => {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // Формат: "17.09.2025 13:34:54" (полный)
  const fullMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (fullMatch) {
    const [, day, month, year, hours, minutes, seconds] = fullMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );
  }

  // Формат: "17.09.2025" (дата без времени)
  const dateOnlyMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }

  // Формат: "24.01" (день.месяц текущего года)
  const shortMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (shortMatch) {
    const [, day, month] = shortMatch;
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, parseInt(month) - 1, parseInt(day), 12, 0, 0);
  }

  return null;
};

// Получить первую дату с cost > 0 для source_ids и offer_id_tracker
const getFirstSpendDate = async (sourceIds, offerIdTracker) => {
  if (!sourceIds || sourceIds.length === 0 || !offerIdTracker) {
    return null;
  }

  try {
    const sourceIdsSql = sourceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
    const offerIdSql = `'${offerIdTracker.replace(/'/g, "''")}'`;

    const sql = `
      SELECT MIN(adv_date) as first_date
      FROM ads_collection
      WHERE source_id_tracker IN (${sourceIdsSql})
        AND offer_id_tracker = ${offerIdSql}
        AND cost > 0
    `;

    const rows = await getDataBySql(sql);
    const firstDate = rows[0]?.first_date;

    if (firstDate) {
      // Формат даты: 2025-11-17 → Date
      return new Date(firstDate + 'T12:00:00');
    }
    return null;
  } catch (error) {
    console.error('❌ Ошибка получения первой даты расхода:', error);
    return null;
  }
};

const MigrationModal = ({ isOpen, onClose, onMigrationSuccess, user, metrics, allBuyers = [] }) => {
  const [activeTab, setActiveTab] = useState('offer_id'); // offer_id, statuses, season, caps
  const [articlesInput, setArticlesInput] = useState('');
  const [offerIdsInput, setOfferIdsInput] = useState('');
  const [statusArticlesInput, setStatusArticlesInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Активный');
  const [seasonArticlesInput, setSeasonArticlesInput] = useState('');
  const [seasonEmojisInput, setSeasonEmojisInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Состояния для вкладки "Капы"
  const [capsSelectedBuyer, setCapsSelectedBuyer] = useState('');
  const [capsSelectedSource, setCapsSelectedSource] = useState('Facebook');
  const [capsArticlesInput, setCapsArticlesInput] = useState('');
  const [capsDatesInput, setCapsDatesInput] = useState('');

  // Получаем source_ids байера для выбранного источника
  const selectedBuyerSourceIds = useMemo(() => {
    if (!capsSelectedBuyer || !capsSelectedSource) return [];
    const buyer = allBuyers.find(b => b.id === capsSelectedBuyer);
    if (!buyer?.buyer_settings?.traffic_channels) return [];

    return buyer.buyer_settings.traffic_channels
      .filter(ch => ch.source === capsSelectedSource)
      .map(ch => ch.channel_id)
      .filter(id => id);
  }, [capsSelectedBuyer, capsSelectedSource, allBuyers]);

  if (!isOpen) return null;

  const handleOfferIdMigration = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Парсим артикулы и offer_id из текстовых полей
      const articles = articlesInput.trim().split('\n').filter(a => a.trim());
      const offerIds = offerIdsInput.trim().split('\n').filter(id => id.trim());

      if (articles.length === 0 || offerIds.length === 0) {
        setError('Оба поля должны быть заполнены');
        return;
      }

      if (articles.length !== offerIds.length) {
        setError(`Количество артикулов (${articles.length}) не совпадает с количеством offer ID (${offerIds.length})`);
        return;
      }

      // Создаём массив записей для вставки
      const records = articles.map((article, index) => ({
        article: article.trim(),
        offer_id: offerIds[index].trim()
      }));

      // Вставляем в Supabase (с конфликтом заменяем)
      const { data, error: insertError } = await supabase
        .from('article_offer_mapping')
        .upsert(records, { onConflict: 'article' });

      if (insertError) throw insertError;

      setSuccess(`✅ Успешно мигрировано ${records.length} записей`);
      setArticlesInput('');
      setOfferIdsInput('');

      // Вызываем колбэк для обновления маппингов в родительском компоненте
      if (onMigrationSuccess) {
        onMigrationSuccess();
      }

    } catch (err) {
      console.error('Ошибка миграции:', err);
      setError('Ошибка миграции: ' + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 5000);
    }
  };

  const handleStatusesMigration = async () => {
    let errorCount = 0; // Объявляем здесь, чтобы была доступна в finally

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Парсим артикулы из текстового поля
      const articles = statusArticlesInput.trim().split('\n').filter(a => a.trim());

      if (articles.length === 0) {
        setError('Введите хотя бы один артикул');
        return;
      }

      if (!selectedStatus) {
        setError('Выберите статус');
        return;
      }

      // Получаем информацию о пользователе для записи в БД
      const userName = user?.name || 'Неизвестно';
      const userId = user?.id || null;

      console.log(`🔄 Начинаем миграцию статусов для ${articles.length} артикулов...`);
      console.log(`📋 Статус: ${selectedStatus}, Пользователь: ${userName}`);

      let successCount = 0;
      const errors = [];

      // Обрабатываем каждый артикул
      for (const article of articles) {
        const trimmedArticle = article.trim();

        try {
          // Находим оффер по артикулу
          const offer = metrics?.find(m => m.article === trimmedArticle);

          if (!offer) {
            console.warn(`⚠️ Оффер с артикулом "${trimmedArticle}" не найден`);
            errors.push(`${trimmedArticle}: не найден в списке офферов`);
            errorCount++;
            continue;
          }

          // Обновляем статус оффера
          await offerStatusService.upsertOfferStatus(
            offer.id,
            selectedStatus,
            offer.article,
            offer.offer,
            userName,
            userId,
            'Массовое изменение статуса'
          );

          console.log(`✅ Статус оффера ${offer.id} (${trimmedArticle}) обновлен на "${selectedStatus}"`);
          successCount++;

        } catch (err) {
          console.error(`❌ Ошибка обновления статуса для ${trimmedArticle}:`, err);
          errors.push(`${trimmedArticle}: ${err.message}`);
          errorCount++;
        }
      }

      // Формируем сообщение о результате
      let resultMessage = `✅ Успешно обновлено: ${successCount}`;
      if (errorCount > 0) {
        resultMessage += `\n⚠️ Ошибок: ${errorCount}`;
        if (errors.length > 0) {
          resultMessage += `\n\nДетали:\n${errors.slice(0, 5).join('\n')}`;
          if (errors.length > 5) {
            resultMessage += `\n... и еще ${errors.length - 5}`;
          }
        }
      }

      if (successCount > 0) {
        setSuccess(resultMessage);
        setStatusArticlesInput('');

        // Вызываем колбэк для обновления данных
        if (onMigrationSuccess) {
          onMigrationSuccess();
        }
      } else {
        setError('Не удалось обновить ни одного оффера:\n' + errors.join('\n'));
      }

    } catch (err) {
      console.error('❌ Критическая ошибка миграции статусов:', err);
      setError('Критическая ошибка миграции: ' + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setSuccess('');
        if (errorCount === 0) {
          setError('');
        }
      }, 10000);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Миграция данных</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('offer_id')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'offer_id'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Offer ID
            </button>
            <button
              onClick={() => setActiveTab('statuses')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'statuses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Статусы
            </button>
            <button
              onClick={() => setActiveTab('season')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'season'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Сезон
            </button>
            <button
              onClick={() => setActiveTab('caps')}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'caps'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Капы
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Offer ID Tab */}
          {activeTab === 'offer_id' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Инструкция:</strong> Вставьте артикулы в левое поле (каждый с новой строки),
                  а соответствующие Offer ID в правое поле (в том же порядке).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Артикулы */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Артикулы (по одному на строку)
                  </label>
                  <textarea
                    value={articlesInput}
                    onChange={(e) => setArticlesInput(e.target.value)}
                    placeholder="Артикул1&#10;Артикул2&#10;Артикул3"
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {articlesInput.split('\n').filter(a => a.trim()).length}
                  </p>
                </div>

                {/* Offer IDs */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Offer ID (по одному на строку)
                  </label>
                  <textarea
                    value={offerIdsInput}
                    onChange={(e) => setOfferIdsInput(e.target.value)}
                    placeholder="ID1&#10;ID2&#10;ID3"
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {offerIdsInput.split('\n').filter(id => id.trim()).length}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleOfferIdMigration}
                  disabled={loading || !articlesInput.trim() || !offerIdsInput.trim()}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Миграция...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Мигрировать Offer ID
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Statuses Tab */}
          {activeTab === 'statuses' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Инструкция:</strong> Вставьте артикулы (каждый с новой строки) и выберите статус,
                  который будет применен ко всем указанным артикулам.
                </p>
              </div>

              <div className="space-y-4">
                {/* Поле для ввода артикулов */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Артикулы (по одному на строку)
                  </label>
                  <textarea
                    value={statusArticlesInput}
                    onChange={(e) => setStatusArticlesInput(e.target.value)}
                    placeholder="Артикул1&#10;Артикул2&#10;Артикул3"
                    className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Артикулов: {statusArticlesInput.split('\n').filter(a => a.trim()).length}
                  </p>
                </div>

                {/* Выбор статуса */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Статус для применения
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {offerStatusService.getAvailableStatuses().map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Предварительный просмотр */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Предварительный просмотр:</h4>
                  <p className="text-sm text-gray-600">
                    Будет обновлено <strong>{statusArticlesInput.split('\n').filter(a => a.trim()).length}</strong> артикулов
                  </p>
                  <p className="text-sm text-gray-600">
                    Новый статус: <strong className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      offerStatusService.getStatusColor(selectedStatus).color
                    } ${offerStatusService.getStatusColor(selectedStatus).textColor}`}>
                      {selectedStatus}
                    </strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Изменения внесет: <strong>{user?.name || 'Неизвестно'}</strong>
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleStatusesMigration}
                  disabled={loading || !statusArticlesInput.trim()}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Обновление статусов...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Применить статус к {statusArticlesInput.split('\n').filter(a => a.trim()).length} артикулам
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Season Tab */}
          {activeTab === 'season' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Инструкция:</strong> Вставьте артикулы в левое поле (каждый с новой строки),
                  а соответствующие сезоны (эмодзи) в правое поле. Пустые строки будут пропущены.
                </p>
                <div className="mt-2 text-xs text-blue-700">
                  <strong>Доступные сезоны:</strong> ☀️ - Лето, 🍁 - Осень, ❄️ - Зима, 🌱 - Весна
                </div>
                <div className="mt-1 text-xs text-blue-700">
                  <strong>Пример:</strong> "☀️🍁❄️🌱" → сохранится как массив ['☀️', '🍁', '❄️', '🌱']
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Артикулы */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Артикулы (по одному на строку)
                  </label>
                  <textarea
                    value={seasonArticlesInput}
                    onChange={(e) => setSeasonArticlesInput(e.target.value)}
                    placeholder="R00001&#10;R00002&#10;R00003"
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {seasonArticlesInput.split('\n').filter(a => a.trim()).length}
                  </p>
                </div>

                {/* Сезоны (эмодзи) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Сезоны (эмодзи по одному на строку)
                  </label>
                  <textarea
                    value={seasonEmojisInput}
                    onChange={(e) => setSeasonEmojisInput(e.target.value)}
                    placeholder="☀️🍁&#10;❄️🌱&#10;☀️"
                    className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {seasonEmojisInput.split('\n').length}
                  </p>
                </div>
              </div>

              {/* Предварительный просмотр */}
              {seasonArticlesInput.trim() && seasonEmojisInput.trim() && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Предварительный просмотр (первые 5):</h4>
                  <div className="space-y-1 text-sm">
                    {(() => {
                      const articles = seasonArticlesInput.split('\n');
                      const emojis = seasonEmojisInput.split('\n');
                      const preview = [];
                      let articleIdx = 0;

                      for (let i = 0; i < emojis.length && preview.length < 5; i++) {
                        // Пропускаем пустые строки в артикулах
                        while (articleIdx < articles.length && !articles[articleIdx].trim()) {
                          articleIdx++;
                        }

                        if (articleIdx < articles.length) {
                          const article = articles[articleIdx].trim();
                          const emojiStr = emojis[i] || '';
                          const parsedEmojis = offerSeasonService.parseEmojiString(emojiStr);

                          preview.push(
                            <div key={i} className="flex items-center gap-2">
                              <span className="font-mono text-gray-600">{article}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-lg">{emojiStr || '(пусто)'}</span>
                              <span className="text-gray-400 text-xs">
                                [{parsedEmojis.map(e => `'${e}'`).join(', ') || 'пустой массив'}]
                              </span>
                            </div>
                          );
                          articleIdx++;
                        }
                      }

                      return preview;
                    })()}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError('');
                      setSuccess('');

                      const articles = seasonArticlesInput.split('\n');
                      const emojis = seasonEmojisInput.split('\n');

                      // Фильтруем пустые строки и создаем записи
                      const records = [];
                      let articleIdx = 0;

                      for (let i = 0; i < emojis.length; i++) {
                        // Пропускаем пустые строки в артикулах
                        while (articleIdx < articles.length && !articles[articleIdx].trim()) {
                          articleIdx++;
                        }

                        if (articleIdx < articles.length) {
                          const article = articles[articleIdx].trim();
                          const emojiStr = emojis[i] || '';
                          const parsedEmojis = offerSeasonService.parseEmojiString(emojiStr);

                          records.push({
                            article,
                            seasons: parsedEmojis
                          });
                          articleIdx++;
                        }
                      }

                      if (records.length === 0) {
                        setError('Нет данных для миграции');
                        return;
                      }

                      console.log('🌿 Миграция сезонов:', records);

                      const result = await offerSeasonService.bulkUpsertSeasons(records);

                      setSuccess(`✅ Успешно сохранено сезонов: ${result.count}`);
                      setSeasonArticlesInput('');
                      setSeasonEmojisInput('');

                      if (onMigrationSuccess) {
                        onMigrationSuccess();
                      }

                    } catch (err) {
                      console.error('❌ Ошибка миграции сезонов:', err);
                      setError('Ошибка миграции: ' + err.message);
                    } finally {
                      setLoading(false);
                      setTimeout(() => {
                        setSuccess('');
                        setError('');
                      }, 5000);
                    }
                  }}
                  disabled={loading || !seasonArticlesInput.trim()}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Сохранить сезоны
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Caps Tab */}
          {activeTab === 'caps' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Инструкция:</strong> Выберите байера и источник трафика, затем вставьте артикулы
                  и даты привязки (каждый с новой строки). К выбранному байеру будут привязаны офферы с указанными датами.
                </p>
                <div className="mt-2 text-xs text-blue-700">
                  <strong>Форматы дат:</strong> "17.09.2025 13:34:54", "17.09.2025", "24.01" (текущий год)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Выбор байера */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Байер
                  </label>
                  <select
                    value={capsSelectedBuyer}
                    onChange={(e) => setCapsSelectedBuyer(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">-- Выберите байера --</option>
                    {allBuyers.map(buyer => (
                      <option key={buyer.id} value={buyer.id}>
                        {buyer.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Выбор источника */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Источник
                  </label>
                  <select
                    value={capsSelectedSource}
                    onChange={(e) => setCapsSelectedSource(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {TRAFFIC_SOURCES.map(source => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                  {capsSelectedBuyer && (
                    <p className="mt-2 text-xs text-gray-500">
                      Source IDs: {selectedBuyerSourceIds.length > 0 ? selectedBuyerSourceIds.join(', ') : 'не настроены'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Артикулы */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Артикулы (по одному на строку)
                  </label>
                  <textarea
                    value={capsArticlesInput}
                    onChange={(e) => setCapsArticlesInput(e.target.value)}
                    placeholder="R00001&#10;R00002&#10;R00003"
                    className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {capsArticlesInput.split('\n').filter(a => a.trim()).length}
                  </p>
                </div>

                {/* Даты */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Даты привязки (по одной на строку, пустые = авто)
                  </label>
                  <textarea
                    value={capsDatesInput}
                    onChange={(e) => setCapsDatesInput(e.target.value)}
                    placeholder="17.09.2025 13:34:54&#10;&#10;15.03.2025&#10;(пустые строки = первый день с cost > 0)"
                    className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Строк: {capsDatesInput.split('\n').length} (пустые = авто по cost)
                  </p>
                </div>
              </div>

              {/* Предварительный просмотр */}
              {capsArticlesInput.trim() && capsSelectedBuyer && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Предварительный просмотр (первые 5):</h4>
                  <div className="space-y-1 text-sm">
                    {(() => {
                      const articles = capsArticlesInput.split('\n').filter(a => a.trim());
                      const dates = capsDatesInput.split('\n'); // Не фильтруем - сохраняем индексы
                      const buyer = allBuyers.find(b => b.id === capsSelectedBuyer);
                      const preview = [];

                      for (let i = 0; i < Math.min(5, articles.length); i++) {
                        const article = articles[i]?.trim();
                        const dateStr = dates[i]?.trim() || '';
                        const parsedDate = parseDate(dateStr);
                        const offer = metrics?.find(m => m.article === article);
                        const isEmpty = !dateStr;

                        preview.push(
                          <div key={i} className="flex items-center gap-2">
                            <span className={`font-mono ${offer ? 'text-gray-600' : 'text-red-500'}`}>
                              {article}
                            </span>
                            <span className="text-gray-400">→</span>
                            {isEmpty ? (
                              <span className="text-blue-600 italic">авто (первый день с cost {'>'} 0)</span>
                            ) : (
                              <span className={parsedDate ? 'text-green-600' : 'text-red-500'}>
                                {parsedDate ? parsedDate.toLocaleString('ru-RU') : `"${dateStr}" (некорректная дата)`}
                              </span>
                            )}
                            {!offer && <span className="text-xs text-red-500">(оффер не найден)</span>}
                          </div>
                        );
                      }

                      return preview;
                    })()}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
                    <p>Байер: <strong>{allBuyers.find(b => b.id === capsSelectedBuyer)?.name}</strong></p>
                    <p>Источник: <strong>{capsSelectedSource}</strong></p>
                    <p>Будет создано привязок: <strong>{capsArticlesInput.split('\n').filter(a => a.trim()).length}</strong></p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setError('');
                      setSuccess('');

                      if (!capsSelectedBuyer) {
                        setError('Выберите байера');
                        return;
                      }

                      const articles = capsArticlesInput.split('\n').filter(a => a.trim());
                      const dates = capsDatesInput.split('\n'); // Не фильтруем - сохраняем пустые строки

                      if (articles.length === 0) {
                        setError('Введите хотя бы один артикул');
                        return;
                      }

                      const buyer = allBuyers.find(b => b.id === capsSelectedBuyer);
                      if (!buyer) {
                        setError('Байер не найден');
                        return;
                      }

                      // Загружаем маппинг артикулов -> offer_id_tracker
                      console.log('📊 Загружаем маппинг артикулов...');
                      const articleOfferMap = await articleOfferMappingService.getAllMappings();

                      console.log(`🔄 Начинаем привязку ${articles.length} офферов к байеру ${buyer.name}...`);

                      let successCount = 0;
                      let errorCount = 0;
                      let autoDateCount = 0;
                      const errors = [];

                      for (let i = 0; i < articles.length; i++) {
                        const article = articles[i].trim();
                        const dateStr = dates[i]?.trim() || '';
                        let assignDate = parseDate(dateStr);

                        // Находим оффер по артикулу
                        const offer = metrics?.find(m => m.article === article);
                        if (!offer) {
                          errors.push(`${article}: оффер не найден`);
                          errorCount++;
                          continue;
                        }

                        // Если дата пустая - ищем первый день с cost > 0
                        if (!assignDate && !dateStr) {
                          const offerIdTracker = articleOfferMap[article];
                          if (offerIdTracker && selectedBuyerSourceIds.length > 0) {
                            console.log(`🔍 Ищем первую дату с cost > 0 для ${article}...`);
                            assignDate = await getFirstSpendDate(selectedBuyerSourceIds, offerIdTracker);
                            if (assignDate) {
                              console.log(`✅ Найдена дата: ${assignDate.toLocaleString('ru-RU')}`);
                              autoDateCount++;
                            } else {
                              errors.push(`${article}: не найден расход (cost > 0)`);
                              errorCount++;
                              continue;
                            }
                          } else {
                            errors.push(`${article}: нет маппинга offer_id или source_ids`);
                            errorCount++;
                            continue;
                          }
                        } else if (!assignDate && dateStr) {
                          errors.push(`${article}: некорректная дата "${dateStr}"`);
                          errorCount++;
                          continue;
                        }

                        try {
                          // Вставляем напрямую в Supabase с кастомной датой
                          const { error: insertError } = await supabase
                            .from('offer_buyers')
                            .insert({
                              offer_id: offer.id,
                              buyer_id: buyer.id,
                              buyer_name: buyer.name,
                              source: capsSelectedSource,
                              source_ids: selectedBuyerSourceIds,
                              created_at: assignDate.toISOString()
                            });

                          if (insertError) throw insertError;

                          console.log(`✅ Привязан ${article} → ${buyer.name} (${capsSelectedSource}) с датой ${assignDate.toLocaleString('ru-RU')}`);
                          successCount++;
                        } catch (err) {
                          console.error(`❌ Ошибка привязки ${article}:`, err);
                          errors.push(`${article}: ${err.message}`);
                          errorCount++;
                        }
                      }

                      // Формируем сообщение о результате
                      let resultMessage = `✅ Успешно привязано: ${successCount}`;
                      if (autoDateCount > 0) {
                        resultMessage += ` (авто-дат: ${autoDateCount})`;
                      }
                      if (errorCount > 0) {
                        resultMessage += `\n⚠️ Ошибок: ${errorCount}`;
                        if (errors.length > 0) {
                          resultMessage += `\n\nДетали:\n${errors.slice(0, 5).join('\n')}`;
                          if (errors.length > 5) {
                            resultMessage += `\n... и еще ${errors.length - 5}`;
                          }
                        }
                      }

                      if (successCount > 0) {
                        setSuccess(resultMessage);
                        setCapsArticlesInput('');
                        setCapsDatesInput('');

                        if (onMigrationSuccess) {
                          onMigrationSuccess();
                        }
                      } else {
                        setError('Не удалось создать ни одной привязки:\n' + errors.join('\n'));
                      }

                    } catch (err) {
                      console.error('❌ Критическая ошибка миграции капов:', err);
                      setError('Критическая ошибка: ' + err.message);
                    } finally {
                      setLoading(false);
                      setTimeout(() => {
                        setSuccess('');
                        setError('');
                      }, 10000);
                    }
                  }}
                  disabled={loading || !capsSelectedBuyer || !capsArticlesInput.trim()}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Привязка офферов...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Привязать {capsArticlesInput.split('\n').filter(a => a.trim()).length} офферов
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </Portal>
  );
};

export default MigrationModal;
