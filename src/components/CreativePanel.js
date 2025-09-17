// Обновленный CreativePanel.js с поддержкой COF оценки
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect } from 'react';
import { creativeService } from '../supabaseClient';
import { 
  processLinksAndExtractTitles, 
  formatFileName, 
  ensureGoogleAuth
} from '../utils/googleDriveUtils';
import { 
  Plus, 
  X, 
  Link as LinkIcon,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Video,
  Image as ImageIcon,
  User,
  Play,
  TrendingUp
} from 'lucide-react';

function CreativePanel({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  
  const [newCreative, setNewCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: []
  });

  const [extractingTitles, setExtractingTitles] = useState(false);

  const workTypes = [
    'Монтаж _Video',
    'Upscale_Video', 
    'Ресайз 1',
    'Озвучка',
    'Субтитры',
    'Ресайз 2',
    'Написання_Sub',
    'Video_Avarat',
    'Монтаж > 21s',
    'Правки_video',
    'Превьюшка',
    'Статика 1',
    'Статика 2', 
    'Статика 3',
    'Статика 4',
    'Ресайз St 1',
    'Ресайз St 2',
    'Ресайз St 3', 
    'Ресайз St 4',
    'Правки Статика',
    'Доп. 0,2',
    'Доп. 0,4',
    'Доп. 0,6',
    'Доп. 0,8',
    'Доп. 1',
    'Доп. 2'
  ];

  // Оценки типов работ для подсчета COF
  const workTypeValues = {
    'Монтаж _Video': 1,
    'Монтаж > 21s': 0.4,
    'Upscale_Video': 0.2,
    'Ресайз 1': 0.4,
    'Озвучка': 0.2,
    'Субтитры': 0.2,
    'Ресайз 2': 0.4,
    'Написання_Sub': 0.2,
    'Video_Avarat': 0.4,
    'Правки_video': 0.2,
    'Превьюшка': 0.2,
    'Статика 1': 1,
    'Статика 2': 1,
    'Статика 3': 1,
    'Статика 4': 1,
    'Ресайз St 1': 0.2,
    'Ресайз St 2': 0.2,
    'Ресайз St 3': 0.2,
    'Ресайз St 4': 0.2,
    'Правки Статика': 0.2,
    'Доп. 0,2': 0.2,
    'Доп. 0,4': 0.4,
    'Доп. 0,6': 0.6,
    'Доп. 0,8': 0.8,
    'Доп. 1': 1,
    'Доп. 2': 2
  };

  /**
   * Вычисление COF для креатива
   */
  const calculateCOF = (workTypes) => {
    if (!workTypes || !Array.isArray(workTypes)) return 0;
    
    return workTypes.reduce((total, workType) => {
      const value = workTypeValues[workType] || 0;
      return total + value;
    }, 0);
  };

  /**
   * Форматирование COF для отображения
   */
  const formatCOF = (cof) => {
    return cof % 1 === 0 ? cof.toString() : cof.toFixed(1);
  };

  /**
   * Получение цвета для COF бейджа
   */
  const getCOFBadgeColor = (cof) => {
    if (cof >= 4) return 'bg-red-600 text-white border-red-600'; // Ярко красный от 4 и больше
    if (cof >= 3) return 'bg-red-300 text-red-800 border-red-300'; // Светло красный от 3 до 3,99
    if (cof >= 2) return 'bg-yellow-300 text-yellow-800 border-yellow-300'; // Желтый от 2 до 2,99
    if (cof >= 1.01) return 'bg-green-200 text-green-800 border-green-200'; // Светло-зеленый от 1,01 до 1,99
    return 'bg-green-500 text-white border-green-500'; // Ярко зеленый до 1
  };

  /**
   * Вычисление общей статистики COF
   */
  const getCOFStats = () => {
    const totalCOF = creatives.reduce((sum, creative) => {
      return sum + calculateCOF(creative.work_types);
    }, 0);

    const avgCOF = creatives.length > 0 ? totalCOF / creatives.length : 0;
    
    return {
      totalCOF: totalCOF,
      avgCOF: avgCOF,
      maxCOF: Math.max(...creatives.map(c => calculateCOF(c.work_types)), 0),
      minCOF: creatives.length > 0 ? Math.min(...creatives.map(c => calculateCOF(c.work_types))) : 0
    };
  };

  useEffect(() => {
    loadCreatives();
  }, []);

  const loadCreatives = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await creativeService.getUserCreatives(user.id);
      setCreatives(data);
    } catch (error) {
      setError('Ошибка загрузки креативов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCreative = async () => {
    if (!newCreative.article.trim()) {
      setError('Артикул обязателен для заполнения');
      return;
    }

    const validLinks = newCreative.links.filter(link => link.trim() !== '');
    if (validLinks.length === 0) {
      setError('Необходимо добавить хотя бы одну ссылку');
      return;
    }

    if (newCreative.work_types.length === 0) {
      setError('Необходимо выбрать хотя бы один тип работы');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setSuccess('');

      setAuthorizing(true);
      const authSuccess = await ensureGoogleAuth();
      setAuthorizing(false);

      if (!authSuccess) {
        setError('Необходима авторизация Google для извлечения названий файлов');
        setCreating(false);
        return;
      }

      setExtractingTitles(true);
      const { links, titles } = await processLinksAndExtractTitles(validLinks, true);
      setExtractingTitles(false);

      await creativeService.createCreative({
        user_id: user.id,
        article: newCreative.article.trim(),
        links: links,
        link_titles: titles,
        work_types: newCreative.work_types
      });

      setNewCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: []
      });
      setShowCreateModal(false);

      await loadCreatives();
      
      const successCount = titles.filter(title => !title.startsWith('Видео ')).length;
      const totalCount = titles.length;
      const cof = calculateCOF(newCreative.work_types);
      setSuccess(`Креатив создан! COF: ${formatCOF(cof)} | Названий: ${successCount}/${totalCount}`);
    } catch (error) {
      setError('Ошибка создания креатива: ' + error.message);
      setExtractingTitles(false);
      setAuthorizing(false);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCreative = async (creativeId, article) => {
    if (!window.confirm(`Вы уверены, что хотите удалить креатив "${article}"?`)) {
      return;
    }

    try {
      await creativeService.deleteCreative(creativeId);
      await loadCreatives();
      setSuccess('Креатив удален');
    } catch (error) {
      setError('Ошибка удаления креатива: ' + error.message);
    }
  };

  const addLinkField = () => {
    setNewCreative({
      ...newCreative,
      links: [...newCreative.links, '']
    });
  };

  const removeLinkField = (index) => {
    const newLinks = newCreative.links.filter((_, i) => i !== index);
    setNewCreative({
      ...newCreative,
      links: newLinks.length === 0 ? [''] : newLinks
    });
  };

  const updateLink = (index, value) => {
    const newLinks = [...newCreative.links];
    newLinks[index] = value;
    setNewCreative({
      ...newCreative,
      links: newLinks
    });
  };

  const handleWorkTypeChange = (workType, isChecked) => {
    let updatedWorkTypes;
    if (isChecked) {
      updatedWorkTypes = [...newCreative.work_types, workType];
    } else {
      updatedWorkTypes = newCreative.work_types.filter(type => type !== workType);
    }
    
    setNewCreative({
      ...newCreative,
      work_types: updatedWorkTypes
    });
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
      console.error('Error formatting date:', error);
      return new Date(dateString).toLocaleDateString('ru-RU', {
        timeZone: 'Europe/Kiev'
      });
    }
  };

  const getWorkTypeIcon = (workTypes) => {
    const firstType = workTypes[0] || '';
    if (firstType.toLowerCase().includes('video') || firstType.toLowerCase().includes('монтаж')) {
      return <Video className="h-4 w-4" />;
    }
    if (firstType.toLowerCase().includes('статика')) {
      return <ImageIcon className="h-4 w-4" />;
    }
    return <Eye className="h-4 w-4" />;
  };

  const getWorkTypeColor = (workTypes) => {
    const firstType = workTypes[0] || '';
    if (firstType.toLowerCase().includes('video') || firstType.toLowerCase().includes('монтаж')) {
      return 'bg-blue-100 text-blue-800';
    }
    if (firstType.toLowerCase().includes('статика')) {
      return 'bg-green-100 text-green-800';
    }
    if (firstType.toLowerCase().includes('доп')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Получаем статистику COF
  const cofStats = getCOFStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка креативов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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
              <h1 className="text-2xl font-semibold text-gray-900">Креативы</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name} • {creatives.length} креативов • COF: {formatCOF(cofStats.totalCOF)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadCreatives}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать креатив
            </button>
          </div>
        </div>
      </div>

      {/* COF Statistics */}
      {creatives.length > 0 && (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Статистика COF:</span>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-500">Общий:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.totalCOF)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Средний:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.avgCOF)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Макс:</span>
                  <span className="ml-1 font-medium text-gray-900">{formatCOF(cofStats.maxCOF)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {creatives.length === 0 ? (
          <div className="text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет креативов
            </h3>
            <p className="text-gray-600 mb-4">
              Создайте свой первый креатив, нажав кнопку выше
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать креатив
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creatives.map((creative) => {
              const cof = calculateCOF(creative.work_types);
              
              return (
                <div
                  key={creative.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {creative.article}
                        </h3>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatKyivTime(creative.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {/* COF Badge */}
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border ${getCOFBadgeColor(cof)}`}>
                          <span className="text-xs font-bold mr-1">COF</span>
                          {formatCOF(cof)}
                        </div>
                        <button
                          onClick={() => handleDeleteCreative(creative.id, creative.article)}
                          className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Work Types */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Типы работ ({creative.work_types.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {creative.work_types.slice(0, 3).map((workType, index) => (
                          <span key={index} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getWorkTypeColor(creative.work_types)}`}>
                            {index === 0 && getWorkTypeIcon(creative.work_types)}
                            <span className={index === 0 ? "ml-1" : ""}>{workType}</span>
                          </span>
                        ))}
                        {creative.work_types.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            +{creative.work_types.length - 3} еще
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Videos */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700 flex items-center">
                        <Play className="h-3 w-3 mr-1" />
                        Видео ({creative.links.length})
                      </h4>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {creative.links.map((link, index) => {
                          const title = creative.link_titles && creative.link_titles[index] 
                            ? creative.link_titles[index]
                            : `Видео ${index + 1}`;
                          
                          return (
                            <a
                              key={index}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 p-2 rounded border transition-colors duration-200"
                              title={title}
                            >
                              {title}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900">
                Создать новый креатив
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCreative({
                    article: '',
                    links: [''],
                    work_types: [],
                    link_titles: []
                  });
                  setExtractingTitles(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Article */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Артикул *
                </label>
                <input
                  type="text"
                  value={newCreative.article}
                  onChange={(e) => {
                    setNewCreative({ ...newCreative, article: e.target.value });
                    clearMessages();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Введите артикул"
                />
              </div>

              {/* Links */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Видео ссылки *
                  </label>
                  <button
                    onClick={addLinkField}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Добавить
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {newCreative.links.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => updateLink(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      {newCreative.links.length > 1 && (
                        <button
                          onClick={() => removeLinkField(index)}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Types */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Типы работ * ({newCreative.work_types.length} выбрано)
                  </label>
                  {newCreative.work_types.length > 0 && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">COF:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCOFBadgeColor(calculateCOF(newCreative.work_types))}`}>
                        {formatCOF(calculateCOF(newCreative.work_types))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="grid grid-cols-1 gap-2">
                    {workTypes.map((type) => (
                      <label key={type} className="flex items-center justify-between p-2 hover:bg-white rounded cursor-pointer">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newCreative.work_types.includes(type)}
                            onChange={(e) => handleWorkTypeChange(type, e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700 select-none">{type}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {formatCOF(workTypeValues[type] || 0)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {newCreative.work_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {newCreative.work_types.map((type, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {type} ({formatCOF(workTypeValues[type] || 0)})
                        <button
                          type="button"
                          onClick={() => handleWorkTypeChange(type, false)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Error в модале */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  clearMessages();
                }}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleCreateCreative}
                disabled={creating}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {authorizing ? 'Авторизация Google...' : 
                     extractingTitles ? 'Извлечение названий...' : 
                     'Создание...'}
                  </div>
                ) : (
                  <>
                    Создать креатив
                    {newCreative.work_types.length > 0 && (
                      <span className="ml-2 text-xs opacity-75">
                        (COF: {formatCOF(calculateCOF(newCreative.work_types))})
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreativePanel;
