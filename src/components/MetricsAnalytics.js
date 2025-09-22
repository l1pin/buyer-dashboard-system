// Исправленный MetricsAnalytics.js с улучшенной обработкой больших файлов
// Замените содержимое src/components/MetricsAnalytics.js

import React, { useState, useEffect } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
import { metricsDebugger } from '../utils/debugMetricsUpload';
import Papa from 'papaparse';
import { 
  Upload,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  DollarSign,
  Activity,
  BarChart3,
  Info,
  X,
  Eye,
  Loader,
  Bug,
  Play
} from 'lucide-react';

function MetricsAnalytics({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);

  // Определение колонок для отображения
  const columns = [
    { key: 'id', label: '№', type: 'number', width: '60px' },
    { key: 'article', label: 'Артикул', type: 'text', width: '120px' },
    { key: 'offer', label: 'Оффер', type: 'text', width: '150px' },
    { key: 'total_batches', label: 'Всего партий', type: 'number', width: '100px' },
    { key: 'first_arrival_date', label: 'Первый приход', type: 'date', width: '120px' },
    { key: 'next_calculated_arrival', label: 'Расчетный приход', type: 'date', width: '130px' },
    { key: 'special_season_start', label: 'Спец сезон начало', type: 'date', width: '130px' },
    { key: 'special_season_end', label: 'Спец сезон конец', type: 'date', width: '130px' },
    { key: 'offer_price', label: 'Цена оффера', type: 'currency_uah', width: '110px' },
    { key: 'red_zone_price', label: 'Красная зона', type: 'currency', width: '110px' },
    { key: 'pink_zone_price', label: 'Розовая зона', type: 'currency', width: '110px' },
    { key: 'gold_zone_price', label: 'Золотая зона', type: 'currency', width: '110px' },
    { key: 'green_zone_price', label: 'Зеленая зона', type: 'currency', width: '110px' },
    { key: 'offer_zone', label: 'Зона оффера', type: 'zone', width: '120px' },
    { key: 'actual_lead', label: 'Факт лид', type: 'currency_or_text', width: '100px' },
    { key: 'actual_roi_percent', label: 'Факт ROI %', type: 'percentage', width: '100px' },
    { key: 'depth_selection', label: 'Глубина', type: 'percentage', width: '90px' },
    { key: 'high_stock_high_mcpl', label: 'Большой остаток', type: 'text', width: '120px' },
    { key: 'trend_10_days', label: 'Тренд 10 дней', type: 'text', width: '120px' },
    { key: 'trend_3_days', label: 'Тренд 3 дня', type: 'text', width: '120px' },
    { key: 'refusal_sales_percent', label: '% отказ/продажи', type: 'percentage', width: '120px' },
    { key: 'k_lead', label: 'К лид', type: 'number', width: '80px' },
    { key: 'no_pickup_percent', label: '% невыкупа', type: 'percentage', width: '100px' },
    { key: 'for_withdrawal', label: 'На вывод', type: 'text', width: '100px' },
    { key: 'currently_unprofitable', label: 'Убыточные', type: 'text', width: '100px' }
  ];

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📊 Загружаем метрики аналитики...');
      
      const data = await metricsAnalyticsService.getAllMetrics();
      setMetrics(data.metrics || []);
      setLastUpdated(data.lastUpdated);
      
      console.log(`✅ Загружено ${data.metrics?.length || 0} записей метрик`);
    } catch (error) {
      console.error('❌ Ошибка загрузки метрик:', error);
      setError('Ошибка загрузки метрик: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileDiagnosis = async (files) => {
    if (!files || files.length === 0) return;

    const csvFile = Array.from(files).find(file => 
      file.name.endsWith('.csv') || file.type === 'text/csv'
    );

    if (!csvFile) {
      setError('Пожалуйста, выберите CSV файл для диагностики');
      return;
    }

    try {
      setDiagnosing(true);
      setError('');
      setSuccess('');

      console.log('🔍 Запускаем диагностику файла:', csvFile.name);
      
      const report = await metricsDebugger.runFullDiagnosis(csvFile);
      setDiagnosticReport(report);
      setShowDiagnosticModal(true);

      if (report.summary.success) {
        setSuccess('✅ Диагностика прошла успешно - файл готов к загрузке');
      } else {
        setError(`❌ Обнаружены проблемы: ${report.summary.errorsCount} ошибок`);
      }

    } catch (error) {
      console.error('❌ Ошибка диагностики:', error);
      setError('Ошибка диагностики: ' + error.message);
    } finally {
      setDiagnosing(false);
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    const csvFile = Array.from(files).find(file => 
      file.name.endsWith('.csv') || file.type === 'text/csv'
    );

    if (!csvFile) {
      setError('Пожалуйста, выберите CSV файл');
      return;
    }

    try {
      setUploading(true);
      setError('');
      setSuccess('');
      setUploadProgress({ current: 0, total: 0, percentage: 0 });

      console.log('📁 Начинаем обработку файла:', csvFile.name, 'размер:', csvFile.size);

      // Читаем CSV файл
      const csvContent = await readFileContent(csvFile);
      console.log('📖 Файл прочитан, размер содержимого:', csvContent.length);
      
      // Парсим CSV
      const parsedData = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });

      console.log('📊 CSV распарсен:', {
        totalRows: parsedData.data.length,
        hasErrors: parsedData.errors.length > 0,
        firstRowLength: parsedData.data[0]?.length || 0
      });

      if (!parsedData.data || parsedData.data.length < 2) {
        throw new Error('CSV файл должен содержать заголовки и данные');
      }

      // Показываем ошибки парсинга если есть
      if (parsedData.errors.length > 0) {
        console.warn('⚠️ Ошибки парсинга CSV:', parsedData.errors);
      }

      // Проверяем количество колонок (берем 4-ю строку как эталон)
      if (parsedData.data.length < 4) {
        throw new Error('CSV файл должен содержать минимум 4 строки');
      }
      
      const headerRow = parsedData.data[3]; // 4-я строка как заголовки
      if (headerRow.length < 25) {
        throw new Error(`CSV файл должен содержать 25 колонок, найдено: ${headerRow.length}`);
      }

      // Преобразуем данные в объекты, начиная с 5-й строки (индекс 4)
      const dataRows = parsedData.data.slice(4); // Пропускаем первые 4 строки
      console.log(`🔄 Обрабатываем ${dataRows.length} строк данных...`);

      setUploadProgress({ 
        current: 0, 
        total: dataRows.length, 
        percentage: 0 
      });

      const processedMetrics = [];
      const batchSize = 50; // Уменьшили размер батча для лучшей надежности
      
      // Обрабатываем данные батчами с прогрессом
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        batch.forEach(row => {
          try {
            const processedRow = processCSVRow(row);
            if (processedRow) {
              processedMetrics.push(processedRow);
            }
          } catch (error) {
            console.warn(`⚠️ Ошибка обработки строки ${i + processedMetrics.length}:`, error);
          }
        });

        // Обновляем прогресс
        const processed = Math.min(i + batchSize, dataRows.length);
        const percentage = Math.round((processed / dataRows.length) * 100);
        setUploadProgress({ 
          current: processed, 
          total: dataRows.length, 
          percentage 
        });

        // Небольшая пауза для UI
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ Обработано ${processedMetrics.length} записей из ${dataRows.length}`);

      if (processedMetrics.length === 0) {
        throw new Error('Не удалось обработать ни одной записи из CSV');
      }

      // Сохраняем в базу данных с улучшенной обработкой ошибок
      console.log('💾 Сохраняем данные в базу...');
      const uploadResult = await metricsAnalyticsService.uploadMetricsWithProgress(
        processedMetrics,
        (progress) => {
          setUploadProgress({
            current: progress.processed,
            total: progress.total,
            percentage: Math.round((progress.processed / progress.total) * 100),
            stage: 'Загрузка в базу данных'
          });
        }
      );

      console.log('✅ Данные сохранены в базу:', uploadResult);

      // Обновляем список
      await loadMetrics();
      
      setSuccess(`✅ Успешно загружено ${processedMetrics.length} записей метрик из ${dataRows.length} строк CSV`);
      setUploadProgress({ current: 0, total: 0, percentage: 0 });

    } catch (error) {
      console.error('❌ Ошибка загрузки CSV:', error);
      setError('Ошибка загрузки CSV: ' + error.message);
      setUploadProgress({ current: 0, total: 0, percentage: 0 });
    } finally {
      setUploading(false);
    }
  };

  const processCSVRow = (row) => {
    if (!row || row.length < 25) {
      console.warn('⚠️ Неполная строка данных:', row?.length || 0, 'колонок');
      return null;
    }

    const parseDate = (dateStr) => {
      if (!dateStr || dateStr.trim() === '') return null;
      
      // Парсим дату в формате DD.MM.YYYY
      const parts = dateStr.trim().split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
        const year = parseInt(parts[2]);
        
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0]; // Возвращаем в формате YYYY-MM-DD
          }
        }
      }
      return null;
    };

    const parseNumber = (str) => {
      if (!str || str.trim() === '' || str.toLowerCase() === 'нет данных') return null;
      const num = parseFloat(str.replace(',', '.').replace(/[^\d.-]/g, ''));
      return isNaN(num) ? null : num;
    };

    const parseInt = (str) => {
      if (!str || str.trim() === '') return null;
      const num = Number.parseInt(str.replace(/[^\d-]/g, ''));
      return isNaN(num) ? null : num;
    };

    try {
      return {
        id: parseInt(row[0]) || null,
        article: (row[1] || '').toString().trim(),
        offer: (row[2] || '').toString().trim(),
        total_batches: parseInt(row[3]) || null,
        first_arrival_date: parseDate(row[4]),
        next_calculated_arrival: parseDate(row[5]),
        special_season_start: parseDate(row[6]),
        special_season_end: parseDate(row[7]),
        offer_price: parseNumber(row[8]),
        red_zone_price: parseNumber(row[9]),
        pink_zone_price: parseNumber(row[10]),
        gold_zone_price: parseNumber(row[11]),
        green_zone_price: parseNumber(row[12]),
        offer_zone: (row[13] || '').toString().trim(),
        actual_lead: row[14] === 'нет данных' ? 'нет данных' : parseNumber(row[14]),
        actual_roi_percent: parseNumber(row[15]),
        depth_selection: parseNumber(row[16]),
        high_stock_high_mcpl: (row[17] || '').toString().trim(),
        trend_10_days: (row[18] || '').toString().trim(),
        trend_3_days: (row[19] || '').toString().trim(),
        refusal_sales_percent: parseNumber(row[20]),
        k_lead: parseNumber(row[21]),
        no_pickup_percent: parseNumber(row[22]),
        for_withdrawal: (row[23] || '').toString().trim(),
        currently_unprofitable: (row[24] || '').toString().trim()
      };
    } catch (error) {
      console.error('❌ Ошибка обработки строки:', error, row);
      return null;
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

  const handleExportCSV = () => {
    if (filteredMetrics.length === 0) {
      setError('Нет данных для экспорта');
      return;
    }

    try {
      console.log('📤 Экспортируем', filteredMetrics.length, 'записей...');
      
      // Создаем CSV данные
      const headers = columns.map(col => col.label);
      const csvData = [
        headers,
        ...filteredMetrics.map(metric => columns.map(col => {
          const value = metric[col.key];
          if (value === null || value === undefined) return '';
          if (col.type === 'date' && value) {
            // Преобразуем дату обратно в DD.MM.YYYY формат
            const date = new Date(value);
            return date.toLocaleDateString('ru-RU');
          }
          return String(value);
        }))
      ];

      const csv = Papa.unparse(csvData, { delimiter: ';' });
      
      // Скачиваем файл
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `metrics_analytics_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ Файл экспортирован');
      setSuccess('Данные успешно экспортированы');
    } catch (error) {
      console.error('❌ Ошибка экспорта:', error);
      setError('Ошибка экспорта: ' + error.message);
    }
  };

  const formatCellValue = (value, type) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>;
    }

    switch (type) {
      case 'currency':
        return <span className="font-mono text-green-600">${Number(value).toFixed(2)}</span>;
      
      case 'currency_uah':
        return <span className="font-mono text-green-600">{Number(value).toFixed(2)} ₴</span>;
      
      case 'currency_or_text':
        if (value === 'нет данных') {
          return <span className="text-gray-500 italic">нет данных</span>;
        }
        return <span className="font-mono text-green-600">${Number(value).toFixed(2)}</span>;
      
      case 'percentage':
        return <span className="font-mono text-blue-600">{Number(value).toFixed(1)}%</span>;
      
      case 'date':
        const date = new Date(value);
        return <span className="text-gray-700">{date.toLocaleDateString('ru-RU')}</span>;
      
      case 'zone':
        return <ZoneBadge zone={value} />;
      
      case 'number':
        return <span className="font-mono">{Number(value).toLocaleString('ru-RU')}</span>;
      
      default:
        return <span>{value}</span>;
    }
  };

  const ZoneBadge = ({ zone }) => {
    const getZoneColor = (zoneName) => {
      const name = zoneName.toLowerCase();
      if (name.includes('красн')) return 'bg-red-100 text-red-800 border-red-200';
      if (name.includes('розов')) return 'bg-pink-100 text-pink-800 border-pink-200';
      if (name.includes('золот')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      if (name.includes('зелен')) return 'bg-green-100 text-green-800 border-green-200';
      return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getZoneColor(zone)}`}>
        {zone}
      </span>
    );
  };

  const formatKyivTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Kiev',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      return new Date(dateString).toLocaleDateString('ru-RU');
    }
  };

  // Фильтрация и сортировка
  const filteredMetrics = metrics.filter(metric => {
    const matchesSearch = searchTerm === '' || 
      metric.article?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      metric.offer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  }).sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStats = () => {
    const totalItems = filteredMetrics.length;
    const withActualLead = filteredMetrics.filter(m => m.actual_lead !== null && m.actual_lead !== 'нет данных').length;
    const avgROI = filteredMetrics.reduce((sum, m) => sum + (m.actual_roi_percent || 0), 0) / totalItems;
    const zones = [...new Set(filteredMetrics.map(m => m.offer_zone).filter(Boolean))];
    
    return { totalItems, withActualLead, avgROI, zones };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка метрик аналитики...</p>
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
              Метрики аналитика
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Загрузка и анализ метрик продуктов и офферов
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm font-medium rounded-md shadow-sm text-yellow-700 bg-yellow-50 hover:bg-yellow-100 cursor-pointer">
              {diagnosing ? (
                <>
                  <Bug className="animate-bounce h-4 w-4 mr-2" />
                  Диагностика...
                </>
              ) : (
                <>
                  <Bug className="h-4 w-4 mr-2" />
                  Диагностика CSV
                </>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleFileDiagnosis(e.target.files)}
                className="sr-only"
                disabled={diagnosing || uploading}
              />
            </label>

            <button
              onClick={() => setShowColumnInfo(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Info className="h-4 w-4 mr-2" />
              Справка
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={filteredMetrics.length === 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт ({filteredMetrics.length})
            </button>
            
            <button
              onClick={loadMetrics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </button>
            
            <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {uploading ? (
                <>
                  <Loader className="animate-spin h-4 w-4 mr-2" />
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
                onChange={(e) => handleFileUpload(e.target.files)}
                className="sr-only"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploading && uploadProgress.total > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              {uploadProgress.stage || 'Обработка данных'}: {uploadProgress.current} / {uploadProgress.total}
            </span>
            <span className="text-sm font-medium text-blue-900">
              {uploadProgress.percentage}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Stats */}
      {metrics.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Всего записей
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {metrics.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Eye className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Отображается
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {filteredMetrics.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Target className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        С данными лидов
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.withActualLead}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Средний ROI
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.avgROI.toFixed(1)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              Последнее обновление: {formatKyivTime(lastUpdated)}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Поиск по артикулу или офферу..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {metrics.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет данных метрик
              </h3>
              <p className="text-gray-600 mb-4">
                Загрузите CSV файл с метриками для начала работы
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map(column => (
                    <th
                      key={column.key}
                      onClick={() => handleSort(column.key)}
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      style={{ minWidth: column.width }}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {sortField === column.key && (
                          <span className="text-blue-500">
                            {sortDirection === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMetrics.map((metric, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {columns.map(column => (
                      <td
                        key={column.key}
                        className="px-3 py-4 whitespace-nowrap text-sm"
                        style={{ minWidth: column.width }}
                      >
                        {formatCellValue(metric[column.key], column.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diagnostic Modal */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white m-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Bug className="h-5 w-5 mr-2 text-yellow-600" />
                Отчет диагностики CSV файла
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => metricsDebugger.exportReport(diagnosticReport)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Экспорт
                </button>
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* Общий статус */}
              <div className={`p-4 rounded-lg border ${
                diagnosticReport.summary.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center">
                  {diagnosticReport.summary.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className={`font-medium ${
                    diagnosticReport.summary.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {diagnosticReport.summary.success ? 'Диагностика успешна' : 'Обнаружены проблемы'}
                  </span>
                </div>
                <div className="mt-2 text-sm">
                  <p>Ошибок: {diagnosticReport.summary.errorsCount}</p>
                  <p>Время выполнения: {diagnosticReport.duration}ms</p>
                </div>
              </div>

              {/* Анализ файла */}
              {diagnosticReport.results.fileAnalysis && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">📁 Анализ CSV файла</h4>
                  {diagnosticReport.results.fileAnalysis.isValid ? (
                    <div className="text-sm text-gray-700">
                      <p>✅ Файл корректный</p>
                      <p>Всего строк: {diagnosticReport.results.fileAnalysis.totalRows}</p>
                      <p>Строк данных: {diagnosticReport.results.fileAnalysis.dataRows}</p>
                      <p>Колонок в заголовке: {diagnosticReport.results.fileAnalysis.headerRow?.length || 0}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-red-700">
                      <p>❌ Файл некорректный</p>
                      <p>Ошибка: {diagnosticReport.results.fileAnalysis.error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Статус БД */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🔌 Подключение к базе данных</h4>
                <div className="text-sm">
                  {diagnosticReport.results.databaseConnection ? (
                    <p className="text-green-700">✅ Подключение работает</p>
                  ) : (
                    <p className="text-red-700">❌ Проблемы с подключением</p>
                  )}
                </div>
              </div>

              {/* Тест вставки */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">🧪 Тест вставки данных</h4>
                <div className="text-sm">
                  {diagnosticReport.results.testInsert ? (
                    <p className="text-green-700">✅ Тест прошел успешно</p>
                  ) : (
                    <p className="text-red-700">❌ Ошибка при тестовой вставке</p>
                  )}
                </div>
              </div>

              {/* Рекомендации */}
              {diagnosticReport.recommendations && diagnosticReport.recommendations.length > 0 && (
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <h4 className="font-medium text-blue-900 mb-2">💡 Рекомендации</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {diagnosticReport.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ошибки */}
              {diagnosticReport.errors && diagnosticReport.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h4 className="font-medium text-red-900 mb-2">❌ Ошибки</h4>
                  <div className="text-sm text-red-800 space-y-2 max-h-32 overflow-y-auto">
                    {diagnosticReport.errors.map((error, index) => (
                      <div key={index} className="border-l-2 border-red-300 pl-2">
                        <p className="font-medium">{error.message}</p>
                        {error.error && (
                          <p className="text-xs opacity-75">{error.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Детальные логи */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">📋 Детальные логи</h4>
                <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 max-h-32 overflow-y-auto font-mono">
                  {diagnosticReport.logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      <span className="text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Диагностика завершена: {new Date(diagnosticReport.timestamp).toLocaleString()}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => metricsDebugger.exportReport(diagnosticReport)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Экспорт отчета
                </button>
                <button
                  onClick={() => setShowDiagnosticModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal - Справка по колонкам */}
      {showColumnInfo && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white m-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Справка по колонкам CSV файла
              </h3>
              <button
                onClick={() => setShowColumnInfo(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {[
                { num: 1, name: '№', desc: 'Порядковый номер (число, целое)' },
                { num: 2, name: 'Артикул', desc: 'Артикул товара (текст)' },
                { num: 3, name: 'Оффер', desc: 'Название оффера (текст)' },
                { num: 4, name: 'Всего было партий', desc: 'Количество партий (число целое)' },
                { num: 5, name: 'Дата первого прихода', desc: 'Дата в формате ДД.ММ.ГГГГ' },
                { num: 6, name: 'Ближайший расчетный приход', desc: 'Дата в формате ДД.ММ.ГГГГ' },
                { num: 7, name: 'СПЕЦ сезон начало', desc: 'Дата в формате ДД.ММ.ГГГГ' },
                { num: 8, name: 'СПЕЦ сезон конец', desc: 'Дата в формате ДД.ММ.ГГГГ' },
                { num: 9, name: 'Цена оффера', desc: 'Цена (число с плавающей точкой)' },
                { num: 10, name: 'Красная зона цена лида', desc: 'Цена лида (число с плавающей точкой)' },
                { num: 11, name: 'Розовая зона цена лида', desc: 'Цена лида (число с плавающей точкой)' },
                { num: 12, name: 'Золотая зона цена лида', desc: 'Цена лида (число с плавающей точкой)' },
                { num: 13, name: 'Зеленая зона цена лида', desc: 'Цена лида (число с плавающей точкой)' },
                { num: 14, name: 'Зона оффера', desc: 'Текущая зона (текст)' },
                { num: 15, name: 'Факт лид', desc: 'Фактическая цена лида или "нет данных"' },
                { num: 16, name: 'Факт ROI %', desc: 'ROI в процентах (число)' },
                { num: 17, name: 'Глубина (выборка)', desc: 'Глубина выборки (число)' },
                { num: 18, name: 'Товары с большим остатком и большим mCPL', desc: 'Отметка "+" (текст)' },
                { num: 19, name: 'Товары которые начали резко проседать/улучшаться (10 дней)', desc: 'Тренд за 10 дней (текст)' },
                { num: 20, name: 'Товары которые начали резко проседать/улучшаться (3 дня)', desc: 'Тренд за 3 дня (текст)' },
                { num: 21, name: '% отказался/продажи', desc: 'Процент отказов (число в %)' },
                { num: 22, name: 'К лид', desc: 'Коэффициент лида (число)' },
                { num: 23, name: '% невыкупа', desc: 'Процент невыкупа (число в %)' },
                { num: 24, name: 'На вывод', desc: 'Статус вывода (текст)' },
                { num: 25, name: 'Убыточные на данный момент', desc: 'Статус убыточности (текст)' }
              ].map(col => (
                <div key={col.num} className="border border-gray-200 rounded p-3">
                  <div className="font-medium text-gray-900">
                    {col.num}. {col.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {col.desc}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>Формат файла:</strong> CSV с разделителем ";" (точка с запятой)
                </p>
                <p className="mb-2">
                  <strong>Кодировка:</strong> UTF-8
                </p>
                <p className="mb-2">
                  <strong>Даты:</strong> Формат ДД.ММ.ГГГГ (например: 27.06.2023)
                </p>
                <p>
                  <strong>Важно:</strong> Файл должен содержать 4 служебные строки в начале, данные начинаются с 5-й строки
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowColumnInfo(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetricsAnalytics;
