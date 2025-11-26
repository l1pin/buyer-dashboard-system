// src/components/MigrationModal.js
import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { offerStatusService } from '../services/OffersSupabase';

const MigrationModal = ({ isOpen, onClose, onMigrationSuccess, user, metrics }) => {
  const [activeTab, setActiveTab] = useState('offer_id'); // offer_id, statuses, season
  const [articlesInput, setArticlesInput] = useState('');
  const [offerIdsInput, setOfferIdsInput] = useState('');
  const [statusArticlesInput, setStatusArticlesInput] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Активный');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 text-lg">Раздел "Сезон" в разработке</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationModal;
