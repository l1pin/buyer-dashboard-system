// src/components/OfferStatusBadge.js
import React, { useState, useRef, useEffect } from 'react';
import { offerStatusService } from '../supabaseClient';

/**
 * Компонент для отображения и изменения статуса оффера
 * Показывает цветной кружок с текстом статуса и dropdown меню для изменения
 */
function OfferStatusBadge({ offerId, article, offerName, currentStatus, onStatusChange, userName = 'User' }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const dropdownRef = useRef(null);

  const availableStatuses = offerStatusService.getAvailableStatuses();
  const statusConfig = offerStatusService.getStatusColor(currentStatus || 'Активный');

  // Закрываем dropdown при клике вне его области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleStatusClick = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) {
      setIsDropdownOpen(false);
      return;
    }

    try {
      setIsUpdating(true);

      // Обновляем статус через API
      await offerStatusService.upsertOfferStatus(
        offerId,
        newStatus,
        article,
        offerName,
        userName,
        null
      );

      // Вызываем callback для обновления UI родительского компонента
      if (onStatusChange) {
        onStatusChange(offerId, newStatus);
      }

      setIsDropdownOpen(false);

    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      alert('Ошибка обновления статуса: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Кнопка-кружок со статусом */}
      <button
        onClick={handleStatusClick}
        disabled={isUpdating}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:opacity-80 disabled:opacity-50 ${statusConfig.color} ${statusConfig.textColor}`}
        title={`Статус: ${currentStatus || 'Активный'}. Нажмите для изменения`}
      >
        {/* Цветной кружок */}
        <span className={`w-2 h-2 rounded-full ${statusConfig.textColor === 'text-white' ? 'bg-white' : 'bg-gray-800'}`}></span>

        {/* Текст статуса */}
        <span>{currentStatus || 'Активный'}</span>

        {/* Стрелка вниз */}
        {!isUpdating && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}

        {/* Лоадер при обновлении */}
        {isUpdating && (
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        )}
      </button>

      {/* Dropdown меню */}
      {isDropdownOpen && (
        <div className="absolute z-50 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-200">
            Изменить статус
          </div>
          {availableStatuses.map((status) => (
            <button
              key={status.value}
              onClick={() => handleStatusChange(status.value)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                currentStatus === status.value ? 'bg-gray-100' : ''
              }`}
            >
              {/* Цветной кружок */}
              <span className={`w-3 h-3 rounded-full ${status.color}`}></span>

              {/* Название статуса */}
              <span className="text-gray-900">{status.label}</span>

              {/* Галочка для текущего статуса */}
              {currentStatus === status.value && (
                <svg className="w-4 h-4 ml-auto text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default OfferStatusBadge;
