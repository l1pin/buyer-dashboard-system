// src/components/OfferBuyersPanel.js
import React, { useState } from 'react';
import { FacebookIcon, GoogleIcon, TiktokIcon } from './SourceIcons';
import { Plus, X } from 'lucide-react';

function OfferBuyersPanel({ offer, allBuyers = [] }) {
  const [assignedBuyers, setAssignedBuyers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const [availableBuyers, setAvailableBuyers] = useState([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  const handleAddBuyer = async (source) => {
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
  };

  const handleSelectBuyer = (buyer) => {
    const newAssignment = {
      id: Date.now(), // Временный ID
      source: selectedSource,
      buyer: buyer,
      offer_id: offer.id
    };

    setAssignedBuyers([...assignedBuyers, newAssignment]);
    setShowModal(false);
    setSelectedSource(null);
  };

  const handleRemoveBuyer = (assignmentId) => {
    if (!window.confirm('Удалить привязку байера к офферу?')) return;
    setAssignedBuyers(assignedBuyers.filter(b => b.id !== assignmentId));
  };

  // Группируем байеров по источникам
  const buyersBySource = {
    Facebook: assignedBuyers.filter(b => b.source === 'Facebook'),
    Google: assignedBuyers.filter(b => b.source === 'Google'),
    TikTok: assignedBuyers.filter(b => b.source === 'TikTok')
  };

  const SourceSection = ({ source, icon: Icon, buyers }) => {
    return (
      <div className="px-6 py-4">
        {/* Заголовок источника с иконкой и кнопкой добавления */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{source}</h3>
          </div>
          <button
            onClick={() => handleAddBuyer(source)}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
            title={`Добавить байера для ${source}`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Добавить</span>
          </button>
        </div>

        {/* Список привязанных байеров в виде сетки вертикальных карточек */}
        {buyers.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="inline-flex flex-col items-center space-y-2">
              <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-sm">Байеры не привязаны</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {buyers.map((assignment) => (
              <div
                key={assignment.id}
                className="group relative bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
              >
                {/* Кнопка удаления */}
                <button
                  onClick={() => handleRemoveBuyer(assignment.id)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-md transition-all duration-200 z-10"
                  title="Удалить привязку"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Аватар */}
                <div className="flex justify-center mb-3">
                  {assignment.buyer.avatar_url ? (
                    <img
                      src={assignment.buyer.avatar_url}
                      alt={assignment.buyer.name}
                      className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ring-2 ring-gray-100 group-hover:ring-blue-200 transition-all">
                      <span className="text-white text-2xl font-bold">
                        {assignment.buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Имя */}
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900 truncate px-1" title={assignment.buyer.name}>
                    {assignment.buyer.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Единая сплошная панель с разделителями */}
      <div className="mt-3 bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Facebook */}
        <SourceSection
          source="Facebook"
          icon={FacebookIcon}
          buyers={buyersBySource.Facebook}
        />

        {/* Красивый разделитель */}
        <div className="relative px-6 py-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-5 py-2 rounded-full shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full animate-pulse"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Google */}
        <SourceSection
          source="Google"
          icon={GoogleIcon}
          buyers={buyersBySource.Google}
        />

        {/* Красивый разделитель */}
        <div className="relative px-6 py-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-5 py-2 rounded-full shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-full animate-pulse"></div>
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        {/* TikTok */}
        <SourceSection
          source="TikTok"
          icon={TiktokIcon}
          buyers={buyersBySource.TikTok}
        />
      </div>

      {/* Модальное окно выбора байера - современный дизайн */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
            {/* Заголовок с градиентом */}
            <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-indigo-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    {selectedSource === 'Facebook' && <FacebookIcon className="w-6 h-6 text-white" />}
                    {selectedSource === 'Google' && <GoogleIcon className="w-6 h-6 text-white" />}
                    {selectedSource === 'TikTok' && <TiktokIcon className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Выбрать байера
                    </h3>
                    <p className="text-sm text-blue-100">
                      Источник: {selectedSource}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSelectedSource(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Список байеров */}
            <div className="flex-1 overflow-y-auto p-8">
              {loadingBuyers ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                  <p className="mt-4 text-gray-500">Загрузка байеров...</p>
                </div>
              ) : availableBuyers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex flex-col items-center space-y-3">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">
                        Байеры не найдены
                      </p>
                      <p className="text-sm text-gray-500 mt-1 max-w-sm">
                        {assignedBuyers.filter(b => b.source === selectedSource).length > 0
                          ? 'Все подходящие байеры уже привязаны к этому офферу'
                          : `У байеров нет настроенных каналов с источником ${selectedSource}`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableBuyers.map(buyer => (
                    <button
                      key={buyer.id}
                      onClick={() => handleSelectBuyer(buyer)}
                      className="group bg-gradient-to-br from-gray-50 to-white hover:from-blue-50 hover:to-indigo-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-5 transition-all duration-200 text-left hover:shadow-lg hover:scale-105"
                    >
                      <div className="flex flex-col items-center text-center space-y-3">
                        {/* Аватар */}
                        {buyer.avatar_url ? (
                          <img
                            src={buyer.avatar_url}
                            alt={buyer.name}
                            className="w-16 h-16 rounded-full object-cover ring-4 ring-gray-100 group-hover:ring-blue-200 transition-all"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center ring-4 ring-gray-100 group-hover:ring-blue-200 transition-all">
                            <span className="text-white text-2xl font-bold">
                              {buyer.name?.charAt(0)?.toUpperCase() || 'B'}
                            </span>
                          </div>
                        )}

                        {/* Информация */}
                        <div className="flex-1 min-w-0 w-full">
                          <div className="font-semibold text-gray-900 truncate">{buyer.name}</div>
                          <div className="text-sm text-gray-500 truncate mt-1">{buyer.email}</div>
                        </div>

                        {/* Индикатор выбора */}
                        <div className="flex items-center justify-center w-full pt-2 border-t border-gray-200 group-hover:border-blue-300 transition-colors">
                          <span className="text-xs font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
                            Нажмите для выбора
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Футер */}
            <div className="px-8 py-5 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSource(null);
                }}
                className="w-full px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-100 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OfferBuyersPanel;
