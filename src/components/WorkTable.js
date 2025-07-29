import React, { useState, useEffect, useRef } from 'react';
import { tableService, cellService } from '../supabaseClient';
import { RefreshCw, AlertCircle, CheckCircle, Save } from 'lucide-react';

function WorkTable({ user }) {
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const tableRef = useRef(null);
  const realtimeSubscription = useRef(null);

  useEffect(() => {
    if (user?.id) {
      loadUserTable();
    }

    return () => {
      if (realtimeSubscription.current) {
        realtimeSubscription.current.unsubscribe();
      }
    };
  }, [user]);

  const loadUserTable = async () => {
    try {
      setLoading(true);
      const data = await tableService.getUserTable(user.id);
      setTableData(data);
      
      if (data?.id) {
        setupRealtimeSubscription(data.id);
      }
    } catch (error) {
      setError('Ошибка загрузки таблицы: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = (tableId) => {
    if (realtimeSubscription.current) {
      realtimeSubscription.current.unsubscribe();
    }

    realtimeSubscription.current = cellService.subscribeToTableChanges(
      tableId,
      (payload) => {
        console.log('Real-time update:', payload);
        // Здесь можно обновить конкретные ячейки в таблице
        refreshTable();
      }
    );
  };

  const refreshTable = async () => {
    if (tableData?.id) {
      try {
        const cells = await cellService.getTableCells(tableData.id);
        // Обновить таблицу с новыми данными ячеек
        updateTableWithCells(cells);
      } catch (error) {
        console.error('Error refreshing table:', error);
      }
    }
  };

  const updateTableWithCells = (cells) => {
    // Логика обновления HTML таблицы с данными из ячеек
    if (tableRef.current && cells.length > 0) {
      const table = tableRef.current.querySelector('table');
      if (table) {
        cells.forEach(cell => {
          const row = table.rows[cell.row_index];
          if (row && row.cells[cell.column_index]) {
            row.cells[cell.column_index].textContent = cell.value;
          }
        });
      }
    }
  };

  const handleCellEdit = async (rowIndex, columnIndex, newValue) => {
    if (!tableData?.id) return;

    try {
      await cellService.updateCell(tableData.id, rowIndex, columnIndex, newValue);
      setLastSaved(new Date());
    } catch (error) {
      setError('Ошибка сохранения ячейки: ' + error.message);
    }
  };

  const makeTableEditable = () => {
    if (!tableRef.current) return;

    const table = tableRef.current.querySelector('table');
    if (!table) return;

    // Делаем все ячейки редактируемыми
    const cells = table.querySelectorAll('td');
    cells.forEach((cell, index) => {
      cell.contentEditable = true;
      cell.style.cursor = 'text';
      cell.style.minHeight = '20px';
      
      cell.addEventListener('blur', async (e) => {
        const rowIndex = e.target.parentNode.rowIndex;
        const columnIndex = e.target.cellIndex;
        const newValue = e.target.textContent;
        
        await handleCellEdit(rowIndex, columnIndex, newValue);
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.target.blur();
        }
      });
    });
  };

  useEffect(() => {
    if (tableData?.html_content && tableRef.current) {
      setTimeout(() => {
        makeTableEditable();
      }, 100);
    }
  }, [tableData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка таблицы...</p>
        </div>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Таблица не найдена
          </h3>
          <p className="text-gray-600 mb-4">
            Тим лид еще не загрузил рабочую таблицу для вашего аккаунта. 
            Обратитесь к администратору для настройки таблицы.
          </p>
          <button
            onClick={loadUserTable}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Рабочая таблица
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {user?.name} • Обновлено: {new Date(tableData.updated_at).toLocaleString('ru-RU')}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {lastSaved && (
              <div className="flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Сохранено {lastSaved.toLocaleTimeString('ru-RU')}
              </div>
            )}
            <button
              onClick={refreshTable}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* CSS Styles */}
            {tableData.css_content && (
              <style dangerouslySetInnerHTML={{ __html: tableData.css_content }} />
            )}
            
            {/* HTML Content */}
            <div 
              ref={tableRef}
              className="table-container p-4"
              dangerouslySetInnerHTML={{ __html: tableData.html_content }}
              style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
                lineHeight: '1.4'
              }}
            />
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Нажмите на любую ячейку для редактирования. 
              Изменения сохраняются автоматически при потере фокуса.
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Status */}
      <div className="border-t border-gray-200 px-6 py-3 bg-gray-50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Подключение к реальному времени активно
          </div>
          <div className="text-gray-500">
            ID таблицы: {tableData.id}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkTable;