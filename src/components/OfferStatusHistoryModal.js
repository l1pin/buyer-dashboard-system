// src/components/OfferStatusHistoryModal.js
import React, { useState, useEffect } from 'react';
import { offerStatusService } from '../supabaseClient';

/**
 * Модальное окно для отображения истории статусов оффера
 * Показывает полную хронологию изменений статусов с датами и длительностью
 */
function OfferStatusHistoryModal({ offerId, article, offerName, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && offerId) {
      loadHistory();
    }
  }, [isOpen, offerId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');

      const historyData = await offerStatusService.getOfferStatusHistory(offerId);
      setHistory(historyData);

    } catch (error) {
      console.error('Ошибка загрузки истории статусов:', error);
      setError('Ошибка загрузки истории: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '—';
    }
  };

  const getDaysText = (days) => {
    if (days === 0) return 'менее дня';
    if (days === 1) return '1 день';
    if (days >= 2 && days <= 4) return `${days} дня`;
    return `${days} дней`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              История статусов
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {article && <span className="font-mono">[{article}]</span>} {offerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Загрузка истории...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600">История статусов пуста</p>
              <p className="text-sm text-gray-500 mt-2">Статусы еще не назначались для этого оффера</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              {history.map((entry, index) => {
                const statusConfig = offerStatusService.getStatusColor(entry.status);
                const isCurrentStatus = index === 0;

                return (
                  <div
                    key={index}
                    className={`relative pl-8 pb-6 ${index === history.length - 1 ? '' : 'border-l-2 border-gray-200'}`}
                  >
                    {/* Цветной кружок на линии */}
                    <div className={`absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full border-4 border-white ${statusConfig.color} shadow-md`}></div>

                    {/* Карточка с информацией */}
                    <div className={`bg-white border-2 rounded-lg p-4 shadow-sm ${isCurrentStatus ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                      {/* Статус и badge */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color} ${statusConfig.textColor}`}>
                            {entry.status}
                          </span>
                          {isCurrentStatus && (
                            <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              Текущий
                            </span>
                          )}
                        </div>

                        {/* Длительность */}
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold">{getDaysText(entry.days_in_status)}</span>
                        </div>
                      </div>

                      {/* Дата и время */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{formatDate(entry.changed_at)}</span>
                      </div>

                      {/* Кто изменил */}
                      {entry.changed_by && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>{entry.changed_by}</span>
                        </div>
                      )}

                      {/* Комментарий */}
                      {entry.comment && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-sm text-gray-700 italic">
                            "{entry.comment}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfferStatusHistoryModal;
