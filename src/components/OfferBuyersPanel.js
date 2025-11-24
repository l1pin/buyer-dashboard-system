// src/components/OfferBuyersPanel.js
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import { Plus, X, Loader2 } from 'lucide-react';
import { offerBuyersService } from '../services/OffersSupabase';

const OfferBuyersPanel = React.memo(function OfferBuyersPanel({
  offer,
  allBuyers = [],
  initialAssignments = [],
  onAssignmentsChange
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [availableBuyers, setAvailableBuyers] = useState([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Преобразуем привязки из БД в формат компонента
  const assignedBuyers = useMemo(() => {
    return initialAssignments.map(assignment => {
      const buyerData = allBuyers.find(b => b.id === assignment.buyer_id);
      return {
        id: assignment.id,
        source: assignment.source,
        buyer: buyerData || {
          id: assignment.buyer_id,
          name: assignment.buyer_name,
          avatar_url: null
        },
        offer_id: assignment.offer_id,
        source_id: assignment.source_id
      };
    });
  }, [initialAssignments, allBuyers]);

  const handleAddBuyer = useCallback(async (source) => {
    setSelectedSource(source);
    setShowModal(true);
    setLoadingBuyers(true);

    try {
      // Фильтруем байеров по источнику
      const filtered = allBuyers.filter(buyer => {
        if (!buyer.buyer_settings || !buyer.buyer_settings.traffic_channels) {
          return false;
        }
        return buyer.buyer_settings.traffic_channels.some(
          channel => channel.source === source
        );
      });

      // Исключаем уже привязанных байеров для этого источника
      const alreadyAdded = assignedBuyers
        .filter(b => b.source === source)
        .map(b => b.buyer.id);

      const available = filtered.filter(buyer => !alreadyAdded.includes(buyer.id));
      setAvailableBuyers(available);
    } catch (error) {
      console.error('Ошибка фильтрации байеров:', error);
      setAvailableBuyers([]);
    } finally {
      setLoadingBuyers(false);
    }
  }, [allBuyers, assignedBuyers]);

  const handleSelectBuyer = useCallback(async (buyer) => {
    setSavingAssignment(true);

    try {
      // Получаем source_id из настроек байера
      const channel = buyer.buyer_settings?.traffic_channels?.find(
        ch => ch.source === selectedSource
      );
      const sourceId = channel?.channel_id || null;

      // Сохраняем в БД
      const savedAssignment = await offerBuyersService.addAssignment(
        offer.id,
        buyer.id,
        buyer.name,
        selectedSource,
        sourceId
      );

      // Уведомляем родительский компонент о новой привязке
      if (onAssignmentsChange) {
        onAssignmentsChange(offer.id, [...initialAssignments, savedAssignment]);
      }

      setShowModal(false);
      setSelectedSource(null);
    } catch (error) {
      console.error('Ошибка сохранения привязки:', error);
      alert('Ошибка сохранения привязки байера');
    } finally {
      setSavingAssignment(false);
    }
  }, [selectedSource, offer.id, initialAssignments, onAssignmentsChange]);

  const handleRemoveBuyer = useCallback(async (assignmentId) => {
    if (!window.confirm('Удалить привязку байера к офферу?')) return;

    try {
      // Удаляем из БД
      await offerBuyersService.removeAssignment(assignmentId);

      // Уведомляем родительский компонент об удалении
      if (onAssignmentsChange) {
        onAssignmentsChange(offer.id, initialAssignments.filter(a => a.id !== assignmentId));
      }
    } catch (error) {
      console.error('Ошибка удаления привязки:', error);
      alert('Ошибка удаления привязки');
    }
  }, [offer.id, initialAssignments, onAssignmentsChange]);

  // Группируем байеров по источникам
  const buyersBySource = useMemo(() => ({
    Facebook: assignedBuyers.filter(b => b.source === 'Facebook'),
    Google: assignedBuyers.filter(b => b.source === 'Google'),
    TikTok: assignedBuyers.filter(b => b.source === 'TikTok')
  }), [assignedBuyers]);

  const SourceColumn = React.memo(({ source, icon: Icon, buyers, isLast, onAddBuyer, onRemoveBuyer }) => {
    return (
      <div className={`flex-1 px-4 py-3 ${!isLast ? 'border-r border-gray-200' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5" />
            <span className="text-sm font-medium text-gray-900">{source}</span>
            <span className="text-xs text-gray-400">({buyers.length})</span>
          </div>
          <button
            onClick={() => onAddBuyer(source)}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            title={`Добавить байера для ${source}`}
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Список привязанных байеров - горизонтальный ряд со скроллом */}
        <div
          className="overflow-x-auto pb-2 -mx-1 px-1"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {buyers.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-6">
              Нет байеров
            </div>
          ) : (
            <div className="flex flex-row gap-2.5 min-w-max cursor-grab active:cursor-grabbing select-none">
              {buyers.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex-shrink-0 w-24 bg-white border border-gray-200 rounded-lg p-2 hover:border-gray-300 hover:bg-gray-50 transition-all group cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center space-y-1.5">
                    {/* Аватар */}
                    <div className="relative">
                      {assignment.buyer.avatar_url ? (
                        <img
                          src={assignment.buyer.avatar_url}
                          alt={assignment.buyer.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-gray-600 text-base font-medium">
                            {assignment.buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                          </span>
                        </div>
                      )}

                      {/* Кнопка удаления */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBuyer(assignment.id);
                        }}
                        className="absolute -top-0.5 -right-0.5 opacity-0 group-hover:opacity-100 bg-white border border-gray-200 p-0.5 hover:bg-red-50 hover:border-red-300 rounded-full transition-all shadow-sm"
                        title="Удалить привязку"
                      >
                        <X className="w-2.5 h-2.5 text-gray-600 hover:text-red-600" />
                      </button>
                    </div>

                    {/* Имя - полное отображение в две строки */}
                    <div className="w-full px-0.5">
                      <div className="text-xs font-medium text-gray-900 leading-tight break-words">
                        {assignment.buyer.name}
                      </div>
                      {/* Source ID если есть */}
                      {assignment.source_id && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5" title={assignment.source_id}>
                          ID: {assignment.source_id.slice(0, 8)}...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  });

  return (
    <>
      <div className="mt-2 bg-white rounded-lg border border-gray-200">
        <div className="grid grid-cols-3">
          <SourceColumn
            source="Facebook"
            icon={FacebookIcon}
            buyers={buyersBySource.Facebook}
            isLast={false}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
          />
          <SourceColumn
            source="Google"
            icon={GoogleIcon}
            buyers={buyersBySource.Google}
            isLast={false}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
          />
          <SourceColumn
            source="TikTok"
            icon={TiktokIcon}
            buyers={buyersBySource.TikTok}
            isLast={true}
            onAddBuyer={handleAddBuyer}
            onRemoveBuyer={handleRemoveBuyer}
          />
        </div>
      </div>

      {/* Модальное окно выбора байера */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Выбрать байера для {selectedSource}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedSource(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={savingAssignment}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Список байеров */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingBuyers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : availableBuyers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    Нет доступных байеров с источником {selectedSource}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {assignedBuyers.filter(b => b.source === selectedSource).length > 0
                      ? 'Все подходящие байеры уже привязаны к этому офферу'
                      : 'У байеров нет настроенных каналов с этим источником'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBuyers.map(buyer => {
                    // Получаем channel_id для отображения
                    const channel = buyer.buyer_settings?.traffic_channels?.find(
                      ch => ch.source === selectedSource
                    );

                    return (
                      <button
                        key={buyer.id}
                        onClick={() => handleSelectBuyer(buyer)}
                        disabled={savingAssignment}
                        className="w-full bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg p-3 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center space-x-3">
                          {/* Аватар */}
                          {buyer.avatar_url ? (
                            <img
                              src={buyer.avatar_url}
                              alt={buyer.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                              </span>
                            </div>
                          )}

                          {/* Информация */}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{buyer.name}</div>
                            <div className="text-sm text-gray-500 truncate">{buyer.email}</div>
                            {channel?.channel_id && (
                              <div className="text-xs text-gray-400 mt-0.5">
                                Source ID: {channel.channel_id}
                              </div>
                            )}
                          </div>

                          {savingAssignment && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSource(null);
                }}
                disabled={savingAssignment}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default OfferBuyersPanel;
