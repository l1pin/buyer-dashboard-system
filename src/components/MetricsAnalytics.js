// src/components/MetricsAnalytics.js - ПОЛНАЯ ВЕРСИЯ С ЦВЕТНЫМИ ЗОНАМИ
import React, { useState, useEffect } from 'react';
import { metricsAnalyticsService } from '../supabaseClient';
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
  Database
} from 'lucide-react';

function MetricsAnalytics({ user }) {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showColumnInfo, setShowColumnInfo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loadingStats, setLoadingStats] = useState({
    actualCount: 0,
    totalRecords: 0,
    databaseCount: 0
  });

  // Определение колонок для отображения с цветными зонами
  const columns = [
    { key: 'id', label: '№', type: 'number', width: '60px' },
    { key: 'article', label: 'Артикул', type: 'text', width: '120px' },
    { key: 'offer', label: 'Оффер', type: 'text', width: '150px' },
    { key: 'total_batches', label: 'Всего партий', type: 'number', width: '100px' },
    { key: 'first_arrival_date', label: 'Первый приход', type: 'date', width: '120px' },
    { key: 'next_calculated_arrival', label: 'Расчетный приход', type: 'date', width: '130px' },
    { key: 'special_season_start', label: 'Спец сезон начало', type: 'text', width: '130px' },
    { key: 'special_season_end', label: 'Спец сезон конец', type: 'text', width: '130px' },
    { key: 'offer_price', label: 'Цена оффера', type: 'currency_uah_plain', width: '110px' },
    { key: 'red_zone_price', label: 'Красная зона', type: 'red_zone_currency', width: '110px', zoneType: 'red' },
    { key: 'pink_zone_price', label: 'Розовая зона', type: 'pink_zone_currency', width: '110px', zoneType: 'pink' },
    { key: 'gold_zone_price', label: 'Золотая зона', type: 'gold_zone_currency', width: '110px', zoneType: 'gold' },
    { key: 'green_zone_price', label: 'Зеленая зона', type: 'green_zone_currency', width: '110px', zoneType: 'green' },
    { key: 'offer_zone', label: 'Зона оффера', type: 'zone', width: '120px' },
    { key: 'actual_lead', label: 'Факт лид', type: 'zone_styled_currency', width: '100px' },
    { key: 'actual_roi_percent', label: 'Факт ROI %', type: 'zone_styled_percentage', width: '100px' },
    { key: 'depth_selection', label: 'Глубина', type: 'depth_percentage', width: '90px' },
    { key: 'high_stock_high_mcpl', label: 'Большой остаток', type: 'text', width: '120px' },
    { key: 'trend_10_days', label: 'Тренд 10 дней', type: 'text', width: '120px' },
    { key: 'trend_3_days', label: 'Тренд 3 дня', type: 'text', width: '120px' },
    { key: 'refusal_sales_percent', label: '% отказ/продажи', type: 'percentage', width: '120px' },
    { key: 'k_lead', label: 'К лид', type: 'number', width: '80px' },
    { key: 'no_pickup_percent', label: '% невыкупа', type: 'percentage_black', width: '100px' },
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
      
      console.log('🔄 Начинаем загрузку метрик...');
      
      // Используем новый метод для больших таблиц
      const data = await metricsAnalyticsService.getAllMetricsLarge();
      setMetrics(data.metrics || []);
      setLastUpdated(data.lastUpdated);
      
      // Сохраняем статистику загрузки
      setLoadingStats({
        actualCount: data.actualCount,
        totalRecords: data.totalRecords,
        databaseCount: data.databaseCount || data.actualCount
      });
      
      // Показываем информацию о загруженных записях
      if (data.actualCount !== data.totalRecords && data.totalRecords > 0) {
        setSuccess(`⚠️ Загружено ${data.actualCount.toLocaleString('ru-RU')} записей из ${data.totalRecords.toLocaleString('ru-RU')} в базе данных`);
      } else if (data.actualCount > 0) {
        setSuccess(`✅ Успешно загружено ${data.actualCount.toLocaleString('ru-RU')} записей метрик`);
      }
      
      console.log('📊 Статистика загрузки метрик:', {
        загружено: data.actualCount,
        в_метаданных: data.totalRecords,
        последнее_обновление: data.lastUpdated
      });
      
    } catch (error) {
      console.error('❌ Ошибка загрузки метрик:', error);
      setError('Ошибка загрузки метрик: ' + error.message);
    } finally {
      setLoading(false);
      // Очищаем success сообщение через 5 секунд
      setTimeout(() => setSuccess(''), 5000);
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

      console.log(`📁 Обработка файла: ${csvFile.name} (${(csvFile.size / 1024 / 1024).toFixed(2)} MB)`);

      // Читаем CSV файл
      const csvContent = await readFileContent(csvFile);
      
      // Парсим CSV
      const parsedData = Papa.parse(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimiter: ';'
      });

      if (!parsedData.data || parsedData.data.length < 2) {
        throw new Error('CSV файл должен содержать заголовки и данные');
      }

      console.log(`📋 Всего строк в CSV: ${parsedData.data.length}`);

      // Ищем первую строку с реальными данными (где первая колонка - число)
      let dataStartIndex = -1;
      for (let i = 0; i < parsedData.data.length; i++) {
        const firstCell = parsedData.data[i][0];
        // Проверяем, содержит ли первая ячейка число (а не "—", "Артикул" и т.д.)
        if (firstCell && !isNaN(parseInt(firstCell)) && parseInt(firstCell) > 0) {
          dataStartIndex = i;
          console.log(`✅ Найдена первая строка с данными: строка ${i + 1}, значение: "${firstCell}"`);
          break;
        } else {
          console.log(`⏭️ Пропускаем строку ${i + 1}: "${firstCell}" (не является номером)`);
        }
      }

      if (dataStartIndex === -1) {
        throw new Error('Не удалось найти строки с данными в CSV файле. Проверьте, что первая колонка содержит номера записей.');
      }

      // Проверяем количество колонок в строке с данными
      const dataRow = parsedData.data[dataStartIndex];
      if (dataRow.length < 25) {
        throw new Error(`CSV файл должен содержать 25 колонок, найдено: ${dataRow.length} в строке с данными`);
      }

      // Преобразуем данные в объекты, начиная с найденной строки
      const dataRows = parsedData.data.slice(dataStartIndex);
      console.log(`📊 Обрабатываем ${dataRows.length} строк данных (пропущено ${dataStartIndex} строк заголовков)`);

      const processedMetrics = dataRows.map((row, index) => {
        try {
          return processCSVRow(row);
        } catch (error) {
          console.warn(`⚠️ Ошибка обработки строки ${dataStartIndex + index + 1}:`, error.message);
          return null;
        }
      }).filter(row => row !== null); // Убираем строки с ошибками

      console.log(`📤 Подготовлено к загрузке: ${processedMetrics.length.toLocaleString('ru-RU')} записей`);

      if (processedMetrics.length === 0) {
        throw new Error('Не удалось обработать ни одной строки данных');
      }

      // Сохраняем в базу данных
      const uploadResult = await metricsAnalyticsService.uploadMetrics(processedMetrics);

      // Обновляем список
      await loadMetrics();
      
      if (uploadResult.count === uploadResult.total) {
        setSuccess(`✅ Успешно загружено ${uploadResult.count.toLocaleString('ru-RU')} записей метрик`);
      } else {
        setSuccess(`⚠️ Загружено ${uploadResult.count.toLocaleString('ru-RU')} из ${uploadResult.total.toLocaleString('ru-RU')} записей. Проверьте консоль для деталей.`);
      }
      
    } catch (error) {
      console.error('❌ Ошибка загрузки CSV:', error);
      setError('Ошибка загрузки CSV: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const processCSVRow = (row) => {
    const parseDate = (dateStr) => {
      if (!dateStr || dateStr.trim() === '' || dateStr === '—') return null;
      
      // Парсим дату в формате DD.MM.YYYY
      const parts = dateStr.trim().split('.');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
        const year = parseInt(parts[2]);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900) {
          const date = new Date(year, month, day);
          return date.toISOString().split('T')[0]; // Возвращаем в формате YYYY-MM-DD
        }
      }
      return null;
    };

    const parseNumber = (str) => {
      if (!str || str.trim() === '' || str === '—' || str.toLowerCase() === 'нет данных') return null;
      const num = parseFloat(str.replace(',', '.').replace(/[^\d.-]/g, ''));
      return isNaN(num) ? null : num;
    };

    const cleanText = (str) => {
      if (!str || str === '—') return '';
      return String(str).trim();
    };

    // Проверяем, что у нас достаточно колонок
    if (!row || row.length < 25) {
      throw new Error(`Недостаточно колонок в строке: ${row?.length || 0}, ожидается 25`);
    }

    // Проверяем, что первая колонка содержит число (ID)
    const id = parseInt(row[0]);
    if (isNaN(id) || id <= 0) {
      throw new Error(`Первая колонка должна содержать номер записи, получено: "${row[0]}"`);
    }

    return {
      id: id,
      article: cleanText(row[1]),
      offer: cleanText(row[2]),
      total_batches: parseInt(row[3]) || null,
      first_arrival_date: parseDate(row[4]),
      next_calculated_arrival: parseDate(row[5]),
      special_season_start: cleanText(row[6]),
      special_season_end: cleanText(row[7]),
      offer_price: parseNumber(row[8]),
      red_zone_price: parseNumber(row[9]),
      pink_zone_price: parseNumber(row[10]),
      gold_zone_price: parseNumber(row[11]),
      green_zone_price: parseNumber(row[12]),
      offer_zone: cleanText(row[13]),
      actual_lead: row[14] === 'нет данных' || row[14] === '—' ? 'нет данных' : parseNumber(row[14]),
      actual_roi_percent: parseNumber(row[15]),
      depth_selection: parseNumber(row[16]),
      high_stock_high_mcpl: cleanText(row[17]),
      trend_10_days: cleanText(row[18]),
      trend_3_days: cleanText(row[19]),
      refusal_sales_percent: parseNumber(row[20]),
      k_lead: parseNumber(row[21]),
      no_pickup_percent: parseNumber(row[22]),
      for_withdrawal: cleanText(row[23]),
      currently_unprofitable: cleanText(row[24])
    };
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
  };

  // Функция для получения цветов зон
  const getZoneColors = (zoneName) => {
    if (!zoneName) return null;
    const name = zoneName.toLowerCase();
    if (name.includes('sos')) return { bg: 'bg-black', text: 'text-yellow-400', border: 'border-black' };
    if (name.includes('красн')) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
    if (name.includes('розов')) return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' };
    if (name.includes('золот')) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    if (name.includes('зелен')) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    return null;
  };

  // Функция для получения цветов зон по типу
  const getZoneColorsByType = (zoneType) => {
    switch (zoneType) {
      case 'red': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
      case 'pink': return { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' };
      case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
      case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
      default: return null;
    }
  };

  // Определение стиля зоны на основе значения
  const getZoneStyleFromValue = (value) => {
    if (!value || value <= 0 || isNaN(value)) return null;
    
    // Логика определения зоны на основе значения
    // Это примерная логика, может потребоваться корректировка
    if (value >= 100) return 'green';
    if (value >= 75) return 'gold';
    if (value >= 50) return 'pink';
    return 'red';
  };

  const formatCellValue = (value, type, metric = null) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">—</span>;
    }

    switch (type) {
      case 'currency':
        return <span className="font-mono font-bold text-green-600">${Number(value).toFixed(2)}</span>;
      
      case 'currency_uah_plain':
        return <span className="font-mono font-bold text-gray-900">{Number(value).toFixed(2)} ₴</span>;
      
      case 'red_zone_currency':
      case 'pink_zone_currency':
      case 'gold_zone_currency':
      case 'green_zone_currency':
        const zoneType = type.replace('_zone_currency', '');
        const zoneColors = getZoneColorsByType(zoneType);
        return (
          <span className={`font-mono font-bold inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColors.bg} ${zoneColors.text} ${zoneColors.border}`}>
            ${Number(value).toFixed(2)}
          </span>
        );
      
      case 'zone_styled_currency':
        if (value === 'нет данных') {
          return <span className="text-gray-500 italic font-bold">нет данных</span>;
        }
        // Определяем стиль на основе зоны оффера из метрики
        const offerZone = metric?.offer_zone;
        const zoneColorsForCurrency = getZoneColors(offerZone);
        if (zoneColorsForCurrency) {
          return (
            <span className={`font-mono font-bold inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColorsForCurrency.bg} ${zoneColorsForCurrency.text} ${zoneColorsForCurrency.border}`}>
              ${Number(value).toFixed(2)}
            </span>
          );
        }
        return <span className="font-mono font-bold text-gray-900">${Number(value).toFixed(2)}</span>;
      
      case 'zone_styled_percentage':
        // Определяем стиль на основе зоны оффера из метрики
        const offerZoneForPercent = metric?.offer_zone;
        const zoneColorsForPercent = getZoneColors(offerZoneForPercent);
        if (zoneColorsForPercent) {
          return (
            <span className={`font-mono font-bold inline-flex items-center px-2 py-1 rounded-full text-xs border ${zoneColorsForPercent.bg} ${zoneColorsForPercent.text} ${zoneColorsForPercent.border}`}>
              {Number(value).toFixed(1)}%
            </span>
          );
        }
        return <span className="font-mono font-bold text-gray-900">{Number(value).toFixed(1)}%</span>;
      
      case 'depth_percentage':
        const numValue = Number(value);
        if (numValue === 0) {
          const redColors = getZoneColorsByType('red');
          return (
            <span className={`font-mono inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${redColors.bg} ${redColors.text} ${redColors.border}`}>
              {numValue.toFixed(1)}%
            </span>
          );
        }
        return <span className="font-mono text-gray-900">{numValue.toFixed(1)}%</span>;
      
      case 'percentage':
        return <span className="font-mono text-blue-600">{Number(value).toFixed(1)}%</span>;
      
      case 'percentage_black':
        return <span className="font-mono text-gray-900">{Number(value).toFixed(1)}%</span>;
      
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
    const colors = getZoneColors(zone);
    if (!colors) {
      return <span className="text-gray-600 font-bold">{zone}</span>;
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
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

  // Функция для получения стиля заголовка зоны
  const getZoneHeaderStyle = (column) => {
    if (column.zoneType) {
      const colors = getZoneColorsByType(column.zoneType);
      return `${colors.bg} ${colors.text} ${colors.border} border`;
    }
    return '';
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
          <p className="mt-2 text-sm text-gray-500">Это может занять некоторое время для больших таблиц</p>
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
              Экспорт
            </button>
            
            <button
              onClick={loadMetrics}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </button>
            
            <label className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Всего товаров
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.totalItems.toLocaleString('ru-RU')}
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
                    <Activity className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        С данными по лидам
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {stats.withActualLead.toLocaleString('ru-RU')}
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
                    <Database className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Загружено в память
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900">
                        {loadingStats.actualCount.toLocaleString('ru-RU')}
                        {loadingStats.totalRecords > loadingStats.actualCount && (
                          <span className="text-sm text-orange-600 ml-1">
                            из {loadingStats.totalRecords.toLocaleString('ru-RU')}
                          </span>
                        )}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Последнее обновление: {formatKyivTime(lastUpdated)}
              </div>
              <div className="text-xs text-gray-500">
                Отображено записей: {filteredMetrics.length.toLocaleString('ru-RU')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-20">
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-[73px] z-10">
              <tr>
                {columns.map(column => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key)}
                    className={`px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${getZoneHeaderStyle(column)}`}
                    style={{ minWidth: column.width }}
                  >
                    <div className="flex items-center space-x-1">
                      <span className={column.zoneType ? getZoneColorsByType(column.zoneType)?.text : 'text-gray-500'}>
                        {column.label}
                      </span>
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
                        {formatCellValue(metric[column.key], column.type, metric)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Modal */}
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
                { num: 7, name: 'СПЕЦ сезон начало', desc: 'Название месяца (май, авг, и т.д.)' },
                { num: 8, name: 'СПЕЦ сезон конец', desc: 'Название месяца (май, авг, и т.д.)' },
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
                <p className="mb-2">
                  <strong>Месяцы:</strong> Текстовые значения (май, авг, сен и т.д.)
                </p>
                <p className="text-yellow-700 bg-yellow-50 p-2 rounded">
                  <strong>⚠️ Для больших файлов (3000+ записей):</strong> Загрузка может занять несколько минут. 
                  Следите за прогрессом в консоли браузера (F12).
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
