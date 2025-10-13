// src/components/TrelloStatus.js
// Компонент для отображения статуса карточки Trello + анимация изменений

import React from 'react';
import { ExternalLink } from 'lucide-react';

function TrelloStatus({ trelloLink, status, loading, isChanged }) {
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
      
        href={trelloLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Карточка
      </a>
      
      <div
        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border transition-all duration-500 ${
          isChanged 
            ? 'bg-green-100 text-green-800 border-green-300 animate-pulse shadow-lg' 
            : 'bg-gray-100 text-gray-800 border-gray-300'
        }`}
        title={`Колонка: ${status.listName}${isChanged ? ' (только что изменено!)' : ''}`}
      >
        <div className={`w-2 h-2 rounded-full mr-1.5 ${isChanged ? 'bg-green-500' : 'bg-blue-500'}`}></div>
        <span className="truncate max-w-[120px]">{status.listName}</span>
        {isChanged && (
          <svg className="ml-1 h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default TrelloStatus;
