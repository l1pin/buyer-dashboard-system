// ФИНАЛЬНЫЙ CreativePanel.js готовый к использованию
// Замените содержимое src/components/CreativePanel.js

import React, { useState, useEffect } from 'react';
import { creativeService } from '../supabaseClient';
import { processLinksAndExtractTitles, formatFileName, extractFileIdFromUrl } from '../utils/googleDriveUtils';
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
  Loader2,
  ExternalLink,
  FileText,
  Download,
  Search,
  Sparkles
} from 'lucide-react';

function CreativePanel({ user }) {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newCreative, setNewCreative] = useState({
    article: '',
    links: [''],
    work_types: [],
    link_titles: []
  });

  const [extractingTitles, setExtractingTitles] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [previewTitles, setPreviewTitles] = useState([]);

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

  // Предварительный просмотр названий при вводе ссылок
  const handleLinksPreview = async () => {
    const validLinks = newCreative.links.filter(link => link.trim() !== '');
    if (validLinks.length === 0) {
      setError('Добавьте хотя бы одну ссылку перед извлечением названий');
      return;
    }

    try {
      setExtractingTitles(true);
      setExtractionProgress({ current: 0, total: validLinks.length });
      setPreviewTitles([]);
      setError('');

      console.log('🚀 Начинаем извлечение названий с ВАШИМИ API ключами...');

      // Обрабатываем ссылки по одной для показа прогресса
      const titles = [];
      for (let i = 0; i < validLinks.length; i++) {
        setExtractionProgress({ current: i + 1, total: validLinks.length });
        
        const fileId = extractFileIdFromUrl(validLinks[i]);
        let title = `Ссылка ${i + 1}`;
        
        if (fileId) {
          try {
            // Быстрый запрос к вашей Netlify функции с реальными ключами
            const response = await fetch(`/.netlify/functions/get-drive-title?fileId=${fileId}`);
            if (response.ok) {
              const data = await response.json();
              if (data.title) {
                title = data.title;
                console.log(`✅ Получено название ${i + 1}: "${title}" (метод: ${data.method})`);
              }
            }
          } catch (error) {
            console.log(`❌ Не удалось получить название для ссылки ${i + 1}:`, error);
          }
        }
        
        titles.push(title);
        setPreviewTitles([...titles]);
      }

      setNewCreative({
        ...newCreative,
        link_titles: titles
      });

      const successCount = titles.filter(title => 
        !title.startsWith('Ссылка ') && 
        !title.includes('_') && 
        title.length > 10
      ).length;

      setSuccess(`Извлечено ${successCount} из ${validLinks.length} реальных названий файлов!`);

    } catch (error) {
      console.error('Ошибка предварительного просмотра:', error);
      setError('Ошибка при извлечении названий: ' + error.message);
    } finally {
      setExtractingTitles(false);
      setExtractionProgress({ current: 0, total: 0 });
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

      let finalTitles = newCreative.link_titles;

      // Если нет предварительно извлеченных названий, извлекаем их сейчас
      if (!finalTitles || finalTitles.length === 0) {
        setExtractingTitles(true);
        console.log('🔄 Извлекаем названия файлов с ВАШИМИ ключами...');
        const { titles } = await processLinksAndExtractTitles(validLinks);
        finalTitles = titles;
        setExtractingTitles(false);
      }

      await creativeService.createCreative({
        user_id: user.id,
        article: newCreative.article.trim(),
        links: validLinks,
        link_titles: finalTitles,
        work_types: newCreative.work_types
      });

      // Сбрасываем форму
      setNewCreative({
        article: '',
        links: [''],
        work_types: [],
        link_titles: []
      });
      setPreviewTitles([]);
      setShowCreateModal(false);

      // Обновляем список креативов
      await loadCreatives();
      
      const realNamesCount = finalTitles.filter(title => 
        !title.startsWith('Ссылка') && 
        !title.includes('_') && 
        title.length > 10
      ).length;
      
      setSuccess(`🎉 Креатив создан! Извлечено ${realNamesCount} из ${finalTitles.length} реальных названий файлов.`);
    } catch (error) {
      setError('Ошибка создания креатива: ' + error.message);
      setExtractingTitles(false);
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
    const newTitles = previewTitles.filter((_, i) => i !== index);
    setNewCreative({
      ...newCreative,
      links: newLinks.length === 0 ? [''] : newLinks
    });
    setPreviewTitles(newTitles);
  };

  const updateLink = (index, value) => {
    const newLinks = [...newCreative.links];
    newLinks[index] = value;
    setNewCreative({
      ...newCreative,
      links: newLinks
    });
    
    // Сбрасываем предварительный просмотр при изменении ссылок
    if (previewTitles.length > 0) {
      setPreviewTitles([]);
      setNewCreative({
        ...newCreative,
        links: newLinks,
        link_titles: []
      });
    }
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
      return new Date(dateString).toLocaleDateString('ru-RU');
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

  const hasValidLinks = () => {
    return newCreative.links.some(link => link.trim() !== '');
  };

  const isRealName = (title) => {
    return title && 
           !title.startsWith('Ссылка') && 
           !title.includes('_') && 
           title.length > 10 &&
           !title.includes('Видеопрезентация') &&
           !title.includes('Обучающий_материал');
  };

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
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
                Креативы 
                <Sparkles className="h-5 w-5 text-yellow-500 ml-2" />
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name} • Автоматическое извлечение реальных названий файлов
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

      {/* Messages */}
      {success && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm flex items-center">
          <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {creatives.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <Video className="h-16 w-16 text-gray-400" />
              <Sparkles className="h-8 w-8 text-yellow-500 -ml-4 -mt-2" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет креативов
            </h3>
            <p className="text-gray-600 mb-4">
              Создайте свой первый креатив с автоматическим извлечением<br/>
              <strong>реальных названий файлов</strong> из Google Drive ссылок
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
            {creatives.map((creative) => (
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
                    <button
                      onClick={() => handleDeleteCreative(creative.id, creative.article)}
                      className="text-gray-400 hover:text-red-600 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

                  {/* Links with Real Names */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700 flex items-center">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Файлы ({creative.links.length})
                      {creative.link_titles && creative.link_titles.some(title => isRealName(title)) && (
                        <Sparkles className="h-3 w-3 ml-1 text-yellow-500" />
                      )}
                    </h4>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {creative.links.map((link, index) => {
                        const title = creative.link_titles && creative.link_titles[index] 
                          ? creative.link_titles[index]
                          : `Файл ${index + 1}`;
                        
                        const displayTitle = formatFileName(title, 35);
                        const realName = isRealName(title);
                        
                        return (
                          <div key={index} className="group">
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center justify-between text-xs hover:text-blue-800 p-2 rounded border transition-all duration-200 ${
                                realName 
                                  ? 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200' 
                                  : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200'
                              }`}
                              title={title}
                            >
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <span className="text-lg">
                                  {realName ? '🎬' : '📁'}
                                </span>
                                <span className="truncate font-medium">
                                  {displayTitle}
                                </span>
                                {realName && (
                                  <div className="flex items-center">
                                    <Sparkles className="h-3 w-3 text-yellow-500" />
                                    <span className="text-green-600 text-xs bg-green-100 px-1 py-0.5 rounded ml-1">
                                      Реальное название
                                    </span>
                                  </div>
                                )}
                              </div>
                              <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                Создать новый креатив
                <Sparkles className="h-5 w-5 text-yellow-500 ml-2" />
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
                  setPreviewTitles([]);
                  setExtractingTitles(false);
                  clearMessages();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
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
                    Ссылки на файлы * (с автоизвлечением названий)
                  </label>
                  <div className="flex items-center space-x-2">
                    {hasValidLinks() && !extractingTitles && (
                      <button
                        onClick={handleLinksPreview}
                        className="inline-flex items-center px-3 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Получить реальные названия
                      </button>
                    )}
                    <button
                      onClick={addLinkField}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить
                    </button>
                  </div>
                </div>

                {extractingTitles && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-sm text-blue-700">
                        Извлекаем реальные названия файлов с ВАШИМИ API ключами... ({extractionProgress.current}/{extractionProgress.total})
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(extractionProgress.current / extractionProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {newCreative.links.map((link, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center space-x-2">
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
                      
                      {/* Preview название */}
                      {previewTitles[index] && (
                        <div className="ml-2 flex items-center space-x-2 text-sm">
                          <div className="flex items-center space-x-1">
                            {isRealName(previewTitles[index]) ? (
                              <>
                                <Sparkles className="h-3 w-3 text-yellow-500" />
                                <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-medium">
                                  ✅ {previewTitles[index]}
                                </span>
                              </>
                            ) : (
                              <>
                                <FileText className="h-3 w-3 text-blue-600" />
                                <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">
                                  📁 {previewTitles[index]}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Типы работ * ({newCreative.work_types.length} выбрано)
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50">
                  <div className="grid grid-cols-2 gap-2">
                    {workTypes.map((type) => (
                      <label key={type} className="flex items-center space-x-2 p-2 hover:bg-white rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newCreative.work_types.includes(type)}
                          onChange={(e) => handleWorkTypeChange(type, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200"
                        />
                        <span className="text-sm text-gray-700 select-none">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {newCreative.work_types.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {newCreative.work_types.map((type, index) => (
                      <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        {type}
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
                disabled={creating || extractingTitles}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Отменить
              </button>
              <button
                onClick={handleCreateCreative}
                disabled={creating || extractingTitles}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {creating || extractingTitles ? (
                  <div className="flex items-center">
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    {extractingTitles ? 'Извлекаем названия...' : 'Создаем...'}
                  </div>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Создать креатив
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
