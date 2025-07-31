import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { tableService, cellService } from '../supabaseClient';
import { RefreshCw, AlertCircle, CheckCircle, Save, Download, Upload, User } from 'lucide-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function WorkTable({ user }) {
  const [tableData, setTableData] = useState(null);
  const [gridData, setGridData] = useState({ columnDefs: [], rowData: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const gridRef = useRef(null);
  const realtimeSubscription = useRef(null);

  // Дефолтные настройки AG Grid
  const defaultColDef = {
    editable: true,
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
    flex: 1,
    cellClass: 'cell-wrap-text',
    cellStyle: { 
      fontSize: '11px',
      lineHeight: '1.2',
      padding: '2px 4px',
      whiteSpace: 'normal',
      wordWrap: 'break-word',
      display: 'flex',
      alignItems: 'center'
    },
    headerClass: 'ag-header-cell-custom'
  };

  const gridOptions = {
    defaultColDef,
    suppressRowClickSelection: true,
    enableRangeSelection: true,
    enableFillHandle: true,
    undoRedoCellEditing: true,
    undoRedoCellEditingLimit: 20,
    enableCellTextSelection: true,
    suppressScrollOnNewData: true,
    animateRows: false,
    rowHeight: 28,
    headerHeight: 32,
    domLayout: 'normal'
  };

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
      setError('');
      
      const data = await tableService.getUserTable(user.id);
      setTableData(data);
      
      if (data?.id) {
        await loadGridData(data.id);
        setupRealtimeSubscription(data.id);
      }
    } catch (error) {
      setError('Ошибка загрузки таблицы: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGridData = async (tableId) => {
    try {
      const { columnDefs, rowData } = await cellService.getTableDataForGrid(tableId);
      setGridData({ columnDefs, rowData });
    } catch (error) {
      setError('Ошибка загрузки данных таблицы: ' + error.message);
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
        
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const { row_index, column_index, value } = payload.new;
          
          // Обновляем сетку только если изменение пришло не от текущего пользователя
          setTimeout(() => {
            updateGridCell(row_index, column_index, value);
          }, 100);
        }
      }
    );
  };

  const updateGridCell = useCallback((rowIndex, columnIndex, newValue) => {
    if (!gridRef.current) return;

    try {
      const gridApi = gridRef.current.api;
      const adjustedRowIndex = rowIndex - 1; // -1 потому что первая строка - заголовки
      
      if (adjustedRowIndex >= 0) {
        const rowNode = gridApi.getRowNode(adjustedRowIndex);
        
        if (rowNode) {
          const field = `col_${columnIndex}`;
          const currentData = { ...rowNode.data };
          currentData[field] = newValue;
          
          // Обновляем данные без вызова событий
          rowNode.setData(currentData);
          
          // Принудительно обновляем отображение
          gridApi.refreshCells({ 
            rowNodes: [rowNode], 
            columns: [field],
            force: true 
          });
        }
      }
    } catch (error) {
      console.error('Error updating grid cell:', error);
    }
  }, []);

  const onCellValueChanged = useCallback(async (event) => {
    if (!tableData?.id || event.newValue === event.oldValue) return;

    // Показываем "Сохранение..." только при фактическом изменении
    setHasUnsavedChanges(true);

    try {
      const { rowIndex, colDef, newValue } = event;
      const actualRowIndex = rowIndex + 1; // +1 потому что первая строка - заголовки
      
      await cellService.updateCellByField(
        tableData.id, 
        actualRowIndex, 
        colDef.field, 
        newValue || ''
      );
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      setError(''); // Очищаем ошибки
    } catch (error) {
      setError('Ошибка сохранения: ' + error.message);
      // Откатываем изменение в случае ошибки
      event.node.setDataValue(event.colDef.field, event.oldValue);
      setHasUnsavedChanges(false);
    }
  }, [tableData]);

  const onCellEditingStarted = useCallback(() => {
    // Не устанавливаем hasUnsavedChanges сразу при начале редактирования
    // Только при реальном изменении значения
  }, []);

  const onCellEditingStopped = useCallback(() => {
    // Сбрасываем состояние несохраненных изменений после окончания редактирования
    setHasUnsavedChanges(false);
  }, []);

  const handleRefreshTable = async () => {
    if (tableData?.id) {
      await loadGridData(tableData.id);
    }
  };

  const handleExportCSV = () => {
    if (gridRef.current) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `${user.name}_table_${new Date().toISOString().split('T')[0]}.csv`,
        columnSeparator: ';'
      });
    }
  };

  const handleUploadCSV = async (files) => {
    if (!files || files.length === 0) return;

    const csvFile = Array.from(files).find(file => 
      file.name.endsWith('.csv') || file.type === 'text/csv'
    );

    if (!csvFile) {
      setError('Пожалуйста, выберите CSV файл');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const csvContent = await readFileContent(csvFile);
      await tableService.createTableFromCSV(user.id, csvContent);
      
      await loadUserTable();
      setLastSaved(new Date());
    } catch (error) {
      setError('Ошибка загрузки CSV: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsText(file, 'UTF-8');
    });
  };

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
            Вы можете загрузить свою таблицу или обратиться к администратору.
          </p>
          <div className="space-x-3">
            <button
              onClick={loadUserTable}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </button>
            
            <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              Загрузить CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleUploadCSV(e.target.files)}
                className="sr-only"
                disabled={saving}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* AG Grid Styles */}
      <style>{`
        .ag-theme-alpine {
          --ag-background-color: #ffffff;
          --ag-header-background-color: #f8fafc;
          --ag-odd-row-background-color: #f9fafb;
          --ag-border-color: #e5e7eb;
          --ag-font-size: 11px;
          --ag-font-family: 'Inter', sans-serif;
        }
        .ag-cell-edit-input {
          font-size: 11px !important;
          border: 2px solid #3b82f6 !important;
        }
        .ag-cell-focus {
          border: 2px solid #3b82f6 !important;
        }
        .ag-cell-range-selected {
          background-color: #dbeafe !important;
        }
        .ag-cell-data-changed {
          background-color: #fef3c7 !important;
          animation: ag-data-changed-flash 1s;
        }
        @keyframes ag-data-changed-flash {
          0% { background-color: #fbbf24; }
          100% { background-color: #fef3c7; }
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center ${user?.avatar_url ? 'hidden' : ''}`}>
                <User className="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Рабочая таблица
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name} • Обновлено: {new Date(tableData.updated_at).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {lastSaved && !hasUnsavedChanges && (
              <div className="flex items-center text-sm text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Сохранено {lastSaved.toLocaleTimeString('ru-RU')}
              </div>
            )}
            
            {hasUnsavedChanges && (
              <div className="flex items-center text-sm text-yellow-600">
                <Save className="h-4 w-4 mr-1" />
                Сохранение...
              </div>
            )}
            
            <button
              onClick={handleExportCSV}
              disabled={!gridData.rowData.length}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт
            </button>
            
            <label className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Загрузка...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Загрузить CSV
                </>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleUploadCSV(e.target.files)}
                className="sr-only"
                disabled={saving}
              />
            </label>

            <button
              onClick={handleRefreshTable}
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
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex-shrink-0">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* AG Grid Container */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="ag-theme-alpine h-full w-full border border-gray-200 rounded-lg shadow-sm">
          <AgGridReact
            ref={gridRef}
            columnDefs={gridData.columnDefs}
            rowData={gridData.rowData}
            gridOptions={gridOptions}
            onCellValueChanged={onCellValueChanged}
            onCellEditingStarted={onCellEditingStarted}
            onCellEditingStopped={onCellEditingStopped}
            suppressLoadingOverlay={true}
            stopEditingWhenGridLosesFocus={true}
            suppressPropertyNamesCheck={true}
            loadingOverlayComponent={() => (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}
          />
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Нажмите на ячейку для редактирования. Изменения сохраняются автоматически.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WorkTable;