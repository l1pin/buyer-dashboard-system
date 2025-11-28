// src/components/OfferStatusBadge.js
import React, { useState, useRef, useEffect } from 'react';
import { offerStatusService } from '../services/OffersSupabase';
import Portal from './Portal';

/**
 * Компонент для отображения и изменения статуса оффера
 * Показывает только цветной кружок и количество дней в этом статусе
 * @param {boolean} readOnly - если true, статус нельзя изменить (только просмотр)
 */
function OfferStatusBadge({ offerId, article, offerName, currentStatus, daysInStatus, onStatusChange, userName = 'User', userId = null, readOnly = false }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

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
    if (readOnly) return; // Не открываем dropdown в режиме только чтения

    if (!isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }

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
        userId,
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
      {/* Кружок со статусом + дни */}
      <button
        ref={buttonRef}
        onClick={handleStatusClick}
        disabled={isUpdating || readOnly}
        className={`inline-flex items-center gap-2 transition-all duration-200 disabled:opacity-50 ${readOnly ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'}`}
        title={readOnly
          ? `Статус: ${currentStatus || 'Активный'}. ${daysInStatus || 0} дней`
          : `Статус: ${currentStatus || 'Активный'}. ${daysInStatus || 0} дней. Нажмите для изменения`
        }
      >
        {/* Цветной кружок */}
        {!isUpdating ? (
          <span className={`w-4 h-4 rounded-full ${statusConfig.color} shadow-sm border border-white`}></span>
        ) : (
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        )}

        {/* Количество дней */}
        <span className="text-xs font-medium text-gray-700">
          {daysInStatus !== null && daysInStatus !== undefined ? `${daysInStatus}д` : '—'}
        </span>
      </button>

      {/* Dropdown меню (не показываем в readOnly режиме) */}
      {isDropdownOpen && !readOnly && (
        <Portal>
          <div
            className="fixed z-50 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
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
        </Portal>
      )}
    </div>
  );
}

export default OfferStatusBadge;
