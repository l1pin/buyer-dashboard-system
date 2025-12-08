// src/components/MetricsLastUpdateBadge.js
// Компонент для отображения времени последнего обновления метрик
// Использует Realtime подписку для автоматического обновления

import React from 'react';
import { Clock, RefreshCw, Zap } from 'lucide-react';
import { useGlobalMetricsStatus } from '../hooks/useGlobalMetricsStatus';

/**
 * Компонент для отображения статуса последнего обновления метрик
 * Автоматически обновляется через Supabase Realtime
 *
 * @param {boolean} showIcon - показывать иконку часов (по умолчанию true)
 * @param {string} className - дополнительные CSS классы
 */
function MetricsLastUpdateBadge({ showIcon = true, className = '' }) {
  const {
    lastUpdate,
    isAuto,
    status,
    formattedLastUpdate,
    loading,
    isRefreshing // 🔄 Realtime: Флаг обновления данных
  } = useGlobalMetricsStatus();

  // Если нет данных
  if (!lastUpdate && !loading) {
    return null;
  }

  // Если идет обновление (scheduled function работает)
  if (status === 'running') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
        <span className="text-xs text-blue-500">
          Обновление метрик...
        </span>
      </div>
    );
  }

  // 🔄 Realtime: Если данные обновились и идет загрузка из кэша
  if (isRefreshing) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <RefreshCw className="h-3 w-3 text-green-500 animate-spin" />
        <span className="text-xs text-green-500">
          Загрузка обновленных данных...
        </span>
      </div>
    );
  }

  // Формируем текст
  const labelText = isAuto ? 'Обновлено автоматически' : 'Обновлено';

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showIcon && (
        isAuto ? (
          <Zap className="h-3 w-3 text-green-500" />
        ) : (
          <Clock className="h-3 w-3 text-gray-400" />
        )
      )}
      <span className={`text-xs ${isAuto ? 'text-green-600' : 'text-gray-500'}`}>
        {labelText}: {formattedLastUpdate}
      </span>
    </div>
  );
}

export default MetricsLastUpdateBadge;
