// src/components/OfferBuyersPanel.js
import React, { useState, useEffect } from 'react';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import { offerBuyersService } from '../supabaseClient';
import { Plus, X } from 'lucide-react';

function OfferBuyersPanel({ offer }) {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [availableBuyers, setAvailableBuyers] = useState([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  // Загрузка привязанных байеров при монтировании
  useEffect(() => {
    loadOfferBuyers();
  }, [offer.id]);

  const loadOfferBuyers = async () => {
    try {
      setLoading(true);
      const data = await offerBuyersService.getOfferBuyers(offer.id);
      setBuyers(data);
    } catch (error) {
      console.error('Ошибка загрузки байеров:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBuyer = async (source) => {
    setSelectedSource(source);
    setShowModal(true);
    setLoadingBuyers(true);

    try {
      const data = await offerBuyersService.getBuyersBySource(source);
      // Фильтруем уже добавленных байеров для этого источника
      const alreadyAdded = buyers
        .filter(b => b.source === source)
        .map(b => b.buyer_id);
      const filtered = data.filter(buyer => !alreadyAdded.includes(buyer.id));
      setAvailableBuyers(filtered);
    } catch (error) {
      console.error('Ошибка загрузки доступных байеров:', error);
      setAvailableBuyers([]);
    } finally {
      setLoadingBuyers(false);
    }
  };

  const handleSelectBuyer = async (buyerId) => {
    try {
      const newBuyer = await offerBuyersService.addBuyerToOffer(
        offer.id,
        buyerId,
        selectedSource
      );
      setBuyers([...buyers, newBuyer]);
      setShowModal(false);
      setSelectedSource(null);
    } catch (error) {
      console.error('Ошибка добавления байера:', error);
      alert('Ошибка добавления байера. Возможно, он уже привязан к этому офферу.');
    }
  };

  const handleRemoveBuyer = async (buyerLinkId) => {
    if (!window.confirm('Удалить привязку байера к офферу?')) return;

    try {
      await offerBuyersService.removeBuyerFromOffer(buyerLinkId);
      setBuyers(buyers.filter(b => b.id !== buyerLinkId));
    } catch (error) {
      console.error('Ошибка удаления привязки:', error);
      alert('Ошибка удаления привязки байера');
    }
  };

  // Группируем байеров по источникам
  const buyersBySource = {
    Facebook: buyers.filter(b => b.source === 'Facebook'),
    Google: buyers.filter(b => b.source === 'Google'),
    TikTok: buyers.filter(b => b.source === 'TikTok')
  };

  const SourceColumn = ({ source, icon: Icon, buyers }) => {
    return (
      <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5" />
            <span className="text-sm font-semibold text-gray-700">{source}</span>
          </div>
          <button
            onClick={() => handleAddBuyer(source)}
            className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            title={`Добавить байера для ${source}`}
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Список привязанных байеров */}
        <div className="space-y-2">
          {buyers.length === 0 ? (
            <div className="text-xs text-gray-400 italic text-center py-2">
              Нет байеров
            </div>
          ) : (
            buyers.map(({ id, buyer }) => (
              <div
                key={id}
                className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center space-x-2">
                  {/* Аватар */}
                  <div className="flex-shrink-0">
                    {buyer.avatar_url ? (
                      <img
                        src={buyer.avatar_url}
                        alt={buyer.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white text-xs font-semibold">
                          {buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Имя */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {buyer.name}
                    </div>
                  </div>

                  {/* Кнопка удаления */}
                  <button
                    onClick={() => handleRemoveBuyer(id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-full transition-all"
                    title="Удалить привязку"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="mt-2 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-500">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 bg-white rounded-lg border border-gray-200 p-3">
        <div className="grid grid-cols-3 gap-3">
          <SourceColumn
            source="Facebook"
            icon={FacebookIcon}
            buyers={buyersBySource.Facebook}
          />
          <SourceColumn
            source="Google"
            icon={GoogleIcon}
            buyers={buyersBySource.Google}
          />
          <SourceColumn
            source="TikTok"
            icon={TiktokIcon}
            buyers={buyersBySource.TikTok}
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
                    Все подходящие байеры уже привязаны к этому офферу
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableBuyers.map(buyer => (
                    <button
                      key={buyer.id}
                      onClick={() => handleSelectBuyer(buyer.id)}
                      className="w-full bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 transition-all text-left"
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
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-semibold">
                              {buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                            </span>
                          </div>
                        )}

                        {/* Информация */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900">{buyer.name}</div>
                          <div className="text-sm text-gray-500 truncate">{buyer.email}</div>
                        </div>
                      </div>
                    </button>
                  ))}
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
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OfferBuyersPanel;
