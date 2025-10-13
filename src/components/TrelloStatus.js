// src/components/TrelloStatus.js
// Компонент для отображения статуса карточки Trello

import React from 'react';
import { ExternalLink } from 'lucide-react';

function TrelloStatus({ trelloLink, status, loading }) {
  if (!trelloLink) {
    return <span className="text-gray-400 text-xs">—</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <a
        href={trelloLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 border border-gray-300 text-xs font-medium rounded-md shadow-sm text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        title="Статус недоступен"
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Карточка
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <a
        href={trelloLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Карточка
      </a>
      
      <div
        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300"
        title={`Колонка: ${status.listName}`}
      >
        <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></div>
        <span className="truncate max-w-[120px]">{status.listName}</span>
      </div>
    </div>
  );
}

export default TrelloStatus;
