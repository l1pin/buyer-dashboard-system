import React, { useState, useEffect } from 'react';
import { tableService, userService } from '../supabaseClient';
import { 
  Eye, 
  Upload, 
  RefreshCw, 
  AlertCircle, 
  Users, 
  Table,
  Calendar,
  Search,
  FileText,
  User
} from 'lucide-react';

function AdminPanel({ user }) {
  const [buyers, setBuyers] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingFor, setUploadingFor] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [buyersData, tablesData] = await Promise.all([
        userService.getAllBuyers(),
        tableService.getAllTables()
      ]);
      
      setBuyers(buyersData);
      setTables(tablesData);
    } catch (error) {
      setError('Ошибка загрузки данных: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (buyerId, files) => {
    if (!files || files.length === 0) return;

    try {
      setUploadingFor(buyerId);
      
      const htmlFile = Array.from(files).find(file => file.name.endsWith('.html'));
      const cssFile = Array.from(files).find(file => file.name.endsWith('.css'));

      if (!htmlFile) {
        throw new Error('HTML файл не найден');
      }

      const htmlContent = await readFileContent(htmlFile);
      const cssContent = cssFile ? await readFileContent(cssFile) : '';

      await tableService.saveUserTable(buyerId, htmlContent, cssContent);
      
      // Обновляем данные
      await loadData();
      
      setError('');
    } catch (error) {
      setError('Ошибка загрузки файлов: ' + error.message);
    } finally {
      setUploadingFor(null);
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsText(file);
    });
  };

  const getBuyerTable = (buyerId) => {
    return tables.find(table => table.user_id === buyerId);
  };

  const filteredBuyers = buyers.filter(buyer =>
    buyer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    buyer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (selectedBuyer) {
    const buyerTable = getBuyerTable(selectedBuyer.id);
    
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedBuyer(null)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Назад
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Таблица: {selectedBuyer.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedBuyer.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {buyerTable ? (
            <div className="p-6">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                {buyerTable.css_content && (
                  <style dangerouslySetInnerHTML={{ __html: buyerTable.css_content }} />
                )}
                <div 
                  className="table-container p-4"
                  dangerouslySetInnerHTML={{ __html: buyerTable.html_content }}
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.4'
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Таблица не загружена
                </h3>
                <p className="text-gray-600">
                  Для этого байера еще не загружена рабочая таблица.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Таблицы байеров
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Управление рабочими таблицами пользователей
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Поиск по имени или email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Всего байеров
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {buyers.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Table className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Таблиц загружено
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {tables.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Без таблиц
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {buyers.length - tables.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buyers List */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Список байеров
            </h3>
            
            {filteredBuyers.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Байеры не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBuyers.map((buyer) => {
                  const buyerTable = getBuyerTable(buyer.id);
                  const isUploading = uploadingFor === buyer.id;
                  
                  return (
                    <div
                      key={buyer.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {buyer.name}
                          </h4>
                          <p className="text-sm text-gray-500 truncate">
                            {buyer.email}
                          </p>
                          <div className="mt-2 flex items-center text-xs text-gray-400">
                            <Calendar className="h-3 w-3 mr-1" />
                            Создан: {formatDate(buyer.created_at)}
                          </div>
                          {buyerTable && (
                            <div className="mt-1 flex items-center text-xs text-gray-400">
                              <Table className="h-3 w-3 mr-1" />
                              Обновлена: {formatDate(buyerTable.updated_at)}
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-4 flex-shrink-0">
                          {buyerTable ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Загружена
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Не загружена
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 flex space-x-2">
                        {buyerTable && (
                          <button
                            onClick={() => setSelectedBuyer(buyer)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Просмотр
                          </button>
                        )}
                        
                        <label className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer">
                          {isUploading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                              Загрузка...
                            </>
                          ) : (
                            <>
                              <Upload className="h-3 w-3 mr-1" />
                              {buyerTable ? 'Обновить' : 'Загрузить'}
                            </>
                          )}
                          <input
                            type="file"
                            multiple
                            accept=".html,.css"
                            onChange={(e) => handleFileUpload(buyer.id, e.target.files)}
                            className="sr-only"
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;