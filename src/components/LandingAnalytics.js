// LandingPanel.js - Полностью переписанная версия для лендингов
// Заменяет все упоминания креативов на лендинги

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import IntegrationChecker from './IntegrationChecker';
import { SourceBadges, GoogleIcon, FacebookIcon, TiktokIcon } from './SourceIcons';
import { supabase, landingService, userService, landingHistoryService, metricsAnalyticsService, trelloLandingService, landingTemplatesService, landingTagsService, buyerSourceService } from '../supabaseClient';
import { useBatchMetrics, useMetricsStats } from '../hooks/useMetrics';
import { useLandingMetrics } from '../hooks/useLandingMetrics';
import { useZoneData } from '../hooks/useZoneData';
import {
  Plus,
  X,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  Video,
  User,
  TrendingUp,
  BarChart3,
  MessageCircle,
  ExternalLink,
  Clock,
  MoreHorizontal,
  Edit,
  Users,
  Target,
  DollarSign,
  MousePointer,
  ChevronDown,
  ChevronUp,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Palette,
  CheckCircle,
  Settings,
  Save,
  GripVertical,
  Check,
  History
} from 'lucide-react';

// Компонент выпадающего фильтра (вынесен наружу для оптимизации)
const FilterDropdown = React.memo(({ isOpen, referenceElement, options, selectedValues, onApply, onCancel, onOk, onReset, multiSelect = false, title = 'Фильтр', alignRight = false }) => {
  const dropdownRef = useRef(null);
  const positionRef = useRef({ top: 0, left: 0 });
  const [, forceUpdate] = useState({});

  // Используем useLayoutEffect для СИНХРОННОГО расчета позиции ДО отрисовки
  useLayoutEffect(() => {
    if (isOpen && referenceElement) {
      const rect = referenceElement.getBoundingClientRect();
      positionRef.current = {
        top: rect.bottom + window.scrollY + 4,
        left: alignRight ? rect.right + window.scrollX : rect.left + window.scrollX
      };
      forceUpdate({});
    }
  }, [isOpen, referenceElement, alignRight]);

  if (!isOpen) return null;

  const dropdownContent = (
    <div
      ref={dropdownRef}
      data-filter-dropdown="true"
      className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 min-w-[220px]"
      style={{
        top: `${positionRef.current.top}px`,
        left: `${positionRef.current.left}px`,
        zIndex: 9999,
        transform: alignRight ? 'translateX(-100%) translateZ(0)' : 'translateZ(0)',
        backfaceVisibility: 'hidden',
        pointerEvents: 'auto'
      }}
      onMouseDown={(e) => {
        // Предотвращаем всплытие события, чтобы handleClickOutside не закрывал dropdown
        e.stopPropagation();
      }}
    >
      {/* Заголовок */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>

      <div className="py-2 max-h-[300px] overflow-y-auto">
        {options.map((option, index) => {
          let isSelected;

          // Проверяем, все ли опции выбраны (для отображения галочки у "Все")
          const allOptions = options.filter(opt => opt.value !== 'all').map(opt => opt.value);
          const allSelected = allOptions.every(val =>
            multiSelect ? selectedValues.includes(val) : selectedValues === val
          ) && (multiSelect ? selectedValues.length === allOptions.length : true);

          if (option.value === 'all') {
            // Для опции "Все" галочка показывается, когда все опции выбраны
            isSelected = multiSelect
              ? allSelected
              : (selectedValues === null || selectedValues === 'all');
          } else {
            // Для обычных опций проверяем их выбор ИЛИ выбрана ли опция "Все"
            if (multiSelect) {
              isSelected = selectedValues.includes(option.value);
            } else {
              isSelected = selectedValues === option.value || selectedValues === null;
            }
          }

          return (
            <React.Fragment key={option.value}>
              <button
                onClick={(e) => {
                  // Игнорируем клики на disabled опции
                  if (option.disabled) return;

                  if (option.value === 'all') {
                    // Обработка клика на "Все"
                    if (multiSelect) {
                      // Для множественного выбора - выбираем все опции кроме "Все"
                      const allOptions = options.filter(opt => opt.value !== 'all').map(opt => opt.value);
                      onApply(allOptions);
                    } else {
                      // Для одиночного выбора - устанавливаем null (все показываем)
                      onApply(null);
                    }
                  } else {
                    // Обработка клика на обычные опции
                    if (multiSelect) {
                      const newValues = selectedValues.includes(option.value)
                        ? selectedValues.filter(v => v !== option.value)
                        : [...selectedValues, option.value];
                      onApply(newValues);
                    } else {
                      // В режиме одиночного выбора: если выбран тот же элемент - сбрасываем к null
                      onApply(selectedValues === option.value ? null : option.value);
                    }
                  }
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors duration-150 flex items-center ${
                  option.disabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-blue-50 cursor-pointer'
                }`}
                disabled={option.disabled}
              >
                <div className="flex items-center flex-1">
                  {isSelected && !option.disabled && (
                    <Check className="h-4 w-4 text-blue-600 flex-shrink-0 mr-2" strokeWidth={3} />
                  )}
                  {(!isSelected || option.disabled) && (
                    <div className="h-4 w-4 mr-2"></div>
                  )}
                  {option.value !== 'all' && option.hasOwnProperty('icon') && (
                    <span className="text-lg mr-2 flex-shrink-0">{option.icon}</span>
                  )}
                  {option.value !== 'all' && option.hasOwnProperty('avatar') && (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-2">
                      {option.avatar ? (
                        <img
                          src={option.avatar}
                          alt={option.label}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const placeholder = e.target.parentElement.querySelector('div');
                            if (placeholder) placeholder.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${option.avatar ? 'hidden' : ''}`}>
                        <User className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span className={`font-medium flex-1 ${option.disabled ? 'text-gray-400' : 'text-gray-700'}`}>{option.label}</span>
                </div>
                {option.count !== undefined && (
                  <span className={`text-sm ml-2 ${option.disabled ? 'text-gray-400' : 'text-gray-500'}`}>{option.count}</span>
                )}
              </button>
              {/* Разделитель после опции "Все" */}
              {option.value === 'all' && (
                <div className="border-b border-gray-200 my-1"></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="border-t border-gray-200 px-3 py-2.5 flex justify-between items-center bg-gray-50 rounded-b-lg">
        <button
          onClick={() => {
            if (onReset) {
              onReset();
            }
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-150"
        >
          Сбросить
        </button>
        <button
          onClick={() => {
            if (onOk) {
              onOk();
            } else {
              onApply(selectedValues);
            }
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors duration-150 shadow-sm"
        >
          OK
        </button>
      </div>
    </div>
  );

  return createPortal(dropdownContent, document.body);
});

FilterDropdown.displayName = 'FilterDropdown';

function LandingTeamLead({ user }) {
  const [landings, setLandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [landingsWithHistory, setLandingsWithHistory] = useState(new Set());
  const [showUuidModal, setShowUuidModal] = useState(false);
  const [selectedLandingUuid, setSelectedLandingUuid] = useState(null);
  const [copiedUuid, setCopiedUuid] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingLandingId, setDeletingLandingId] = useState(null);
  const [metricsPeriod, setMetricsPeriod] = useState('all');
  const [metricsDisplayPeriod, setMetricsDisplayPeriod] = useState('all');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Состояния для календаря фильтрации метрик
  const [metricsCustomDateFrom, setMetricsCustomDateFrom] = useState(null);
  const [metricsCustomDateTo, setMetricsCustomDateTo] = useState(null);
  const [metricsTempCustomDateFrom, setMetricsTempCustomDateFrom] = useState(null);
  const [metricsTempCustomDateTo, setMetricsTempCustomDateTo] = useState(null);
  const [metricsCalendarMonth1, setMetricsCalendarMonth1] = useState(new Date());
  const [metricsCalendarMonth2, setMetricsCalendarMonth2] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next;
  });
  const [metricsSelectingDate, setMetricsSelectingDate] = useState(null);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [openDropdowns, setOpenDropdowns] = useState(new Set());
  const [expandedBuyers, setExpandedBuyers] = useState(new Set());
  const [trelloStatuses, setTrelloStatuses] = useState(new Map());
  const [trelloLists, setTrelloLists] = useState([]);
  const [syncingLandings, setSyncingLandings] = useState(new Set());

  // Состояния для переключения метрик
  const [detailMode, setDetailMode] = useState(new Map());
  const [currentVideoIndex, setCurrentVideoIndex] = useState(new Map());

  const [selectedBuyer, setSelectedBuyer] = useState('all');
  const [selectedSearcher, setSelectedSearcher] = useState('all');
  const [searchMode, setSearchMode] = useState('sku'); // 'sku' или 'uuid'
  const [searchValue, setSearchValue] = useState('');
  const [buyers, setBuyers] = useState([]);
  const [searchers, setSearchers] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [contentManagers, setContentManagers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showFilterBuyerDropdown, setShowFilterBuyerDropdown] = useState(false);
  const [showFilterSearcherDropdown, setShowFilterSearcherDropdown] = useState(false);
  const [showGiferDropdown, setShowGiferDropdown] = useState(false);
  const [productManagers, setProductManagers] = useState([]);
  const [gifers, setGifers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [verifiedUrls, setVerifiedUrls] = useState([]);
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [landingsWithIntegration, setLandingsWithIntegration] = useState(new Map());
  
  // Состояния для модального окна настроек
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('templates'); // 'templates', 'tags' или 'sources'
  
  // Состояния для источников байеров
  const [buyerSources, setBuyerSources] = useState(new Map());
  const [editingBuyerId, setEditingBuyerId] = useState(null);
  const [tempSourceIds, setTempSourceIds] = useState([]);
  const [loadingBuyerSources, setLoadingBuyerSources] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [savingSettings, setSavingSettings] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);

  // Состояния для фильтров таблицы
  const [typeFilters, setTypeFilters] = useState(['main', 'test', 'edited']); // Все типы выбраны по умолчанию
  const [verificationFilter, setVerificationFilter] = useState(null); // null, 'with' или 'without'
  const [commentFilter, setCommentFilter] = useState(null); // null, 'with' или 'without'
  const [historyFilter, setHistoryFilter] = useState(null); // null, 'with' или 'without'
  const [countryFilter, setCountryFilter] = useState(null); // null, 'ukraine' или 'poland'
  const [versionFilter, setVersionFilter] = useState(null); // null или конкретная версия
  const [templateFilter, setTemplateFilter] = useState(null); // null или конкретный шаблон
  const [tagsFilter, setTagsFilter] = useState([]); // массив выбранных тегов
  const [statusFilter, setStatusFilter] = useState(null); // null или конкретный статус
  const [designerFilter, setDesignerFilter] = useState(null); // null или id дизайнера
  const [buyerFilterTable, setBuyerFilterTable] = useState(null); // null или id байера (для таблицы)
  const [searcherFilterTable, setSearcherFilterTable] = useState(null); // null или id серчера (для таблицы)
  const [productManagerFilter, setProductManagerFilter] = useState(null); // null или id продакт-менеджера
  const [giferFilter, setGiferFilter] = useState(null); // null или id гифера
  const [contentManagerFilter, setContentManagerFilter] = useState(null); // null или id контент-менеджера
  const [zoneFilter, setZoneFilter] = useState(null); // null, 'with', 'without'
  const [sourceFilter, setSourceFilter] = useState(null); // null, 'facebook', 'tiktok', 'google'
  const [showTypeFilterDropdown, setShowTypeFilterDropdown] = useState(false);
  const [showVerificationFilterDropdown, setShowVerificationFilterDropdown] = useState(false);
  const [showCommentFilterDropdown, setShowCommentFilterDropdown] = useState(false);
  const [showHistoryFilterDropdown, setShowHistoryFilterDropdown] = useState(false);
  const [showCountryFilterDropdown, setShowCountryFilterDropdown] = useState(false);
  const [showVersionFilterDropdown, setShowVersionFilterDropdown] = useState(false);
  const [showTemplateFilterDropdown, setShowTemplateFilterDropdown] = useState(false);
  const [showTagsFilterDropdown, setShowTagsFilterDropdown] = useState(false);
  const [showStatusFilterDropdown, setShowStatusFilterDropdown] = useState(false);
  const [showDesignerFilterDropdown, setShowDesignerFilterDropdown] = useState(false);
  const [showBuyerFilterTableDropdown, setShowBuyerFilterTableDropdown] = useState(false);
  const [showSearcherFilterTableDropdown, setShowSearcherFilterTableDropdown] = useState(false);
  const [showProductManagerFilterDropdown, setShowProductManagerFilterDropdown] = useState(false);
  const [showGiferFilterDropdown, setShowGiferFilterDropdown] = useState(false);
  const [showContentManagerFilterDropdown, setShowContentManagerFilterDropdown] = useState(false);
  const [showZoneFilterDropdown, setShowZoneFilterDropdown] = useState(false);
  const [showSourceFilterDropdown, setShowSourceFilterDropdown] = useState(false);
  const [tempTypeFilters, setTempTypeFilters] = useState(['main', 'test', 'edited']);
  const [tempVerificationFilter, setTempVerificationFilter] = useState(null);
  const [tempCommentFilter, setTempCommentFilter] = useState(null);
  const [tempHistoryFilter, setTempHistoryFilter] = useState(null);
  const [tempCountryFilter, setTempCountryFilter] = useState(null);
  const [tempVersionFilter, setTempVersionFilter] = useState(null);
  const [tempTemplateFilter, setTempTemplateFilter] = useState(null);
  const [tempTagsFilter, setTempTagsFilter] = useState([]);
  const [tempStatusFilter, setTempStatusFilter] = useState(null);
  const [tempDesignerFilter, setTempDesignerFilter] = useState(null);
  const [tempBuyerFilterTable, setTempBuyerFilterTable] = useState(null);
  const [tempSearcherFilterTable, setTempSearcherFilterTable] = useState(null);
  const [tempProductManagerFilter, setTempProductManagerFilter] = useState(null);
  const [tempGiferFilter, setTempGiferFilter] = useState(null);
  const [tempContentManagerFilter, setTempContentManagerFilter] = useState(null);
  const [tempZoneFilter, setTempZoneFilter] = useState(null);
  const [tempSourceFilter, setTempSourceFilter] = useState(null);

  // Refs для кнопок фильтров (для позиционирования дропдаунов)
  const typeFilterButtonRef = useRef(null);
  const verificationFilterButtonRef = useRef(null);
  const commentFilterButtonRef = useRef(null);
  const historyFilterButtonRef = useRef(null);
  const countryFilterButtonRef = useRef(null);
  const versionFilterButtonRef = useRef(null);
  const templateFilterButtonRef = useRef(null);
  const tagsFilterButtonRef = useRef(null);
  const statusFilterButtonRef = useRef(null);
  const designerFilterButtonRef = useRef(null);
  const buyerFilterTableButtonRef = useRef(null);
  const searcherFilterTableButtonRef = useRef(null);
  const productManagerFilterButtonRef = useRef(null);
  const giferFilterButtonRef = useRef(null);
  const contentManagerFilterButtonRef = useRef(null);
  const zoneFilterButtonRef = useRef(null);
  const sourceFilterButtonRef = useRef(null);

  // Функция для закрытия всех фильтров
  const closeAllFilterDropdowns = () => {
    setShowTypeFilterDropdown(false);
    setShowVerificationFilterDropdown(false);
    setShowCommentFilterDropdown(false);
    setShowHistoryFilterDropdown(false);
    setShowCountryFilterDropdown(false);
    setShowVersionFilterDropdown(false);
    setShowTemplateFilterDropdown(false);
    setShowTagsFilterDropdown(false);
    setShowStatusFilterDropdown(false);
    setShowDesignerFilterDropdown(false);
    setShowBuyerFilterTableDropdown(false);
    setShowSearcherFilterTableDropdown(false);
    setShowProductManagerFilterDropdown(false);
    setShowGiferFilterDropdown(false);
    setShowContentManagerFilterDropdown(false);
    setShowZoneFilterDropdown(false);
    setShowSourceFilterDropdown(false);
  };

  // Компоненты флагов
  const UkraineFlag = () => (
    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
      <div className="w-full h-3 bg-blue-500"></div>
      <div className="w-full h-3 bg-yellow-400"></div>
    </div>
  );

  const PolandFlag = () => (
    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-300 flex-shrink-0">
      <div className="w-full h-3 bg-white"></div>
      <div className="w-full h-3 bg-red-500"></div>
    </div>
  );

  const TestBadge = () => (
    <div className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md border border-orange-300 flex-shrink-0 hover:shadow-lg transition-shadow duration-200">
      <span className="tracking-wide">T</span>
    </div>
  );

  const WarehouseBadge = () => (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
      Склад
    </span>
  );

  // Хук для метрик лендингов (используем landings вместо filteredLandings)
  const {
    landingMetrics,
    loading: landingMetricsLoading,
    error: landingMetricsError,
    stats: landingMetricsStats,
    refresh: refreshLandingMetrics,
    getLandingMetrics,
    getAllLandingMetrics,
    hasMetrics: hasLandingMetrics
  } = useLandingMetrics(landings, false, metricsPeriod);

  // Хук для зональных данных (используем landings вместо filteredLandings)
  const {
    zoneDataMap,
    loading: zoneDataLoading,
    error: zoneDataError,
    stats: zoneDataStats,
    getZoneDataForArticle,
    hasZoneData,
    getCurrentZone,
    getZonePricesString,
    refresh: refreshZoneData
  } = useZoneData(landings, true);

  // Получение источников метрик для лендинга
  const getLandingSources = (landingId) => {
    if (!landingId || !landingMetrics || landingMetrics.size === 0) {
      return [];
    }

    const sources = [];
    const possibleSources = ['google', 'facebook', 'tiktok'];

    possibleSources.forEach(source => {
      const key = `${landingId}_${source}`;
      if (landingMetrics.has(key)) {
        const metrics = landingMetrics.get(key);
        // Проверяем что метрики найдены и имеют данные
        if (metrics && metrics.found) {
          sources.push(source);
        }
      }
    });

    // ДИАГНОСТИКА: Логируем первый найденный лендинг с источниками
    if (sources.length > 0 && !window._loggedFirstLandingSource) {
      console.log('✅ ПРИМЕР: Лендинг с источниками:', { landingId, sources });
      window._loggedFirstLandingSource = true;
    }

    return sources;
  };

  // Фильтрация лендингов
  const filteredLandings = useMemo(() => {
    let landingsToFilter = landings;

    // Фильтрация по байеру
    if (selectedBuyer !== 'all') {
      landingsToFilter = landingsToFilter.filter(l => l.buyer_id === selectedBuyer);
    }

    // Фильтрация по серчеру
    if (selectedSearcher !== 'all') {
      landingsToFilter = landingsToFilter.filter(l => l.searcher_id === selectedSearcher);
    }

    // Фильтрация по поиску SKU/UUID
    if (searchValue.trim()) {
      if (searchMode === 'sku') {
        // Фильтрация по артикулу
        const searchTerm = searchValue.trim().toLowerCase();
        landingsToFilter = landingsToFilter.filter(l =>
          l.article && l.article.toLowerCase().includes(searchTerm)
        );
      } else if (searchMode === 'uuid') {
        // Поиск по UUID: найти артикул этого лендинга и показать все лендинги с таким артикулом
        const searchTerm = searchValue.trim().toLowerCase();
        const landingWithUuid = landings.find(l =>
          l.id && l.id.toLowerCase() === searchTerm
        );

        if (landingWithUuid && landingWithUuid.article) {
          // Показываем все лендинги с таким же артикулом
          const targetArticle = landingWithUuid.article.toLowerCase();
          landingsToFilter = landingsToFilter.filter(l =>
            l.article && l.article.toLowerCase() === targetArticle
          );
        } else {
          // UUID не найден - возвращаем пустой массив
          landingsToFilter = [];
        }
      }
    }

    // Фильтрация по типу (Основные, Тестовые, Отредактированные)
    if (typeFilters.length > 0 && typeFilters.length < 3) {
      landingsToFilter = landingsToFilter.filter(l => {
        const isMain = !l.is_test && !l.is_edited;
        const isTest = l.is_test;
        const isEdited = l.is_edited;

        if (typeFilters.includes('main') && isMain) return true;
        if (typeFilters.includes('test') && isTest) return true;
        if (typeFilters.includes('edited') && isEdited) return true;
        return false;
      });
    }

    // Фильтрация по верификации
    if (verificationFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        const hasVerification = (l.verified_urls && l.verified_urls.length > 0) || landingsWithIntegration.get(l.id);
        if (verificationFilter === 'with') {
          return hasVerification;
        } else if (verificationFilter === 'without') {
          return !hasVerification;
        }
        return true;
      });
    }

    // Фильтрация по комментарию
    if (commentFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        const hasComment = l.comment && l.comment.trim();
        if (commentFilter === 'with') {
          return hasComment;
        } else if (commentFilter === 'without') {
          return !hasComment;
        }
        return true;
      });
    }

    // Фильтрация по истории
    if (historyFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        const hasHistory = landingsWithHistory.has(l.id);
        if (historyFilter === 'with') {
          return hasHistory;
        } else if (historyFilter === 'without') {
          return !hasHistory;
        }
        return true;
      });
    }

    // Фильтрация по стране
    if (countryFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (countryFilter === 'ukraine') {
          return !l.is_poland;
        } else if (countryFilter === 'poland') {
          return l.is_poland;
        }
        return true;
      });
    }

    // Фильтрация по версии
    if (versionFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l =>
        l.website && l.website.trim() === versionFilter
      );
    }

    // Фильтрация по шаблону
    if (templateFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l =>
        l.template && l.template.trim() === templateFilter
      );
    }

    // Фильтрация по тегам
    if (tagsFilter.length > 0) {
      landingsToFilter = landingsToFilter.filter(l => {
        // Проверяем наличие пустого тега
        if (tagsFilter.includes('empty')) {
          if (!l.tags || !Array.isArray(l.tags) || l.tags.length === 0) return true;
        }
        if (!l.tags || !Array.isArray(l.tags)) return false;
        // Лендинг должен содержать хотя бы один из выбранных тегов
        return tagsFilter.some(selectedTag =>
          selectedTag !== 'empty' && l.tags.some(tag => tag.trim() === selectedTag)
        );
      });
    }

    // Фильтрация по статусу
    if (statusFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (statusFilter === 'empty') {
          return !trelloStatuses.get(l.id);
        }
        const landingStatus = trelloStatuses.get(l.id);
        return landingStatus && landingStatus.list_name === statusFilter;
      });
    }

    // Фильтрация по дизайнеру
    if (designerFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (designerFilter === 'empty') {
          return !l.designer_id;
        }
        return l.designer_id === designerFilter;
      });
    }

    // Фильтрация по байеру (таблица)
    if (buyerFilterTable !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (buyerFilterTable === 'empty') {
          return !l.buyer_id;
        }
        return l.buyer_id === buyerFilterTable;
      });
    }

    // Фильтрация по серчеру (таблица)
    if (searcherFilterTable !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (searcherFilterTable === 'empty') {
          return !l.searcher_id;
        }
        return l.searcher_id === searcherFilterTable;
      });
    }

    // Фильтрация по продакт-менеджеру
    if (productManagerFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (productManagerFilter === 'empty') {
          return !l.product_manager_id;
        }
        return l.product_manager_id === productManagerFilter;
      });
    }

    // Фильтрация по гиферу
    if (giferFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (giferFilter === 'empty') {
          return !l.gifer_id;
        }
        return l.gifer_id === giferFilter;
      });
    }

    // Фильтрация по контент-менеджеру
    if (contentManagerFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        if (contentManagerFilter === 'empty') {
          return !l.content_manager_id;
        }
        return l.content_manager_id === contentManagerFilter;
      });
    }

    // Фильтрация по зонам (используем hasZoneData из хука)
    if (zoneFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        const hasZones = hasZoneData(l.article);
        if (zoneFilter === 'with') {
          return hasZones;
        } else if (zoneFilter === 'without') {
          return !hasZones;
        }
        return true;
      });
    }

    // Фильтрация по источнику (используем getLandingSources)
    if (sourceFilter !== null) {
      landingsToFilter = landingsToFilter.filter(l => {
        const sources = getLandingSources(l.id);
        if (sourceFilter === 'empty') {
          return sources.length === 0;
        }
        return sources.includes(sourceFilter);
      });
    }

    return landingsToFilter;
  }, [landings, selectedBuyer, selectedSearcher, searchMode, searchValue, typeFilters, verificationFilter, commentFilter, historyFilter, countryFilter, versionFilter, templateFilter, tagsFilter, statusFilter, designerFilter, buyerFilterTable, searcherFilterTable, productManagerFilter, giferFilter, contentManagerFilter, zoneFilter, sourceFilter, landingsWithIntegration, landingsWithHistory, trelloStatuses, hasZoneData, getLandingSources, landingMetrics]);

  // Хуки для метрик
  const [metricsLastUpdate, setMetricsLastUpdate] = useState(null);

  const {
    batchMetrics,
    loading: metricsLoading,
    error: metricsError,
    stats: metricsStats,
    getCreativeMetrics,
    refresh: refreshMetrics,
    loadFromCache,
    loadMetricsForSingleCreative,
    loadingCreativeIds
  } = useBatchMetrics(filteredLandings, true, metricsPeriod);

  const {
    stats: aggregatedMetricsStats,
    formatStats,
    hasData: hasMetricsData
  } = useMetricsStats(filteredLandings, batchMetrics);

    // Группировка метрик лендинга по байерам
  const getMetricsByBuyers = (landing) => {
    console.log(`🔍🔍🔍 НАЧАЛО getMetricsByBuyers для ${landing.id} (${landing.article})`);

    // Получаем все метрики для этого лендинга
    const allMetricsForLanding = getAllLandingMetrics(landing.id);

    console.log(`📦 getAllLandingMetrics вернул:`, {
      count: allMetricsForLanding?.length || 0,
      metrics: allMetricsForLanding
    });

    if (!allMetricsForLanding || allMetricsForLanding.length === 0) {
      console.log(`⚠️ Нет метрик для ${landing.id}`);
      return [];
    }

    // Проверяем наличие allDailyData
    console.log(`🔍 Проверка allDailyData в метриках:`);
    allMetricsForLanding.forEach((metric, idx) => {
      const firstDay = metric.data?.allDailyData?.[0];
      console.log(`  Метрика ${idx}:`, {
        found: metric.found,
        hasData: !!metric.data,
        hasAllDailyData: !!metric.data?.allDailyData,
        allDailyDataLength: metric.data?.allDailyData?.length,
        firstDay: firstDay,
        firstDay_has_source_id: !!firstDay?.source_id_tracker,
        firstDay_source_id: firstDay?.source_id_tracker
      });
    });

    const validMetrics = allMetricsForLanding.filter(metric => {
      const isValid = metric.found && metric.data && metric.data.allDailyData && metric.data.allDailyData.length > 0;
      if (!isValid) {
        console.log(`❌ Метрика НЕ валидна:`, {
          found: metric.found,
          hasData: !!metric.data,
          hasAllDailyData: !!metric.data?.allDailyData,
          length: metric.data?.allDailyData?.length
        });
      }
      return isValid;
    });

    console.log(`✅ Валидных метрик: ${validMetrics.length}`);

    if (validMetrics.length === 0) {
      console.log(`⚠️ Нет валидных метрик для байеров для ${landing.id}`);
      return [];
    }

    // Собираем все дневные данные со source_id_tracker И источником
    const allDailyDataWithSources = validMetrics.flatMap(metric => {
      const dailyData = metric.data.allDailyData || [];
      const source = metric.source; // Получаем источник из метрики (google/facebook/tiktok)
      console.log(`📊 Обработка метрики: found=${metric.found}, source=${source}, dailyData.length=${dailyData.length}`);

      if (dailyData.length > 0) {
        console.log(`📊 Первый день метрики:`, {
          date: dailyData[0].date,
          source_id_tracker: dailyData[0].source_id_tracker,
          has_source_id: !!dailyData[0].source_id_tracker,
          source: source
        });
      }

      return dailyData.map(day => {
        const sourceId = day.source_id_tracker || 'unknown';
        console.log(`   День: date=${day.date}, source_id_tracker="${sourceId}", source="${source}"`);
        return {
          date: day.date,
          leads: day.leads || 0,
          cost: day.cost || 0,
          clicks: day.clicks || 0,
          impressions: day.impressions || 0,
          avg_duration: day.avg_duration || 0,
          cost_from_sources: day.cost_from_sources || 0,
          clicks_on_link: day.clicks_on_link || 0,
          source_id_tracker: sourceId,
          source: source // Добавляем источник к данным дня
        };
      });
    });

    console.log(`📊 Всего дневных записей: ${allDailyDataWithSources.length}`);
    console.log(`📊 Первая дневная запись:`, allDailyDataWithSources[0]);
    console.log(`📊 ВСЕ ДНЕВНЫЕ ЗАПИСИ:`, allDailyDataWithSources);

    // Группируем по source_id_tracker
    const metricsBySourceId = new Map();

    allDailyDataWithSources.forEach(day => {
      const sourceId = day.source_id_tracker || 'unknown';
      
      console.log(`🔍 День ${day.date}: source_id_tracker = "${sourceId}" (тип: ${typeof sourceId})`);
      
      if (!metricsBySourceId.has(sourceId)) {
        metricsBySourceId.set(sourceId, []);
      }
      
      metricsBySourceId.get(sourceId).push(day);
    });

    console.log(`📊 Уникальных source_id_tracker: ${metricsBySourceId.size}`);
    console.log(`📊 Все source_id_tracker (ДЕТАЛЬНО):`, Array.from(metricsBySourceId.keys()));
    console.log(`📊 Map.entries():`, Array.from(metricsBySourceId.entries()));

    // Проверяем buyerSources
    console.log(`👥 Всего байеров: ${buyers.length}`);
    console.log(`📋 buyerSources Map размер: ${buyerSources.size}`);
    
    buyers.forEach(buyer => {
      const sources = buyerSources.get(buyer.id);
      console.log(`  Байер ${buyer.name} (${buyer.id}):`, {
        hasSources: !!sources,
        sourcesCount: sources?.length || 0,
        sources: sources,
        sourcesType: sources ? sources.map(s => typeof s) : []
      });
    });

    // Теперь сопоставляем source_id с байерами
    const buyerMetrics = [];

    buyers.forEach(buyer => {
      const buyerSourceIds = buyerSources.get(buyer.id) || [];
      
      console.log(`🔍 Проверка байера ${buyer.name}:`, {
        buyer_id: buyer.id,
        buyerSourceIds: buyerSourceIds,
        buyerSourceIdsLength: buyerSourceIds.length,
        buyerSourceIdsTypes: buyerSourceIds.map(s => typeof s)
      });

      if (buyerSourceIds.length === 0) {
        console.log(`  ⚠️ У байера ${buyer.name} нет source_ids`);
        return;
      }

      // Собираем метрики для всех source_ids этого байера
      const buyerDailyData = [];

      buyerSourceIds.forEach(sourceId => {
        // КРИТИЧНО: Приводим к строке для сравнения
        const sourceIdStr = String(sourceId).trim();
        
        console.log(`    🔍 ДЕТАЛЬНЫЙ ПОИСК source_id: "${sourceIdStr}" (тип: ${typeof sourceIdStr})`);
        
        // Проверяем прямое совпадение
        let metricsForSource = metricsBySourceId.get(sourceIdStr);
        
        if (!metricsForSource) {
          // Если не нашли прямым совпадением, ищем по всем ключам
          console.log(`    🔍 Прямое совпадение не найдено, ищем во всех ключах Map...`);
          
          for (const [mapKey, mapValue] of metricsBySourceId.entries()) {
            const mapKeyStr = String(mapKey).trim();
            console.log(`      Сравниваем "${sourceIdStr}" === "${mapKeyStr}" ? ${sourceIdStr === mapKeyStr}`);
            
            if (mapKeyStr === sourceIdStr) {
              console.log(`      ✅ НАЙДЕНО СОВПАДЕНИЕ!`);
              metricsForSource = mapValue;
              break;
            }
          }
        }
        
        console.log(`    📊 Результат поиска:`, {
          sourceId: sourceIdStr,
          found: !!metricsForSource,
          count: metricsForSource?.length || 0
        });
        
        if (metricsForSource && metricsForSource.length > 0) {
          console.log(`    ✅ ДОБАВЛЯЕМ ${metricsForSource.length} записей для source_id: ${sourceIdStr}`);
          buyerDailyData.push(...metricsForSource);
        }
      });

      console.log(`  📊 Байер ${buyer.name}: найдено ${buyerDailyData.length} дневных записей`);

      if (buyerDailyData.length === 0) {
        console.log(`  ⚠️ У байера ${buyer.name} нет метрик для этого лендинга`);
        return;
      }

      // Фильтруем по периоду отображения
      const filteredDailyData = filterMetricsByDisplayPeriod(buyerDailyData, metricsDisplayPeriod);

      // Агрегируем метрики байера
      const uniqueDates = new Set();
      
      const aggregated = filteredDailyData.reduce((acc, day) => {
        if (day.date) {
          uniqueDates.add(day.date);
        }
        
        return {
          leads: acc.leads + (day.leads || 0),
          cost: acc.cost + (day.cost || 0),
          clicks: acc.clicks + (day.clicks || 0),
          impressions: acc.impressions + (day.impressions || 0),
          duration_sum: acc.duration_sum + (day.avg_duration || 0),
          cost_from_sources: acc.cost_from_sources + (day.cost_from_sources || 0),
          clicks_on_link: acc.clicks_on_link + (day.clicks_on_link || 0)
        };
      }, {
        leads: 0,
        cost: 0,
        clicks: 0,
        impressions: 0,
        duration_sum: 0,
        cost_from_sources: 0,
        clicks_on_link: 0
      });

      const uniqueDaysCount = uniqueDates.size;
      const avgDuration = uniqueDaysCount > 0 ? aggregated.duration_sum / uniqueDaysCount : 0;

      const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
      const cr = aggregated.clicks > 0 ? (aggregated.leads / aggregated.clicks) * 100 : 0;

      console.log(`  ✅ Агрегированные метрики для ${buyer.name}:`, {
        leads: aggregated.leads,
        cost: aggregated.cost,
        cpl: cpl
      });

      // Определяем source для байера (берем первый найденный)
      const buyerSource = filteredDailyData.find(day => day.source)?.source || null;
      console.log(`  🔍 Источник для байера ${buyer.name}: ${buyerSource}`);

      buyerMetrics.push({
        buyer_id: buyer.id,
        buyer_name: buyer.name,
        buyer_avatar: buyer.avatar_url,
        buyer_source: buyerSource, // Добавляем источник
        found: true,
        data: {
          raw: {
            leads: aggregated.leads,
            cost: aggregated.cost,
            clicks: aggregated.clicks,
            impressions: aggregated.impressions,
            avg_duration: Number(avgDuration.toFixed(2)),
            days_count: uniqueDaysCount,
            cost_from_sources: aggregated.cost_from_sources,
            clicks_on_link: aggregated.clicks_on_link,
            cpl: Number(cpl.toFixed(2)),
            cr_percent: Number(cr.toFixed(2))
          },
          formatted: {
            leads: String(Math.round(aggregated.leads)),
            cpl: `${cpl.toFixed(2)}$`,
            cost: `${aggregated.cost.toFixed(2)}$`,
            clicks: String(Math.round(aggregated.clicks)),
            cr: `${cr.toFixed(2)}%`,
            days: String(uniqueDaysCount)
          }
        }
      });
    });

    console.log(`✅✅✅ ИТОГО: Метрики сгруппированы для ${buyerMetrics.length} байеров`);
    console.log(`📊 Детали байеров:`, buyerMetrics.map(b => ({
      name: b.buyer_name,
      leads: b.data.formatted.leads,
      cpl: b.data.formatted.cpl
    })));

    return buyerMetrics;
  };

  // Получение агрегированных метрик для лендинга
  const getAggregatedLandingMetrics = (landing) => {
    console.log(`🔍 Получение метрик для лендинга: ${landing.id} (${landing.article})`);

    // Получаем все метрики для этого лендинга (по всем источникам)
    const allMetricsForLanding = getAllLandingMetrics(landing.id);

    console.log(`📊 Найдено метрик для ${landing.id}:`, allMetricsForLanding.length);

    if (!allMetricsForLanding || allMetricsForLanding.length === 0) {
      console.log(`⚠️ Нет метрик для ${landing.id}`);
      return null;
    }

    const validMetrics = allMetricsForLanding.filter(metric => {
      const isValid = metric.found && metric.data && metric.data.allDailyData;
      if (!isValid) {
        console.log(`❌ Пропущена невалидная метрика для ${landing.id}:`, {
          found: metric.found,
          hasData: !!metric.data,
          hasAllDailyData: metric.data ? !!metric.data.allDailyData : false
        });
      }
      return isValid;
    });

    console.log(`✅ Валидных метрик для ${landing.id}:`, validMetrics.length);

    if (validMetrics.length === 0) {
      console.log(`⚠️ Нет валидных метрик для отображения для ${landing.id}`);
      return null;
    }

    // Собираем все дневные данные из всех источников
    const allDailyDataCombined = validMetrics.flatMap(metric => metric.data.allDailyData || []);

    console.log(`📊 Всего дневных записей до фильтрации: ${allDailyDataCombined.length}`);

    // Фильтруем по периоду отображения
    const filteredDailyData = filterMetricsByDisplayPeriod(allDailyDataCombined, metricsDisplayPeriod);

    console.log(`📊 Отфильтровано дневных записей для периода ${metricsDisplayPeriod}: ${filteredDailyData.length}`);

    if (filteredDailyData.length === 0) {
      console.log(`⚠️ Нет данных после фильтрации для ${landing.id}`);
      return null;
    }

    // Собираем уникальные даты
    const uniqueDates = new Set();
    
    const aggregated = filteredDailyData.reduce((acc, day) => {
      // Добавляем дату в Set уникальных дат
      if (day.date) {
        uniqueDates.add(day.date);
      }
      
      return {
        leads: acc.leads + (day.leads || 0),
        cost: acc.cost + (day.cost || 0),
        clicks: acc.clicks + (day.clicks || 0),
        impressions: acc.impressions + (day.impressions || 0),
        duration_sum: acc.duration_sum + (day.avg_duration || 0),
        cost_from_sources: acc.cost_from_sources + (day.cost_from_sources || 0),
        clicks_on_link: acc.clicks_on_link + (day.clicks_on_link || 0)
      };
    }, {
      leads: 0,
      cost: 0,
      clicks: 0,
      impressions: 0,
      duration_sum: 0,
      cost_from_sources: 0,
      clicks_on_link: 0
    });

    // Количество уникальных дней
    const uniqueDaysCount = uniqueDates.size;

    console.log(`📈 Итоговые агрегированные метрики для ${landing.id}:`, {
      ...aggregated,
      days_count: uniqueDaysCount
    });

    const avgDuration = uniqueDaysCount > 0 ? aggregated.duration_sum / uniqueDaysCount : 0;

    const cpl = aggregated.leads > 0 ? aggregated.cost / aggregated.leads : 0;
    const ctr = aggregated.impressions > 0 ? (aggregated.clicks_on_link / aggregated.impressions) * 100 : 0;
    const cpc = aggregated.clicks > 0 ? aggregated.cost / aggregated.clicks : 0;
    const cpm = aggregated.impressions > 0 ? (aggregated.cost_from_sources / aggregated.impressions) * 1000 : 0;

    const result = {
      found: true,
      videoCount: validMetrics.length,
      totalVideos: allMetricsForLanding.length,
      data: {
        raw: {
          leads: aggregated.leads,
          cost: aggregated.cost,
          clicks: aggregated.clicks,
          impressions: aggregated.impressions,
          avg_duration: Number(avgDuration.toFixed(2)),
          days_count: uniqueDaysCount,
          cost_from_sources: aggregated.cost_from_sources,
          clicks_on_link: aggregated.clicks_on_link,
          cpl: Number(cpl.toFixed(2)),
          ctr_percent: Number(ctr.toFixed(2)),
          cpc: Number(cpc.toFixed(2)),
          cpm: Number(cpm.toFixed(2))
        },
        formatted: {
          leads: String(Math.round(aggregated.leads)),
          cpl: aggregated.leads > 0 ? `${cpl.toFixed(2)}$` : '0.00$',
          cost: `${aggregated.cost.toFixed(2)}$`,
          ctr: `${ctr.toFixed(2)}%`,
          cpc: `${cpc.toFixed(2)}$`,
          cpm: `${cpm.toFixed(2)}$`,
          clicks: String(Math.round(aggregated.clicks)),
          impressions: String(Math.round(aggregated.impressions)),
          avg_duration: `${avgDuration.toFixed(1)}с`,
          days: String(uniqueDaysCount)
        }
      }
    };

    console.log(`✅ Возвращаем агрегированные метрики для ${landing.id}:`, {
      leads: result.data.formatted.leads,
      cost: result.data.formatted.cost,
      cpl: result.data.formatted.cpl,
      days: result.data.formatted.days
    });

    return result;
  };

// Фильтрация метрик по периоду отображения
  const filterMetricsByDisplayPeriod = (allDailyData, displayPeriod) => {
    if (!allDailyData || allDailyData.length === 0) {
      return [];
    }

    if (displayPeriod === 'all') {
      return allDailyData;
    }

    // Обработка пользовательского диапазона дат
    if (displayPeriod === 'custom_metrics' && metricsCustomDateFrom && metricsCustomDateTo) {
      const fromDate = new Date(metricsCustomDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(metricsCustomDateTo);
      toDate.setHours(23, 59, 59, 999);

      const filteredData = allDailyData.filter(item => {
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        return itemDate >= fromDate && itemDate <= toDate;
      });

      console.log(`📊 Фильтрация по пользовательскому периоду метрик:`);
      console.log(`   От: ${metricsCustomDateFrom.toLocaleDateString('ru-RU')}`);
      console.log(`   До: ${metricsCustomDateTo.toLocaleDateString('ru-RU')}`);
      console.log(`   Отфильтровано записей: ${filteredData.length} из ${allDailyData.length}`);

      return filteredData;
    }

    // Определение диапазонов дат (аналогично фильтру создания лендингов)
    const now = new Date();
    let fromDate = null;
    let toDate = null;

    switch (displayPeriod) {
      case 'today': {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      }
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        fromDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        toDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      }
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - daysToMonday);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(fromDate);
        toDate.setDate(fromDate.getDate() + 6);
        toDate.setHours(23, 59, 59);
        break;
      }
      case 'last_7_days': {
        fromDate = new Date(now);
        fromDate.setDate(now.getDate() - 6);
        fromDate.setHours(0, 0, 0, 0);
        toDate = new Date(now);
        toDate.setHours(23, 59, 59);
        break;
      }
      case 'this_month': {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      }
      case 'last_month': {
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        toDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      }
      default:
        return allDailyData;
    }

    if (!fromDate || !toDate) {
      return allDailyData;
    }

    // Фильтруем метрики по диапазону дат
    const filteredData = allDailyData.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      return itemDate >= fromDate && itemDate <= toDate;
    });

    console.log(`📊 Фильтрация по периоду ${displayPeriod}:`);
    console.log(`   От: ${fromDate.toLocaleDateString('ru-RU')}`);
    console.log(`   До: ${toDate.toLocaleDateString('ru-RU')}`);
    console.log(`   Отфильтровано записей: ${filteredData.length} из ${allDailyData.length}`);

    return filteredData;
  };

  // Компонент отображения зональных данных
  const ZoneDataDisplay = ({ article }) => {
    const zoneData = getZoneDataForArticle(article);

    if (!zoneData) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const zones = [];
    if (zoneData.red !== '—') zones.push({ color: 'red', value: zoneData.red, bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' });
    if (zoneData.pink !== '—') zones.push({ color: 'pink', value: zoneData.pink, bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' });
    if (zoneData.gold !== '—') zones.push({ color: 'gold', value: zoneData.gold, bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' });
    if (zoneData.green !== '—') zones.push({ color: 'green', value: zoneData.green, bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' });

    if (zones.length === 0) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-1 w-24 mx-auto">
        {zones.map((zone) => (
          <span
            key={zone.color}
            className={`font-mono font-bold flex items-center justify-center w-11 h-6 rounded-full text-xs border ${zone.bg} ${zone.text} ${zone.border} text-center`}
            style={{ fontSize: '10px' }}
          >
            {zone.value}
          </span>
        ))}
      </div>
    );
  };

  // Определение текущей зоны на основе CPL
  const getCurrentZoneByMetrics = (article, cplValue) => {
    const zoneData = getZoneDataForArticle(article);

    if (!zoneData || !cplValue || cplValue <= 0 || isNaN(cplValue)) {
      return null;
    }

    const zones = [];

    if (zoneData.red !== '—') {
      const price = parseFloat(zoneData.red.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'red', price, name: 'Красная' });
    }

    if (zoneData.pink !== '—') {
      const price = parseFloat(zoneData.pink.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'pink', price, name: 'Розовая' });
    }

    if (zoneData.gold !== '—') {
      const price = parseFloat(zoneData.gold.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'gold', price, name: 'Золотая' });
    }

    if (zoneData.green !== '—') {
      const price = parseFloat(zoneData.green.replace('$', ''));
      if (!isNaN(price)) zones.push({ zone: 'green', price, name: 'Зеленая' });
    }

    if (zones.length === 0) {
      return null;
    }

    zones.sort((a, b) => a.price - b.price);

    for (let i = 0; i < zones.length; i++) {
      const currentZone = zones[i];

      if (i === 0) {
        if (cplValue < currentZone.price) {
          return {
            zone: currentZone.zone,
            name: currentZone.name,
            price: currentZone.price
          };
        }
      } else {
        const prevZone = zones[i - 1];
        if (cplValue >= prevZone.price && cplValue < currentZone.price) {
          return {
            zone: currentZone.zone,
            name: currentZone.name,
            price: currentZone.price
          };
        }
      }
    }

    const mostExpensive = zones[zones.length - 1];
    return {
      zone: mostExpensive.zone,
      name: mostExpensive.name,
      price: mostExpensive.price
    };
  };

  // Отображение текущей зоны
  const CurrentZoneDisplay = ({ article, metricsData }) => {
    if (!metricsData?.found || !metricsData.data) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const cplString = metricsData.data.formatted.cpl;
    const cplValue = parseFloat(cplString.replace('$', ''));

    if (isNaN(cplValue)) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const currentZone = getCurrentZoneByMetrics(article, cplValue);

    if (!currentZone) {
      return (
        <div className="text-center">
          <span className="text-gray-400 text-xs">—</span>
        </div>
      );
    }

    const getZoneColors = (zone) => {
      switch (zone) {
        case 'red':
          return { bg: 'bg-red-500', text: 'text-white', border: 'border-red-500' };
        case 'pink':
          return { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-500' };
        case 'gold':
          return { bg: 'bg-yellow-500', text: 'text-black', border: 'border-yellow-500' };
        case 'green':
          return { bg: 'bg-green-500', text: 'text-white', border: 'border-green-500' };
        default:
          return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-500' };
      }
    };

    const colors = getZoneColors(currentZone.zone);

    return (
      <div className="text-center">
        <span
          className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}
          title={`CPL: $${cplValue.toFixed(2)} ≤ $${currentZone.price.toFixed(2)}`}
        >
          {currentZone.name}
        </span>
      </div>
    );
  };

  // Статистика по тегам
  const getTagsStats = (landingsData) => {
    const allTags = landingsData.reduce((acc, landing) => {
      if (landing.tags && Array.isArray(landing.tags)) {
        landing.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
      }
      return acc;
    }, {});

    return allTags;
  };

  // Подсчет по странам
  const getCountryStats = (landingsData) => {
    const ukraineCount = landingsData.filter(l => !l.is_poland).length;
    const polandCount = landingsData.filter(l => l.is_poland).length;
    return { ukraineCount, polandCount };
  };

  // Подсчет по зонам
  const getZoneStats = (landingsData) => {
    const zoneCount = { red: 0, pink: 0, gold: 0, green: 0 };

    landingsData.forEach(landing => {
      const aggregatedMetrics = getAggregatedLandingMetrics(landing);
      if (aggregatedMetrics?.found && aggregatedMetrics.data) {
        const cplString = aggregatedMetrics.data.formatted.cpl;
        const cplValue = parseFloat(cplString.replace('$', ''));

        if (!isNaN(cplValue)) {
          const currentZone = getCurrentZoneByMetrics(landing.article, cplValue);
          if (currentZone) {
            zoneCount[currentZone.zone]++;
          }
        }
      }
    });

    return zoneCount;
  };

  useEffect(() => {
    const init = async () => {
      loadUsers();
      loadTemplatesAndTags();
      loadBuyerSources();
      await loadLandings();
      loadLastUpdateTime();
    };

    init();
  }, []);

  // Закрытие дропдаунов фильтров при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Проверяем, что клик был не на кнопках фильтра и не внутри дропдаунов
      const clickedOnTypeButton = typeFilterButtonRef.current?.contains(event.target);
      const clickedOnVerificationButton = verificationFilterButtonRef.current?.contains(event.target);
      const clickedOnCommentButton = commentFilterButtonRef.current?.contains(event.target);
      const clickedOnHistoryButton = historyFilterButtonRef.current?.contains(event.target);
      const clickedOnCountryButton = countryFilterButtonRef.current?.contains(event.target);
      const clickedOnVersionButton = versionFilterButtonRef.current?.contains(event.target);
      const clickedOnTemplateButton = templateFilterButtonRef.current?.contains(event.target);
      const clickedOnTagsButton = tagsFilterButtonRef.current?.contains(event.target);
      const clickedOnStatusButton = statusFilterButtonRef.current?.contains(event.target);
      const clickedOnDesignerButton = designerFilterButtonRef.current?.contains(event.target);
      const clickedOnBuyerTableButton = buyerFilterTableButtonRef.current?.contains(event.target);
      const clickedOnSearcherTableButton = searcherFilterTableButtonRef.current?.contains(event.target);
      const clickedOnProductManagerButton = productManagerFilterButtonRef.current?.contains(event.target);
      const clickedOnGiferButton = giferFilterButtonRef.current?.contains(event.target);
      const clickedOnContentManagerButton = contentManagerFilterButtonRef.current?.contains(event.target);
      const clickedOnZoneButton = zoneFilterButtonRef.current?.contains(event.target);
      const clickedOnSourceButton = sourceFilterButtonRef.current?.contains(event.target);

      // Проверяем, был ли клик внутри любого dropdown фильтра
      // Используем data-атрибут для надёжного определения
      const clickedOnDropdown = event.target.closest('[data-filter-dropdown="true"]') !== null;

      if (!clickedOnTypeButton && !clickedOnVerificationButton && !clickedOnCommentButton && !clickedOnHistoryButton && !clickedOnCountryButton && !clickedOnVersionButton && !clickedOnTemplateButton && !clickedOnTagsButton && !clickedOnStatusButton && !clickedOnDesignerButton && !clickedOnBuyerTableButton && !clickedOnSearcherTableButton && !clickedOnProductManagerButton && !clickedOnGiferButton && !clickedOnContentManagerButton && !clickedOnZoneButton && !clickedOnSourceButton && !clickedOnDropdown) {
        setShowTypeFilterDropdown(false);
        setShowVerificationFilterDropdown(false);
        setShowCommentFilterDropdown(false);
        setShowHistoryFilterDropdown(false);
        setShowCountryFilterDropdown(false);
        setShowVersionFilterDropdown(false);
        setShowTemplateFilterDropdown(false);
        setShowTagsFilterDropdown(false);
        setShowStatusFilterDropdown(false);
        setShowDesignerFilterDropdown(false);
        setShowBuyerFilterTableDropdown(false);
        setShowSearcherFilterTableDropdown(false);
        setShowProductManagerFilterDropdown(false);
        setShowGiferFilterDropdown(false);
        setShowContentManagerFilterDropdown(false);
        setShowZoneFilterDropdown(false);
        setShowSourceFilterDropdown(false);
      }
    };

    if (showTypeFilterDropdown || showVerificationFilterDropdown || showCommentFilterDropdown || showHistoryFilterDropdown || showCountryFilterDropdown || showVersionFilterDropdown || showTemplateFilterDropdown || showTagsFilterDropdown || showStatusFilterDropdown || showDesignerFilterDropdown || showBuyerFilterTableDropdown || showSearcherFilterTableDropdown || showProductManagerFilterDropdown || showGiferFilterDropdown || showContentManagerFilterDropdown || showZoneFilterDropdown || showSourceFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTypeFilterDropdown, showVerificationFilterDropdown, showCommentFilterDropdown, showHistoryFilterDropdown, showCountryFilterDropdown, showVersionFilterDropdown, showTemplateFilterDropdown, showTagsFilterDropdown, showStatusFilterDropdown, showDesignerFilterDropdown, showBuyerFilterTableDropdown, showSearcherFilterTableDropdown, showProductManagerFilterDropdown, showGiferFilterDropdown, showContentManagerFilterDropdown, showZoneFilterDropdown, showSourceFilterDropdown]);

  // Закрытие дропдаунов фильтров байеров, серчеров и гиферов при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Проверяем, что клик был не на кнопках фильтра и не внутри дропдаунов
      const clickedOnBuyerButton = event.target.closest('.filter-buyer-trigger') !== null;
      const clickedOnSearcherButton = event.target.closest('.filter-searcher-trigger') !== null;
      const clickedOnBuyerDropdown = event.target.closest('.filter-buyer-dropdown') !== null;
      const clickedOnSearcherDropdown = event.target.closest('.filter-searcher-dropdown') !== null;

      if (!clickedOnBuyerButton && !clickedOnBuyerDropdown) {
        setShowFilterBuyerDropdown(false);
      }

      if (!clickedOnSearcherButton && !clickedOnSearcherDropdown) {
        setShowFilterSearcherDropdown(false);
      }
    };

    if (showFilterBuyerDropdown || showFilterSearcherDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showFilterBuyerDropdown, showFilterSearcherDropdown]);

  // Автозагрузка метрик после загрузки лендингов
  useEffect(() => {
    if (filteredLandings.length > 0 && !landingMetricsLoading) {
      console.log('🔄 Автозагрузка метрик для загруженных лендингов');
      console.log(`📋 Количество лендингов для загрузки метрик: ${filteredLandings.length}`);
      refreshLandingMetrics();
    }
  }, [filteredLandings.length]);

  useEffect(() => {
    // Подписка на создание новых лендингов
    const landingsSubscription = supabase
      .channel('landings_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'landings'
        },
        async (payload) => {
          console.log('🆕 Новый лендинг создан:', payload.new.article);

          if (payload.new.trello_link) {
            console.log('⏳ Ждем синхронизации Trello статуса для', payload.new.article);

            setTimeout(async () => {
              try {
                console.log('🔍 Проверяем статус для', payload.new.id);
                const status = await trelloLandingService.getCardStatus(payload.new.id);

                if (status) {
                  console.log('✅ Статус получен:', status.list_name);
                  setTrelloStatuses(prev => {
                    const newMap = new Map(prev);
                    newMap.set(payload.new.id, status);
                    return newMap;
                  });
                } else {
                  console.log('⚠️ Статус еще не синхронизирован, перезагружаем все статусы...');
                  loadTrelloStatuses();
                }
              } catch (error) {
                console.error('❌ Ошибка получения статуса:', error);
                loadTrelloStatuses();
              }
            }, 2000);
          }
        }
      )
      .subscribe();

    // Подписка на изменения статусов Trello
    const trelloSubscription = trelloLandingService.subscribeToCardStatuses((payload) => {
      console.log('🔄 Trello status changed:', payload);

      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        console.log('➕ Обновляем статус для лендинга:', payload.new.landing_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.set(payload.new.landing_id, payload.new);
          return newMap;
        });

        // Обновляем лендинг в списке если он уже загружен
        setLandings(prevLandings => {
          return prevLandings.map(landing => {
            if (landing.id === payload.new.landing_id) {
              console.log(`🔄 Обновляем статус лендинга ${landing.article} на ${payload.new.list_name}`);
            }
            return landing;
          });
        });
      } else if (payload.eventType === 'DELETE') {
        console.log('➖ Удаляем статус для лендинга:', payload.old.landing_id);
        setTrelloStatuses(prev => {
          const newMap = new Map(prev);
          newMap.delete(payload.old.landing_id);
          return newMap;
        });
      }
    });

    return () => {
      landingsSubscription.unsubscribe();
      trelloSubscription.unsubscribe();
    };
  }, []);

  // Загрузка Trello статусов после загрузки лендингов
  useEffect(() => {
    if (landings && landings.length > 0) {
      console.log('🟢 Запускаем loadTrelloStatuses...');
      loadTrelloStatuses();
    }
  }, [landings]);

  const loadLastUpdateTime = async () => {
    try {
      const lastUpdate = await metricsAnalyticsService.getMetricsLastUpdate();
      setMetricsLastUpdate(lastUpdate);
    } catch (error) {
      console.error('Ошибка загрузки времени последнего обновления:', error);
    }
  };

  // Загрузка статусов Trello карточек
  const loadTrelloStatuses = async () => {
    try {
      console.log('🟢 loadTrelloStatuses СТАРТ');

      const lists = await trelloLandingService.getAllLists();
      setTrelloLists(lists);
      console.log(`✅ Загружено ${lists.length} списков Trello`);

      const landingIds = landings.map(l => l.id);
      console.log(`🔍 Запрос статусов для ${landingIds.length} лендингов`);

      if (landingIds.length > 0) {
        const statusMap = await trelloLandingService.getBatchCardStatuses(landingIds);
        setTrelloStatuses(statusMap);
        console.log(`✅ Установлено ${statusMap.size} статусов в состояние`);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки Trello статусов:', error);
    }
  };

  // Синхронизация только лендингов без статуса
  const syncMissingTrelloStatuses = async () => {
    try {
      console.log('🔄 Синхронизация лендингов без статуса...');

      const landingsWithoutStatus = filteredLandings.filter(landing => {
        const hasLink = !!landing.trello_link;
        const status = getTrelloListName(landing.id);
        const hasStatus = status && status !== '—';
        return hasLink && !hasStatus;
      });

      if (landingsWithoutStatus.length === 0) {
        console.log('✅ Все лендинги уже имеют статусы');
        setSuccess('Все лендинги уже синхронизированы');
        setTimeout(() => setSuccess(''), 3000);
        return;
      }

      console.log(`⚠️ Найдено ${landingsWithoutStatus.length} лендингов без статуса`);

      const syncingIds = new Set(landingsWithoutStatus.map(l => l.id));
      setSyncingLandings(syncingIds);

      let successCount = 0;
      let errorCount = 0;

      for (const landing of landingsWithoutStatus) {
        try {
          console.log(`🔄 Синхронизация ${landing.article}...`);

          const result = await trelloLandingService.syncSingleLanding(
            landing.id,
            landing.trello_link,
            landing.is_test
          );

          if (result.success) {
            console.log(`✅ Статус синхронизирован: ${result.listName}`);

            setTrelloStatuses(prev => {
              const updated = new Map(prev);
              updated.set(landing.id, {
                creative_id: landing.id,
                list_name: result.listName,
                list_id: result.listId,
                trello_card_id: result.cardId,
                last_updated: new Date().toISOString()
              });
              return updated;
            });

            successCount++;
          }
        } catch (error) {
          console.error(`❌ Ошибка синхронизации ${landing.article}:`, error.message);
          errorCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setSyncingLandings(new Set());

      if (successCount > 0 || errorCount > 0) {
        const message = `Синхронизация завершена: успешно ${successCount}, ошибок ${errorCount}`;
        console.log(`🎉 ${message}`);
        setSuccess(message);
        setTimeout(() => setSuccess(''), 5000);
      }

    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
      setSyncingLandings(new Set());
      setError(`Ошибка синхронизации: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Получить название списка для лендинга
  const getTrelloListName = (landingId) => {
    const status = trelloStatuses.get(landingId);
    return status?.list_name || '—';
  };

  const loadLandings = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('📡 Загрузка всех лендингов для Editor...');
      const data = await landingService.getAllLandings();
      
      console.log('🔍 ПЕРВЫЙ ЛЕНДИНГ ИЗ БАЗЫ:', data[0]);
      console.log('🔍 Шаблон первого лендинга:', data[0]?.template);
      console.log('🔍 Теги первого лендинга:', data[0]?.tags);

      // Загружаем данные о verified_urls для каждого лендинга
      const landingsWithUrls = await Promise.all(
        data.map(async (landing) => {
          try {
            const { data: landingData, error } = await supabase
              .from('landings')
              .select('verified_urls')
              .eq('id', landing.id)
              .single();

            if (!error && landingData) {
              return { ...landing, verified_urls: landingData.verified_urls || [] };
            }
            return { ...landing, verified_urls: [] };
          } catch (err) {
            console.error(`Ошибка загрузки verified_urls для ${landing.id}:`, err);
            return { ...landing, verified_urls: [] };
          }
        })
      );

      setLandings(landingsWithUrls);
      console.log(`✅ Загружено ${landingsWithUrls.length} лендингов`);
      
      // ДЕТАЛЬНАЯ ДИАГНОСТИКА
      if (landingsWithUrls.length > 0) {
        console.log('🔍 ДИАГНОСТИКА ПЕРВОГО ЛЕНДИНГА:');
        console.log('  ID:', landingsWithUrls[0].id);
        console.log('  Article:', landingsWithUrls[0].article);
        console.log('  Template (строка):', landingsWithUrls[0].template);
        console.log('  Template ID:', landingsWithUrls[0].template_id);
        console.log('  Tags (массив строк):', landingsWithUrls[0].tags);
        console.log('  Tag IDs:', landingsWithUrls[0].tag_ids);
        console.log('  Tags type:', typeof landingsWithUrls[0].tags);
        console.log('  Tags is array:', Array.isArray(landingsWithUrls[0].tags));
      }

      const landingsWithHistorySet = new Set();
      for (const landing of landingsWithUrls) {
        const hasHistory = await landingHistoryService.hasHistory(landing.id);
        if (hasHistory) {
          landingsWithHistorySet.add(landing.id);
        }
      }
      setLandingsWithHistory(landingsWithHistorySet);

      return landingsWithUrls;
    } catch (error) {
      console.error('❌ Ошибка загрузки лендингов:', error);
      setError('Ошибка загрузки лендингов: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      console.log('👥 Загрузка пользователей...');

      const [buyersData, searchersData, designersData, productManagersData, gifersData, contentManagersData] = await Promise.all([
        userService.getUsersByRole('buyer'),
        userService.getUsersByRole('search_manager'),
        userService.getUsersByRole('designer'),
        userService.getUsersByRole('product_manager'),
        userService.getUsersByRole('gif_creator'),
        userService.getUsersByRole('content_manager')
      ]);

      setBuyers(buyersData);
      setSearchers(searchersData);
      setDesigners(designersData);
      setProductManagers(productManagersData);
      setGifers(gifersData);
      setContentManagers(contentManagersData);
      console.log(`✅ Загружено ${buyersData.length} байеров, ${searchersData.length} серчеров, ${designersData.length} дизайнеров, ${productManagersData.length} продакт менеджеров, ${gifersData.length} гиферов и ${contentManagersData.length} контент менеджеров`);
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTemplatesAndTags = async () => {
    try {
      setLoadingTemplates(true);
      setLoadingTags(true);
      console.log('📋 Загрузка шаблонов и тегов...');

      const [templatesData, tagsData] = await Promise.all([
        landingTemplatesService.getActiveTemplates(),
        landingTagsService.getActiveTags()
      ]);

      console.log('🔍 Полученные шаблоны:', templatesData);
      console.log('🔍 Полученные теги:', tagsData);

      setTemplates(templatesData);
      setTags(tagsData);
      console.log(`✅ Загружено ${templatesData.length} шаблонов и ${tagsData.length} тегов`);
      
      if (templatesData.length === 0) {
        console.warn('⚠️ ВНИМАНИЕ: Шаблонов не найдено! Проверьте RLS политики или наличие данных.');
      }
      if (tagsData.length === 0) {
        console.warn('⚠️ ВНИМАНИЕ: Тегов не найдено! Проверьте RLS политики или наличие данных.');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки шаблонов и тегов:', error);
      console.error('❌ Детали ошибки:', {
        message: error.message,
        code: error.code,
        details: error.details
      });
    } finally {
      setLoadingTemplates(false);
      setLoadingTags(false);
    }
  };

  const loadBuyerSources = async () => {
    try {
      setLoadingBuyerSources(true);
      console.log('📡 Загрузка источников байеров...');

      const sourcesData = await buyerSourceService.getAllBuyerSources();
      
      const sourcesMap = new Map();
      sourcesData.forEach(item => {
        sourcesMap.set(item.buyer_id, item.source_ids || []);
      });

      setBuyerSources(sourcesMap);
      console.log(`✅ Загружено источников для ${sourcesData.length} байеров`);
    } catch (error) {
      console.error('❌ Ошибка загрузки источников байеров:', error);
    } finally {
      setLoadingBuyerSources(false);
    }
  };

  const showComment = (landing) => {
    setSelectedComment({
      article: landing.article,
      comment: landing.comment,
      createdAt: landing.created_at,
      contentManagerName: landing.content_manager_name
    });
    setShowCommentModal(true);
  };

  const showHistory = async (landing) => {
    setLoadingHistory(true);
    setShowHistoryModal(true);
    setSelectedHistory(landing);

    try {
      const history = await landingHistoryService.getLandingHistory(landing.id);
      setHistoryData(history);
    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      setError('Ошибка загрузки истории: ' + error.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleTags = (landingId) => {
    const newExpanded = new Set(expandedTags);
    if (newExpanded.has(landingId)) {
      newExpanded.delete(landingId);
    } else {
      newExpanded.add(landingId);
    }
    setExpandedTags(newExpanded);
  };

    const toggleBuyers = (landingId) => {
    const newExpanded = new Set(expandedBuyers);
    if (newExpanded.has(landingId)) {
      newExpanded.delete(landingId);
    } else {
      newExpanded.add(landingId);
    }
    setExpandedBuyers(newExpanded);
  };

  const toggleDropdown = (landingId) => {
    const newOpenDropdowns = new Set(openDropdowns);
    if (newOpenDropdowns.has(landingId)) {
      newOpenDropdowns.delete(landingId);
    } else {
      newOpenDropdowns.add(landingId);
    }
    setOpenDropdowns(newOpenDropdowns);
  };

  const showUuidCode = async (landingId) => {
    setSelectedLandingUuid(landingId);
    setShowUuidModal(true);
    setCopiedUuid(false);
    setLoadingUrls(true);
    setVerifiedUrls([]);

    try {
      const urls = await landingService.getVerifiedUrls(landingId);
      setVerifiedUrls(urls);

      // Обновляем Map с информацией об интеграции
      setLandingsWithIntegration(prev => {
        const newMap = new Map(prev);
        newMap.set(landingId, urls && urls.length > 0);
        return newMap;
      });
    } catch (error) {
      console.error('Ошибка загрузки верифицированных URL:', error);
      setVerifiedUrls([]);
    } finally {
      setLoadingUrls(false);
    }
  };

  const handleCopyUuid = () => {
    const codeSnippet = `<div 
id="rt-meta" 
data-rt-sub16="${selectedLandingUuid}"
></div>`;

    navigator.clipboard.writeText(codeSnippet).then(() => {
      setCopiedUuid(true);
      setTimeout(() => setCopiedUuid(false), 2000);
    }).catch(err => {
      console.error('Ошибка копирования:', err);
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-menu') && !event.target.closest('.dropdown-trigger')) {
        setOpenDropdowns(new Set());
      }

      // Обработка клика вне меню метрик
      const metricsMenuContainer = event.target.closest('.metrics-period-menu-container');
      if (!metricsMenuContainer && showPeriodDropdown) {
        setShowPeriodDropdown(false);
        // Сбрасываем временные даты к сохраненным значениям
        setMetricsTempCustomDateFrom(metricsCustomDateFrom);
        setMetricsTempCustomDateTo(metricsCustomDateTo);
        setMetricsSelectingDate(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPeriodDropdown, metricsCustomDateFrom, metricsCustomDateTo]);

  const handlePeriodChange = (period) => {
    console.log(`🔄 МГНОВЕННАЯ смена периода отображения метрик: ${metricsDisplayPeriod} -> ${period}`);
    setMetricsDisplayPeriod(period);
    setShowPeriodDropdown(false);
    clearMessages();
  };

  const getPeriodButtonText = () => {
    const formatDate = (date) => {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const now = new Date();

    switch (metricsDisplayPeriod) {
      case 'today': {
        return `${formatDate(now)}`;
      }
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return `${formatDate(yesterday)}`;
      }
      case 'this_week': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysToMonday);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
      }
      case 'last_7_days': {
        const last7Start = new Date(now);
        last7Start.setDate(now.getDate() - 6);
        return `${formatDate(last7Start)} - ${formatDate(now)}`;
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${formatDate(monthStart)} - ${formatDate(monthEnd)}`;
      }
      case 'last_month': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return `${formatDate(lastMonthStart)} - ${formatDate(lastMonthEnd)}`;
      }
      case 'custom_metrics': {
        if (metricsCustomDateFrom && metricsCustomDateTo) {
          return `${formatDate(metricsCustomDateFrom)} - ${formatDate(metricsCustomDateTo)}`;
        }
        return 'Выбрать период';
      }
      case 'all': return 'Все время';
      default: return 'Все время';
    }
  };

  // Функции для календаря метрик
  const handleMetricsDateClick = (date) => {
    if (!metricsSelectingDate) {
      setMetricsTempCustomDateFrom(date);
      setMetricsSelectingDate(date);
      setMetricsTempCustomDateTo(null);
    } else {
      if (date < metricsSelectingDate) {
        setMetricsTempCustomDateFrom(date);
        setMetricsTempCustomDateTo(metricsSelectingDate);
      } else {
        setMetricsTempCustomDateTo(date);
      }
      setMetricsSelectingDate(null);
    }
  };

  const isMetricsDateInRange = (date) => {
    if (!metricsTempCustomDateFrom || !metricsTempCustomDateTo) return false;
    return date >= metricsTempCustomDateFrom && date <= metricsTempCustomDateTo;
  };

  const isMetricsDateSelected = (date) => {
    if (!metricsTempCustomDateFrom) return false;
    if (metricsTempCustomDateFrom.toDateString() === date.toDateString()) return true;
    if (metricsTempCustomDateTo && metricsTempCustomDateTo.toDateString() === date.toDateString()) return true;
    return false;
  };

  const applyMetricsCustomPeriod = () => {
    if (metricsTempCustomDateFrom && metricsTempCustomDateTo) {
      setMetricsCustomDateFrom(metricsTempCustomDateFrom);
      setMetricsCustomDateTo(metricsTempCustomDateTo);
      setMetricsDisplayPeriod('custom_metrics');
      setShowPeriodDropdown(false);
      clearMessages();
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const formatKyivTime = (dateString) => {
    try {
      const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);

      if (!match) {
        throw new Error('Invalid date format');
      }

      const [_, year, month, day, hours, minutes] = match;

      const dateStr = `${day}.${month}.${year}`;
      const timeStr = `${hours}:${minutes}`;

      return { date: dateStr, time: timeStr };
    } catch (error) {
      console.error('Error formatting date:', error);
      return { date: '00.00.0000', time: '00:00' };
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Функции управления шаблонами
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      setError('Введите название шаблона');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setSavingSettings(true);
      
      const maxOrder = templates.length > 0 
        ? Math.max(...templates.map(t => t.display_order || 0)) 
        : 0;

      const newTemplate = await landingTemplatesService.createTemplate({
        name: newTemplateName.trim(),
        display_order: maxOrder + 1
      });

      setTemplates([...templates, newTemplate]);
      setNewTemplateName('');
      setSuccess('Шаблон создан успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка создания шаблона:', error);
      setError('Ошибка создания шаблона: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateTemplate = async (templateId, updates) => {
    try {
      setSavingSettings(true);
      
      const updatedTemplate = await landingTemplatesService.updateTemplate(templateId, updates);
      
      setTemplates(templates.map(t => 
        t.id === templateId ? updatedTemplate : t
      ));
      
      setEditingTemplate(null);
      setSuccess('Шаблон обновлен успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка обновления шаблона:', error);
      setError('Ошибка обновления шаблона: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить шаблон "${templateName}"?`)) {
      return;
    }

    try {
      setSavingSettings(true);
      
      await landingTemplatesService.deleteTemplate(templateId);
      
      setTemplates(templates.filter(t => t.id !== templateId));
      setSuccess('Шаблон удален успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error);
      setError('Ошибка удаления шаблона: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReorderTemplates = async (newOrder) => {
    try {
      setSavingSettings(true);
      
      const updates = newOrder.map((template, index) => 
        landingTemplatesService.updateTemplate(template.id, { display_order: index })
      );
      
      await Promise.all(updates);
      
      setTemplates(newOrder);
      setSuccess('Порядок шаблонов обновлен');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка изменения порядка шаблонов:', error);
      setError('Ошибка изменения порядка: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  // Функции управления тегами
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      setError('Введите название тега');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setSavingSettings(true);
      
      const maxOrder = tags.length > 0 
        ? Math.max(...tags.map(t => t.display_order || 0)) 
        : 0;

      const newTag = await landingTagsService.createTag({
        name: newTagName.trim(),
        color: newTagColor,
        display_order: maxOrder + 1
      });

      setTags([...tags, newTag]);
      setNewTagName('');
      setNewTagColor('blue');
      setSuccess('Тег создан успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка создания тега:', error);
      setError('Ошибка создания тега: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateTag = async (tagId, updates) => {
    try {
      setSavingSettings(true);
      
      const updatedTag = await landingTagsService.updateTag(tagId, updates);
      
      setTags(tags.map(t => 
        t.id === tagId ? updatedTag : t
      ));
      
      setEditingTag(null);
      setSuccess('Тег обновлен успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка обновления тега:', error);
      setError('Ошибка обновления тега: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteTag = async (tagId, tagName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить тег "${tagName}"?`)) {
      return;
    }

    try {
      setSavingSettings(true);
      
      await landingTagsService.deleteTag(tagId);
      
      setTags(tags.filter(t => t.id !== tagId));
      setSuccess('Тег удален успешно');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка удаления тега:', error);
      setError('Ошибка удаления тега: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReorderTags = async (newOrder) => {
    try {
      setSavingSettings(true);
      
      const updates = newOrder.map((tag, index) => 
        landingTagsService.updateTag(tag.id, { display_order: index })
      );
      
      await Promise.all(updates);
      
      setTags(newOrder);
      setSuccess('Порядок тегов обновлен');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка изменения порядка тегов:', error);
      setError('Ошибка изменения порядка: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

// Функции для работы с источниками байеров
  const handleEditBuyerSources = (buyerId) => {
    const sources = buyerSources.get(buyerId) || [];
    setTempSourceIds(sources.length > 0 ? [...sources] : ['']);
    setEditingBuyerId(buyerId);
  };

  const handleAddSourceField = () => {
    setTempSourceIds([...tempSourceIds, '']);
  };

  const handleRemoveSourceField = (index) => {
    const newSources = tempSourceIds.filter((_, i) => i !== index);
    setTempSourceIds(newSources.length > 0 ? newSources : ['']);
  };

  const handleSourceChange = (index, value) => {
    const newSources = [...tempSourceIds];
    newSources[index] = value;
    setTempSourceIds(newSources);
  };

  const handleSaveBuyerSources = async (buyerId) => {
    try {
      setSavingSettings(true);
      
      const buyer = buyers.find(b => b.id === buyerId);
      if (!buyer) {
        throw new Error('Байер не найден');
      }

      // Фильтруем пустые значения
      const filteredSources = tempSourceIds.filter(id => id && id.trim());

      await buyerSourceService.saveBuyerSources(buyerId, buyer.name, filteredSources);

      // Обновляем локальное состояние
      setBuyerSources(prev => {
        const newMap = new Map(prev);
        newMap.set(buyerId, filteredSources);
        return newMap;
      });

      setEditingBuyerId(null);
      setTempSourceIds([]);
      setSuccess('Источники байера сохранены');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Ошибка сохранения источников:', error);
      setError('Ошибка сохранения: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCancelEditSources = () => {
    setEditingBuyerId(null);
    setTempSourceIds([]);
  };

  // Drag & Drop обработчики
  const handleDragStart = (e, item, type) => {
    setDraggedItem({ item, type });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetItem, type) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.type !== type) return;

    const items = type === 'template' ? [...templates] : [...tags];
    const draggedIndex = items.findIndex(item => item.id === draggedItem.item.id);
    const targetIndex = items.findIndex(item => item.id === targetItem.id);

    if (draggedIndex === targetIndex) return;

    const [removed] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, removed);

    if (type === 'template') {
      handleReorderTemplates(items);
    } else {
      handleReorderTags(items);
    }

    setDraggedItem(null);
  };

  const getTagColorClasses = (color) => {
    const colorMap = {
      'purple': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', dot: 'bg-purple-500' },
      'blue': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
      'green': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', dot: 'bg-green-500' },
      'yellow': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-500' },
      'red': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-500' },
      'indigo': { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', dot: 'bg-indigo-500' },
      'pink': { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', dot: 'bg-pink-500' },
      'orange': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
      'gray': { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', dot: 'bg-gray-500' }
    };
    return colorMap[color] || colorMap['blue'];
  };

  // Функция для обновления статуса интеграции после успешной проверки
  const handleIntegrationVerified = (landingId, urls) => {
    console.log('✅ Интеграция подтверждена для лендинга:', landingId, 'URLs:', urls);

    // Обновляем Map с информацией об интеграции
    setLandingsWithIntegration(prev => {
      const newMap = new Map(prev);
      newMap.set(landingId, true);
      return newMap;
    });

    // Обновляем список лендингов с новыми verified_urls
    setLandings(prevLandings =>
      prevLandings.map(landing =>
        landing.id === landingId
          ? { ...landing, verified_urls: urls }
          : landing
      )
    );
  };

  const getBuyerName = (buyerId) => {
    if (!buyerId) return '—';
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer ? buyer.name : 'Удален';
  };

  const getSearcherName = (searcherId) => {
    if (!searcherId) return '—';
    const searcher = searchers.find(s => s.id === searcherId);
    return searcher ? searcher.name : 'Удален';
  };

  const getDesignerName = (designerId) => {
    if (!designerId) return '—';
    const designer = designers.find(d => d.id === designerId);
    return designer ? designer.name : 'Удален';
  };

  const getBuyerAvatar = (buyerId) => {
    if (!buyerId) return null;
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer ? buyer.avatar_url : null;
  };

  const getSearcherAvatar = (searcherId) => {
    if (!searcherId) return null;
    const searcher = searchers.find(s => s.id === searcherId);
    return searcher ? searcher.avatar_url : null;
  };

  const getDesignerAvatar = (designerId) => {
    if (!designerId) return null;
    const designer = designers.find(d => d.id === designerId);
    return designer ? designer.avatar_url : null;
  };

  const getProductManagerName = (pmId) => {
    if (!pmId) return '—';
    const pm = productManagers.find(p => p.id === pmId);
    return pm ? pm.name : 'Удален';
  };

  const getProductManagerAvatar = (pmId) => {
    if (!pmId) return null;
    const pm = productManagers.find(p => p.id === pmId);
    return pm ? pm.avatar_url : null;
  };

  const getGiferName = (giferId) => {
    if (!giferId) return '—';
    const gifer = gifers.find(g => g.id === giferId);
    return gifer ? gifer.name : 'Удален';
  };

  const getGiferAvatar = (giferId) => {
    if (!giferId) return null;
    const gifer = gifers.find(g => g.id === giferId);
    return gifer ? gifer.avatar_url : null;
  };

  const getContentManagerName = (contentManagerId) => {
    if (!contentManagerId) return '—';
    const cm = contentManagers.find(c => c.id === contentManagerId);
    return cm ? cm.name : 'Удален';
  };

  // Получение источника для конкретного байера
  const getBuyerSource = (landingId, buyerId) => {
    if (!landingId || !buyerId || !landingMetrics || landingMetrics.size === 0) {
      return null;
    }

    const possibleSources = ['google', 'facebook', 'tiktok'];

    for (const source of possibleSources) {
      const key = `${landingId}_${source}`;
      if (landingMetrics.has(key)) {
        const metrics = landingMetrics.get(key);
        if (metrics && metrics.found && metrics.data && metrics.data.raw) {
          // Проверяем, есть ли этот байер в метриках источника
          if (metrics.data.raw.buyer_id === buyerId) {
            return source;
          }
        }
      }
    }

    return null;
  };

  const getContentManagerAvatar = (contentManagerId) => {
    if (!contentManagerId) return null;
    const cm = contentManagers.find(c => c.id === contentManagerId);
    return cm ? cm.avatar_url : null;
  };

  const handleDeleteLanding = async (landing) => {
    if (!window.confirm(`Вы уверены, что хотите удалить лендинг "${landing.article}"?\n\nЭто действие нельзя отменить!`)) {
      return;
    }

    try {
      setDeletingLandingId(landing.id);
      setError('');
      setSuccess('');

      console.log('🗑️ Удаление лендинга:', landing.id);

      await landingService.deleteLanding(landing.id);

      // Удаляем из локального состояния
      setLandings(prevLandings => prevLandings.filter(l => l.id !== landing.id));

      setSuccess(`Лендинг "${landing.article}" успешно удален`);
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('❌ Ошибка удаления лендинга:', error);
      setError(`Ошибка удаления: ${error.message}`);
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeletingLandingId(null);
    }
  };

  const handleRefreshAll = async () => {
    console.log(`🔄 ЗАПУСК ОБНОВЛЕНИЯ метрик лендингов (период: ${metricsPeriod})`);
    console.log(`📋 Лендингов для загрузки: ${filteredLandings.length}`);
    console.log(`📋 UUID лендингов:`, filteredLandings.map(l => l.id));

    setError('');
    setSuccess('');

    try {
      // КРИТИЧНО: Сначала очищаем кэш для всех лендингов
      console.log('🗑️ Очистка кэша метрик лендингов...');
      
      const landingIds = filteredLandings.map(l => l.id);
      
      if (landingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('landing_metrics_cache')
          .delete()
          .in('landing_id', landingIds);
        
        if (deleteError) {
          console.error('❌ Ошибка очистки кэша:', deleteError);
        } else {
          console.log('✅ Кэш очищен для', landingIds.length, 'лендингов');
        }
      }

      // Небольшая пауза после очистки
      await new Promise(resolve => setTimeout(resolve, 300));

      console.log('🚀 Вызов refreshLandingMetrics...');
      await refreshLandingMetrics();
      console.log('✅ Метрики лендингов обновлены');

      // Небольшая задержка для обновления состояния
      await new Promise(resolve => setTimeout(resolve, 500));

      setSuccess('Метрики успешно обновлены!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('❌ Ошибка обновления метрик лендингов:', error);
      setError('Ошибка обновления метрик: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }

    try {
      await refreshZoneData();
      console.log('✅ Зональные данные обновлены');
    } catch (error) {
      console.error('❌ Ошибка обновления зональных данных:', error);
    }

    await loadLastUpdateTime();
  };

  const tagsStats = getTagsStats(filteredLandings);
  const countryStats = getCountryStats(filteredLandings);
  const zoneStats = getZoneStats(filteredLandings);

  // Подсчет общих метрик из лендингов
  const calculateTotalMetrics = () => {
    let totalLeads = 0;
    let totalCost = 0;
    let totalClicks = 0;
    let landingsWithMetrics = 0;

    filteredLandings.forEach(landing => {
      const metrics = getAggregatedLandingMetrics(landing);
      if (metrics?.found && metrics.data) {
        totalLeads += metrics.data.raw.leads || 0;
        totalCost += metrics.data.raw.cost || 0;
        totalClicks += metrics.data.raw.clicks || 0;
        landingsWithMetrics++;
      }
    });

    return {
      totalLeads,
      totalCost,
      totalClicks,
      landingsWithMetrics,
      avgLeads: landingsWithMetrics > 0 ? totalLeads / landingsWithMetrics : 0,
      avgCost: landingsWithMetrics > 0 ? totalCost / landingsWithMetrics : 0,
      avgClicks: landingsWithMetrics > 0 ? totalClicks / landingsWithMetrics : 0,
      cpl: totalLeads > 0 ? totalCost / totalLeads : 0,
      cr: totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0
    };
  };

  const totalMetrics = calculateTotalMetrics();

  // Получаем уникальные значения для фильтров
  const uniqueFilterValues = useMemo(() => {
    // Базовая фильтрация (применяем те же фильтры, что и для подсчетов)
    let baseLandings = landings;

    // Применяем фильтр байеров
    if (selectedBuyer !== 'all') {
      baseLandings = baseLandings.filter(l => l.buyer_id === selectedBuyer);
    }

    // Применяем фильтр серчеров
    if (selectedSearcher !== 'all') {
      baseLandings = baseLandings.filter(l => l.searcher_id === selectedSearcher);
    }

    // Применяем поиск по SKU/UUID
    if (searchValue.trim()) {
      if (searchMode === 'sku') {
        const searchTerm = searchValue.trim().toLowerCase();
        baseLandings = baseLandings.filter(l =>
          l.article && l.article.toLowerCase().includes(searchTerm)
        );
      } else if (searchMode === 'uuid') {
        const searchTerm = searchValue.trim().toLowerCase();
        const landingWithUuid = landings.find(l =>
          l.id && l.id.toLowerCase() === searchTerm
        );
        if (landingWithUuid && landingWithUuid.article) {
          const targetArticle = landingWithUuid.article.toLowerCase();
          baseLandings = baseLandings.filter(l =>
            l.article && l.article.toLowerCase() === targetArticle
          );
        } else {
          baseLandings = [];
        }
      }
    }

    // Собираем уникальные версии
    const versionsSet = new Set();
    baseLandings.forEach(l => {
      if (l.website && l.website.trim()) {
        versionsSet.add(l.website.trim());
      }
    });
    const versions = Array.from(versionsSet).sort();

    // Собираем уникальные шаблоны
    const templatesSet = new Set();
    baseLandings.forEach(l => {
      if (l.template && l.template.trim()) {
        templatesSet.add(l.template.trim());
      }
    });
    const templates = Array.from(templatesSet).sort();

    // Собираем уникальные теги
    const tagsSet = new Set();
    baseLandings.forEach(l => {
      if (l.tags && Array.isArray(l.tags)) {
        l.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagsSet.add(tag.trim());
          }
        });
      }
    });
    const tags = Array.from(tagsSet).sort();

    // Собираем уникальные статусы
    const statusesSet = new Set();
    baseLandings.forEach(l => {
      const status = trelloStatuses.get(l.id);
      if (status && status.list_name) {
        statusesSet.add(status.list_name);
      }
    });
    const statuses = Array.from(statusesSet).sort();

    return { versions, templates, tags, statuses };
  }, [landings, selectedBuyer, selectedSearcher, searchMode, searchValue, trelloStatuses]);

  // Подсчет количества элементов для каждой опции фильтра
  const filterCounts = useMemo(() => {
    // Базовая фильтрация (без учета фильтров типа, верификации и комментариев)
    let baseLandings = landings;

    // Применяем фильтр байеров
    if (selectedBuyer !== 'all') {
      baseLandings = baseLandings.filter(l => l.buyer_id === selectedBuyer);
    }

    // Применяем фильтр серчеров
    if (selectedSearcher !== 'all') {
      baseLandings = baseLandings.filter(l => l.searcher_id === selectedSearcher);
    }

    // Применяем поиск по SKU/UUID
    if (searchValue.trim()) {
      if (searchMode === 'sku') {
        const searchTerm = searchValue.trim().toLowerCase();
        baseLandings = baseLandings.filter(l =>
          l.article && l.article.toLowerCase().includes(searchTerm)
        );
      } else if (searchMode === 'uuid') {
        const searchTerm = searchValue.trim().toLowerCase();
        const landingWithUuid = landings.find(l =>
          l.id && l.id.toLowerCase() === searchTerm
        );
        if (landingWithUuid && landingWithUuid.article) {
          const targetArticle = landingWithUuid.article.toLowerCase();
          baseLandings = baseLandings.filter(l =>
            l.article && l.article.toLowerCase() === targetArticle
          );
        } else {
          baseLandings = [];
        }
      }
    }

    // Подсчет для фильтра типов
    const mainCount = baseLandings.filter(l => !l.is_test && !l.is_edited).length;
    const testCount = baseLandings.filter(l => l.is_test).length;
    const editedCount = baseLandings.filter(l => l.is_edited).length;

    // Подсчет для фильтра верификации
    const withVerifCount = baseLandings.filter(l =>
      (l.verified_urls && l.verified_urls.length > 0) || landingsWithIntegration.get(l.id)
    ).length;
    const withoutVerifCount = baseLandings.filter(l =>
      !((l.verified_urls && l.verified_urls.length > 0) || landingsWithIntegration.get(l.id))
    ).length;

    // Подсчет для фильтра комментариев
    const withCommentCount = baseLandings.filter(l => l.comment && l.comment.trim()).length;
    const withoutCommentCount = baseLandings.filter(l => !(l.comment && l.comment.trim())).length;

    // Подсчет для фильтра истории
    const withHistoryCount = baseLandings.filter(l => landingsWithHistory.has(l.id)).length;
    const withoutHistoryCount = baseLandings.filter(l => !landingsWithHistory.has(l.id)).length;

    // Подсчет для фильтра стран
    const ukraineCount = baseLandings.filter(l => !l.is_poland).length;
    const polandCount = baseLandings.filter(l => l.is_poland).length;

    // Подсчет для фильтра версий
    const versionCounts = {};
    uniqueFilterValues.versions.forEach(version => {
      versionCounts[version] = baseLandings.filter(l =>
        l.website && l.website.trim() === version
      ).length;
    });

    // Подсчет для фильтра шаблонов (включая все шаблоны из базы данных)
    const templateCounts = {};
    templates.forEach(template => {
      templateCounts[template.name] = baseLandings.filter(l =>
        l.template && l.template.trim() === template.name
      ).length;
    });

    // Подсчет для фильтра тегов (включая все теги из базы данных)
    const tagCounts = {};
    tags.forEach(tag => {
      tagCounts[tag.name] = baseLandings.filter(l =>
        l.tags && Array.isArray(l.tags) && l.tags.some(t => t.trim() === tag.name)
      ).length;
    });
    // Подсчет лендингов без тегов
    tagCounts['empty'] = baseLandings.filter(l => !l.tags || !Array.isArray(l.tags) || l.tags.length === 0).length;

    // Подсчет для фильтра статусов
    const statusCounts = {};
    uniqueFilterValues.statuses.forEach(status => {
      statusCounts[status] = baseLandings.filter(l => {
        const landingStatus = trelloStatuses.get(l.id);
        return landingStatus && landingStatus.list_name === status;
      }).length;
    });
    // Подсчет лендингов без статуса
    statusCounts['empty'] = baseLandings.filter(l => !trelloStatuses.get(l.id)).length;

    // Подсчет для фильтра дизайнеров
    const designerCounts = {};
    designers.forEach(designer => {
      designerCounts[designer.id] = baseLandings.filter(l => l.designer_id === designer.id).length;
    });
    // Подсчет лендингов без дизайнера
    designerCounts['empty'] = baseLandings.filter(l => !l.designer_id).length;

    // Подсчет для фильтра байеров (таблица)
    const buyerTableCounts = {};
    buyers.forEach(buyer => {
      buyerTableCounts[buyer.id] = baseLandings.filter(l => l.buyer_id === buyer.id).length;
    });
    // Подсчет лендингов без байера
    buyerTableCounts['empty'] = baseLandings.filter(l => !l.buyer_id).length;

    // Подсчет для фильтра серчеров (таблица)
    const searcherTableCounts = {};
    searchers.forEach(searcher => {
      searcherTableCounts[searcher.id] = baseLandings.filter(l => l.searcher_id === searcher.id).length;
    });
    // Подсчет лендингов без серчера
    searcherTableCounts['empty'] = baseLandings.filter(l => !l.searcher_id).length;

    // Подсчет для фильтра продакт-менеджеров
    const productManagerCounts = {};
    productManagers.forEach(pm => {
      productManagerCounts[pm.id] = baseLandings.filter(l => l.product_manager_id === pm.id).length;
    });
    // Подсчет лендингов без продакт-менеджера
    productManagerCounts['empty'] = baseLandings.filter(l => !l.product_manager_id).length;

    // Подсчет для фильтра гиферов
    const giferCounts = {};
    gifers.forEach(gifer => {
      giferCounts[gifer.id] = baseLandings.filter(l => l.gifer_id === gifer.id).length;
    });
    // Подсчет лендингов без гифера
    giferCounts['empty'] = baseLandings.filter(l => !l.gifer_id).length;

    // Подсчет для фильтра контент-менеджеров
    const contentManagerCounts = {};
    contentManagers.forEach(cm => {
      contentManagerCounts[cm.id] = baseLandings.filter(l => l.content_manager_id === cm.id).length;
    });
    // Подсчет лендингов без контент-менеджера
    contentManagerCounts['empty'] = baseLandings.filter(l => !l.content_manager_id).length;

    // Для подсчета зон и источников нужно применить все активные фильтры (кроме самих зон и источников)
    let landingsForZoneAndSourceCount = baseLandings;

    // Применяем фильтр типов (Основные, Тестовые, Отредактированные)
    if (typeFilters.length > 0 && typeFilters.length < 3) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        const isMain = !l.is_test && !l.is_edited;
        const isTest = l.is_test;
        const isEdited = l.is_edited;

        if (typeFilters.includes('main') && isMain) return true;
        if (typeFilters.includes('test') && isTest) return true;
        if (typeFilters.includes('edited') && isEdited) return true;
        return false;
      });
    }

    // Применяем фильтр верификации
    if (verificationFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        const hasVerification = (l.verified_urls && l.verified_urls.length > 0) || landingsWithIntegration.get(l.id);
        if (verificationFilter === 'with') {
          return hasVerification;
        } else if (verificationFilter === 'without') {
          return !hasVerification;
        }
        return true;
      });
    }

    // Применяем фильтр комментариев
    if (commentFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        const hasComment = l.comment && l.comment.trim();
        if (commentFilter === 'with') {
          return hasComment;
        } else if (commentFilter === 'without') {
          return !hasComment;
        }
        return true;
      });
    }

    // Применяем фильтр истории
    if (historyFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        const hasHistory = landingsWithHistory.has(l.id);
        if (historyFilter === 'with') {
          return hasHistory;
        } else if (historyFilter === 'without') {
          return !hasHistory;
        }
        return true;
      });
    }

    // Применяем фильтр страны
    if (countryFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        if (countryFilter === 'ukraine') {
          return !l.is_poland;
        } else if (countryFilter === 'poland') {
          return l.is_poland;
        }
        return true;
      });
    }

    // Применяем фильтр версии
    if (versionFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l =>
        l.website && l.website.trim() === versionFilter
      );
    }

    // Применяем фильтр шаблона
    if (templateFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l =>
        l.template && l.template.trim() === templateFilter
      );
    }

    // Применяем фильтр тегов
    if (tagsFilter.length > 0) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        if (!l.tags || !Array.isArray(l.tags)) return false;
        return tagsFilter.some(selectedTag =>
          l.tags.some(tag => tag.trim() === selectedTag)
        );
      });
    }

    // Применяем фильтр статуса
    if (statusFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => {
        const landingStatus = trelloStatuses.get(l.id);
        return landingStatus && landingStatus.list_name === statusFilter;
      });
    }

    // Применяем фильтр дизайнера
    if (designerFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.designer_id === designerFilter);
    }

    // Применяем фильтр байера (таблица)
    if (buyerFilterTable !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.buyer_id === buyerFilterTable);
    }

    // Применяем фильтр серчера (таблица)
    if (searcherFilterTable !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.searcher_id === searcherFilterTable);
    }

    // Применяем фильтр продакт-менеджера
    if (productManagerFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.product_manager_id === productManagerFilter);
    }

    // Применяем фильтр гифера
    if (giferFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.gifer_id === giferFilter);
    }

    // Применяем фильтр контент-менеджера
    if (contentManagerFilter !== null) {
      landingsForZoneAndSourceCount = landingsForZoneAndSourceCount.filter(l => l.content_manager_id === contentManagerFilter);
    }

    // ДИАГНОСТИКА: Проверяем состояние данных перед подсчетом
    console.log('🔍 ДИАГНОСТИКА ФИЛЬТРОВ:', {
      landingsForCount: landingsForZoneAndSourceCount.length,
      landingMetricsSize: landingMetrics?.size || 0,
      zoneDataMapSize: zoneDataMap?.size || 0
    });

    // Подсчет для фильтра зон (используем hasZoneData из хука useZoneData)
    const withZonesCount = landingsForZoneAndSourceCount.filter(l => hasZoneData(l.article)).length;
    const withoutZonesCount = landingsForZoneAndSourceCount.filter(l => !hasZoneData(l.article)).length;

    console.log('📊 Подсчет зон:', { withZones: withZonesCount, withoutZones: withoutZonesCount });

    // Подсчет для фильтра источников (используем getLandingSources)
    const facebookCount = landingsForZoneAndSourceCount.filter(l => {
      const sources = getLandingSources(l.id);
      return sources.includes('facebook');
    }).length;
    const tiktokCount = landingsForZoneAndSourceCount.filter(l => {
      const sources = getLandingSources(l.id);
      return sources.includes('tiktok');
    }).length;
    const googleCount = landingsForZoneAndSourceCount.filter(l => {
      const sources = getLandingSources(l.id);
      return sources.includes('google');
    }).length;
    const noSourceCount = landingsForZoneAndSourceCount.filter(l => {
      const sources = getLandingSources(l.id);
      return sources.length === 0;
    }).length;

    console.log('📊 Подсчет источников:', { facebook: facebookCount, tiktok: tiktokCount, google: googleCount, noSource: noSourceCount });

    return {
      type: {
        all: baseLandings.length,
        main: mainCount,
        test: testCount,
        edited: editedCount
      },
      verification: {
        all: baseLandings.length,
        with: withVerifCount,
        without: withoutVerifCount
      },
      comment: {
        all: baseLandings.length,
        with: withCommentCount,
        without: withoutCommentCount
      },
      history: {
        all: baseLandings.length,
        with: withHistoryCount,
        without: withoutHistoryCount
      },
      country: {
        all: baseLandings.length,
        ukraine: ukraineCount,
        poland: polandCount
      },
      version: {
        all: baseLandings.length,
        ...versionCounts
      },
      template: {
        all: baseLandings.length,
        ...templateCounts
      },
      tag: {
        all: baseLandings.length,
        ...tagCounts
      },
      status: {
        all: baseLandings.length,
        ...statusCounts
      },
      designer: {
        all: baseLandings.length,
        ...designerCounts
      },
      buyerTable: {
        all: baseLandings.length,
        ...buyerTableCounts
      },
      searcherTable: {
        all: baseLandings.length,
        ...searcherTableCounts
      },
      productManager: {
        all: baseLandings.length,
        ...productManagerCounts
      },
      gifer: {
        all: baseLandings.length,
        ...giferCounts
      },
      contentManager: {
        all: baseLandings.length,
        ...contentManagerCounts
      },
      zone: {
        all: baseLandings.length,
        with: withZonesCount,
        without: withoutZonesCount
      },
      source: {
        all: baseLandings.length,
        facebook: facebookCount,
        tiktok: tiktokCount,
        google: googleCount,
        empty: noSourceCount
      }
    };
  }, [landings, selectedBuyer, selectedSearcher, searchMode, searchValue, landingsWithIntegration, landingsWithHistory, uniqueFilterValues, trelloStatuses, designers, buyers, searchers, productManagers, gifers, contentManagers, templates, tags, typeFilters, verificationFilter, commentFilter, historyFilter, countryFilter, versionFilter, templateFilter, tagsFilter, statusFilter, designerFilter, buyerFilterTable, searcherFilterTable, productManagerFilter, giferFilter, contentManagerFilter, hasZoneData, getLandingSources, landingMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка лендингов...</p>
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
              <h1 className="text-2xl font-semibold text-gray-900">Лендинги</h1>
              <p className="text-sm text-gray-600 mt-1">
                {user?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative metrics-period-menu-container">
              <button
                onClick={() => {
                  setShowPeriodDropdown(!showPeriodDropdown);
                  // При открытии меню инициализируем временные даты текущими значениями
                  if (!showPeriodDropdown) {
                    setMetricsTempCustomDateFrom(metricsCustomDateFrom);
                    setMetricsTempCustomDateTo(metricsCustomDateTo);
                    setMetricsSelectingDate(null);
                  }
                }}
                className="metrics-period-trigger inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Метрики: {getPeriodButtonText()}
                <ChevronDown className="ml-2 h-4 w-4" />
              </button>

              {/* Выпадающее меню с календарем для метрик */}
              {showPeriodDropdown && (
                <div className="metrics-period-dropdown absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50" style={{ width: '850px' }}>
                  <div className="grid grid-cols-3">
                    {/* Левая колонка - список периодов */}
                    <div className="border-r border-gray-200 py-2">
                      <button
                        onClick={() => handlePeriodChange('today')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'today' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Сегодня
                      </button>

                      <button
                        onClick={() => handlePeriodChange('yesterday')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'yesterday' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Вчера
                      </button>

                      <button
                        onClick={() => handlePeriodChange('this_week')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'this_week' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Эта неделя
                      </button>

                      <button
                        onClick={() => handlePeriodChange('last_7_days')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'last_7_days' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последние 7 дней
                      </button>

                      <button
                        onClick={() => handlePeriodChange('this_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'this_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Этот месяц
                      </button>

                      <button
                        onClick={() => handlePeriodChange('last_month')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'last_month' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Последний месяц
                      </button>

                      <div className="border-t border-gray-200 my-1"></div>

                      <button
                        onClick={() => handlePeriodChange('all')}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${metricsDisplayPeriod === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <Calendar className="h-4 w-4 mr-3" />
                        Все время
                      </button>
                    </div>

                    {/* Правая колонка - календарь (2 месяца) */}
                    <div className="col-span-2 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Первый календарь */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <button
                              onClick={() => {
                                const prev = new Date(metricsCalendarMonth1);
                                prev.setMonth(prev.getMonth() - 1);
                                setMetricsCalendarMonth1(prev);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="text-sm font-medium">
                              {metricsCalendarMonth1.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                            </div>
                            {(() => {
                              const nextMonth = new Date(metricsCalendarMonth1);
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              const hasGap = (metricsCalendarMonth2.getFullYear() - nextMonth.getFullYear()) * 12 +
                                (metricsCalendarMonth2.getMonth() - nextMonth.getMonth()) >= 1;

                              return hasGap ? (
                                <button
                                  onClick={() => {
                                    const next = new Date(metricsCalendarMonth1);
                                    next.setMonth(next.getMonth() + 1);
                                    setMetricsCalendarMonth1(next);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              ) : (
                                <div className="w-6"></div>
                              );
                            })()}
                          </div>

                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                {day}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(metricsCalendarMonth1);
                              const days = [];

                              const adjustedStartDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

                              for (let i = 0; i < adjustedStartDay; i++) {
                                days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                              }

                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(year, month, day);
                                const isSelected = isMetricsDateSelected(date);
                                const isInRange = isMetricsDateInRange(date);
                                const isToday = date.toDateString() === new Date().toDateString();

                                days.push(
                                  <button
                                    key={day}
                                    onClick={() => handleMetricsDateClick(date)}
                                    className={`aspect-square flex items-center justify-center text-sm rounded transition-colors
                                      ${isSelected ? 'bg-blue-500 text-white font-medium' : ''}
                                      ${isInRange && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                                      ${!isSelected && !isInRange ? 'hover:bg-gray-100 text-gray-700' : ''}
                                      ${isToday && !isSelected ? 'border border-blue-500' : ''}
                                    `}
                                  >
                                    {day}
                                  </button>
                                );
                              }

                              return days;
                            })()}
                          </div>
                        </div>

                        {/* Второй календарь */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            {(() => {
                              const prevMonth = new Date(metricsCalendarMonth2);
                              prevMonth.setMonth(prevMonth.getMonth() - 1);
                              const hasGap = (prevMonth.getFullYear() - metricsCalendarMonth1.getFullYear()) * 12 +
                                (prevMonth.getMonth() - metricsCalendarMonth1.getMonth()) >= 1;

                              return hasGap ? (
                                <button
                                  onClick={() => {
                                    const prev = new Date(metricsCalendarMonth2);
                                    prev.setMonth(prev.getMonth() - 1);
                                    setMetricsCalendarMonth2(prev);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                              ) : (
                                <div className="w-6"></div>
                              );
                            })()}
                            <div className="text-sm font-medium">
                              {metricsCalendarMonth2.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                            </div>
                            <button
                              onClick={() => {
                                const next = new Date(metricsCalendarMonth2);
                                next.setMonth(next.getMonth() + 1);
                                setMetricsCalendarMonth2(next);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                                {day}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(metricsCalendarMonth2);
                              const days = [];

                              const adjustedStartDay = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

                              for (let i = 0; i < adjustedStartDay; i++) {
                                days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                              }

                              for (let day = 1; day <= daysInMonth; day++) {
                                const date = new Date(year, month, day);
                                const isSelected = isMetricsDateSelected(date);
                                const isInRange = isMetricsDateInRange(date);
                                const isToday = date.toDateString() === new Date().toDateString();

                                days.push(
                                  <button
                                    key={day}
                                    onClick={() => handleMetricsDateClick(date)}
                                    className={`aspect-square flex items-center justify-center text-sm rounded transition-colors
                                      ${isSelected ? 'bg-blue-500 text-white font-medium' : ''}
                                      ${isInRange && !isSelected ? 'bg-blue-100 text-blue-700' : ''}
                                      ${!isSelected && !isInRange ? 'hover:bg-gray-100 text-gray-700' : ''}
                                      ${isToday && !isSelected ? 'border border-blue-500' : ''}
                                    `}
                                  >
                                    {day}
                                  </button>
                                );
                              }

                              return days;
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Кнопка применить для custom периода */}
                      {(metricsTempCustomDateFrom || metricsTempCustomDateTo) && (
                        <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200">
                          <button
                            onClick={applyMetricsCustomPeriod}
                            disabled={!metricsTempCustomDateFrom || !metricsTempCustomDateTo}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            Применить
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleRefreshAll}
              disabled={loading || metricsLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(loading || metricsLoading) ? 'animate-spin' : ''}`} />
              Обновить метрики
            </button>

            <button
              onClick={() => {
                setShowSettingsModal(true);
                loadBuyerSources();
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
            >
              <Settings className="h-4 w-4 mr-2" />
              Настройки
            </button>

          </div>
        </div>
      </div>

      {/* Информационная панель с временем обновления */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {metricsLastUpdate && (
              <>
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  Обновлено: {new Date(metricsLastUpdate).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Фильтры:</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterBuyerDropdown(!showFilterBuyerDropdown)}
                className="filter-buyer-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {selectedBuyer === 'all' ? (
                    <User className="h-4 w-4 text-gray-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {getBuyerAvatar(selectedBuyer) ? (
                        <img
                          src={getBuyerAvatar(selectedBuyer)}
                          alt="Buyer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(selectedBuyer) ? 'hidden' : ''}`}>
                        <User className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span>{selectedBuyer === 'all' ? 'Все байеры' : getBuyerName(selectedBuyer)}</span>
                </div>
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showFilterBuyerDropdown && (
                <div className="filter-buyer-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedBuyer('all');
                        setShowFilterBuyerDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedBuyer === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <User className="h-5 w-5 mr-3 text-gray-500" />
                      Все байеры
                    </button>

                    {buyers.map(buyer => (
                      <button
                        key={buyer.id}
                        onClick={() => {
                          setSelectedBuyer(buyer.id);
                          setShowFilterBuyerDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedBuyer === buyer.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-3">
                          {buyer.avatar_url ? (
                            <img
                              src={buyer.avatar_url}
                              alt={buyer.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${buyer.avatar_url ? 'hidden' : ''}`}>
                            <User className="h-3 w-3 text-gray-400" />
                          </div>
                        </div>
                        <span className="truncate">{buyer.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterSearcherDropdown(!showFilterSearcherDropdown)}
                className="filter-searcher-trigger inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-2">
                  {selectedSearcher === 'all' ? (
                    <Search className="h-4 w-4 text-gray-500" />
                  ) : (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {getSearcherAvatar(selectedSearcher) ? (
                        <img
                          src={getSearcherAvatar(selectedSearcher)}
                          alt="Searcher"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(selectedSearcher) ? 'hidden' : ''}`}>
                        <Search className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}
                  <span>{selectedSearcher === 'all' ? 'Все серчеры' : getSearcherName(selectedSearcher)}</span>
                </div>
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showFilterSearcherDropdown && (
                <div className="filter-searcher-dropdown absolute left-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setSelectedSearcher('all');
                        setShowFilterSearcherDropdown(false);
                      }}
                      className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedSearcher === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                        }`}
                    >
                      <Search className="h-5 w-5 mr-3 text-gray-500" />
                      Все серчеры
                    </button>

                    {searchers.map(searcher => (
                      <button
                        key={searcher.id}
                        onClick={() => {
                          setSelectedSearcher(searcher.id);
                          setShowFilterSearcherDropdown(false);
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 transition-colors duration-200 ${selectedSearcher === searcher.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mr-3">
                          {searcher.avatar_url ? (
                            <img
                              src={searcher.avatar_url}
                              alt={searcher.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center ${searcher.avatar_url ? 'hidden' : ''}`}>
                            <Search className="h-3 w-3 text-gray-400" />
                          </div>
                        </div>
                        <span className="truncate">{searcher.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Поиск по SKU/UUID */}
            <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
              <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1">
                <button
                  onClick={() => setSearchMode('sku')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${
                    searchMode === 'sku'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  SKU
                </button>
                <button
                  onClick={() => setSearchMode('uuid')}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${
                    searchMode === 'uuid'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  UUID
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchMode === 'sku' ? 'Поиск по артикулу...' : 'Поиск по UUID...'}
                  className="w-64 pl-3 pr-10 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchValue && (
                  <button
                    onClick={() => setSearchValue('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>


        </div>

      </div>

      {/* КАРТОЧКИ СТАТИСТИКИ В ДВА РЯДА */}
      {filteredLandings.length > 0 && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
          {/* ПЕРВАЯ СТРОКА */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4 mb-4">
        {/* Лендингов */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div className="ml-2 sm:ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-xs font-medium text-gray-500 truncate">
                    Лендингов
                  </dt>
                  <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                    {filteredLandings.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* С комментарием */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div className="ml-2 sm:ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-xs font-medium text-gray-500 truncate">
                    С комментарием
                  </dt>
                  <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                    {filteredLandings.filter(l => l.comment && l.comment.trim()).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* UA/PL */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Globe className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div className="ml-2 sm:ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-xs font-medium text-gray-500 truncate">
                    UA/PL
                  </dt>
                  <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                    <div className="flex items-center space-x-1">
                      <span>{countryStats.ukraineCount}</span>
                      <span className="text-gray-400">/</span>
                      <span>{countryStats.polandCount}</span>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Типы лендингов */}
        <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
          <div className="p-2 sm:p-3 md:p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
              </div>
              <div className="ml-2 sm:ml-3 w-0 flex-1">
                <dl>
                  <dt className="text-xs font-medium text-gray-500 truncate">
                    Осн/Тест/Ред
                  </dt>
                  <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                    <div className="flex items-center space-x-1">
                      <span>{filteredLandings.filter(l => !l.is_test && !l.is_edited).length}</span>
                      <span className="text-gray-400">/</span>
                      <span>{filteredLandings.filter(l => l.is_test).length}</span>
                      <span className="text-gray-400">/</span>
                      <span>{filteredLandings.filter(l => l.is_edited).length}</span>
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

            {/* Красная зона */}
            <div className="bg-red-500 overflow-hidden shadow-sm rounded-lg border border-red-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-red-100 truncate">
                        Красная зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.red}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Розовая зона */}
            <div className="bg-pink-500 overflow-hidden shadow-sm rounded-lg border border-pink-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-pink-100 truncate">
                        Розовая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.pink}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Золотая зона */}
            <div className="bg-yellow-500 overflow-hidden shadow-sm rounded-lg border border-yellow-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-black" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-yellow-800 truncate">
                        Золотая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-black">
                        {zoneStats.gold}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Зеленая зона */}
            <div className="bg-green-500 overflow-hidden shadow-sm rounded-lg border border-green-600">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Star className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-green-100 truncate">
                        Зеленая зона
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-white">
                        {zoneStats.green}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ВТОРАЯ СТРОКА - метрики */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4">
            {/* Лидов */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Лидов
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.totalLeads)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* CPL */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CPL</span>
                    </div>
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        CPL
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.cpl.toFixed(2)}$
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Расходы */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Расходы
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.totalCost.toFixed(2)}$
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Клики */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MousePointer className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Клики
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.totalClicks)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* CR */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-[8px] sm:text-[9px] md:text-[10px]">CR</span>
                    </div>
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        CR
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.cr.toFixed(2)}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Ср. лидов */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. лидов
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.avgLeads)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Ср. расходы */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. расходы
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {totalMetrics.avgCost.toFixed(2)}$
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            {/* Ср. клики */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-2 sm:p-3 md:p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MousePointer className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-500" />
                  </div>
                  <div className="ml-2 sm:ml-3 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-medium text-gray-500 truncate">
                        Ср. клики
                      </dt>
                      <dd className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">
                        {Math.round(totalMetrics.avgClicks)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Content - таблица лендингов */}
      <div className="flex-1 p-6">
        {filteredLandings.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет лендингов
            </h3>
            <p className="text-gray-600 mb-4">
              Нет доступных лендингов для редактирования
            </p>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 text-center">
                Полная аналитика лендингов
              </h3>

              <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-1 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50" style={{ width: '40px' }}>
                        <div className="flex items-center justify-center gap-1">
                          <span>Тип</span>
                          <button
                            ref={typeFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showTypeFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowTypeFilterDropdown(true);
                              }
                              setTempTypeFilters(typeFilters);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              typeFilters.length < 3 ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по типу"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дата
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          <button
                            ref={verificationFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showVerificationFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowVerificationFilterDropdown(true);
                              }
                              setTempVerificationFilter(verificationFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              verificationFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по верификации"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <button
                            ref={commentFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showCommentFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowCommentFilterDropdown(true);
                              }
                              setTempCommentFilter(commentFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              commentFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по комментарию"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <History className="h-4 w-4" />
                          <button
                            ref={historyFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showHistoryFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowHistoryFilterDropdown(true);
                              }
                              setTempHistoryFilter(historyFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              historyFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по истории"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <Globe className="h-4 w-4" />
                          <button
                            ref={countryFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showCountryFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowCountryFilterDropdown(true);
                              }
                              setTempCountryFilter(countryFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              countryFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по стране"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Артикул
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Версия</span>
                          <button
                            ref={versionFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showVersionFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowVersionFilterDropdown(true);
                              }
                              setTempVersionFilter(versionFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              versionFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по версии"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Шаблон</span>
                          <button
                            ref={templateFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showTemplateFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowTemplateFilterDropdown(true);
                              }
                              setTempTemplateFilter(templateFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              templateFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по шаблону"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Теги</span>
                          <button
                            ref={tagsFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showTagsFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowTagsFilterDropdown(true);
                              }
                              setTempTagsFilter(tagsFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              tagsFilter.length > 0 ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по тегам"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Источник</span>
                          <button
                            ref={sourceFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showSourceFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowSourceFilterDropdown(true);
                              }
                              setTempSourceFilter(sourceFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              sourceFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по источнику"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Байеры
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Зона
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Лиды
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CPL
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Расходы
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Клики
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        CR
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Дней
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Зоны</span>
                          <button
                            ref={zoneFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showZoneFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowZoneFilterDropdown(true);
                              }
                              setTempZoneFilter(zoneFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              zoneFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по зонам"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Trello
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-center gap-1">
                          <span>Статус</span>
                          <button
                            ref={statusFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showStatusFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowStatusFilterDropdown(true);
                              }
                              setTempStatusFilter(statusFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              statusFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по статусу"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>Designer</span>
                          <button
                            ref={designerFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showDesignerFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowDesignerFilterDropdown(true);
                              }
                              setTempDesignerFilter(designerFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              designerFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по дизайнеру"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>Buyer</span>
                          <button
                            ref={buyerFilterTableButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showBuyerFilterTableDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowBuyerFilterTableDropdown(true);
                              }
                              setTempBuyerFilterTable(buyerFilterTable);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              buyerFilterTable !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по байеру"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>Searcher</span>
                          <button
                            ref={searcherFilterTableButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showSearcherFilterTableDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowSearcherFilterTableDropdown(true);
                              }
                              setTempSearcherFilterTable(searcherFilterTable);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              searcherFilterTable !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по серчеру"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>Product</span>
                          <button
                            ref={productManagerFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showProductManagerFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowProductManagerFilterDropdown(true);
                              }
                              setTempProductManagerFilter(productManagerFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              productManagerFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по продакт-менеджеру"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>GIFer</span>
                          <button
                            ref={giferFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showGiferFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowGiferFilterDropdown(true);
                              }
                              setTempGiferFilter(giferFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              giferFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по гиферу"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-1">
                          <span>Content</span>
                          <button
                            ref={contentManagerFilterButtonRef}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasOpen = showContentManagerFilterDropdown;
                              closeAllFilterDropdowns();
                              if (!wasOpen) {
                                setShowContentManagerFilterDropdown(true);
                              }
                              setTempContentManagerFilter(contentManagerFilter);
                            }}
                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                              contentManagerFilter !== null ? 'text-blue-600' : 'text-gray-400'
                            }`}
                            title="Фильтр по контент-менеджеру"
                          >
                            <Filter className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLandings.map((landing) => {
                      const formattedDateTime = formatKyivTime(landing.created_at);
                      const aggregatedMetrics = getAggregatedLandingMetrics(landing);
                      const isExpanded = expandedTags.has(landing.id);
                      const isDropdownOpen = openDropdowns.has(landing.id);
                      const isSyncing = syncingLandings.has(landing.id);
                      const trelloStatus = getTrelloListName(landing.id);
                      const buyerMetrics = getMetricsByBuyers(landing);
                      const isBuyersExpanded = expandedBuyers.has(landing.id);

                      return (
                        <React.Fragment key={landing.id}>
                          <tr
                            className="transition-colors duration-200 hover:bg-gray-50"
                          >
                          <td className="px-1 py-4 whitespace-nowrap text-sm text-center">
                            <div className="flex items-center justify-center space-x-1">
                              {landing.is_test && (
                                <div title="Тестовый лендинг">
                                  <TestBadge />
                                </div>
                              )}
                              {landing.is_edited && (
                                <div 
                                  title="Лендинг отредактирован" 
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-white shadow-md border border-purple-300 flex-shrink-0 hover:shadow-lg transition-shadow duration-200"
                                >
                                  <span className="tracking-wide">E</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="cursor-text select-text text-center">
                              <div className="font-medium">{formattedDateTime.date}</div>
                              <div className="text-xs text-gray-500">{formattedDateTime.time}</div>
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <div className="w-6 h-6 flex items-center justify-center mx-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  showUuidCode(landing.id);
                                }}
                                className={`p-1 rounded-full transition-all duration-200 ${(landing.verified_urls && landing.verified_urls.length > 0) || landingsWithIntegration.get(landing.id)
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-900 hover:scale-110'
                                    : 'bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 hover:scale-110'
                                  }`}
                                title={
                                  (landing.verified_urls && landing.verified_urls.length > 0) || landingsWithIntegration.get(landing.id)
                                    ? `Интеграция подтверждена ${landing.verified_urls ? `(${landing.verified_urls.length} URL)` : ''}`
                                    : 'Интеграция не найдена'
                                }
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                              </button>
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <div className="w-6 h-6 flex items-center justify-center mx-auto">
                              {landing.comment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showComment(landing);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                  title="Показать комментарий"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Колонка со статусом обновления (часики) */}
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center">
                              {landingsWithHistory.has(landing.id) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showHistory(landing);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100 transition-colors duration-200"
                                  title="Показать историю изменений"
                                >
                                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                    <path stroke="none" d="M0 0h24v24H0z" />
                                    <polyline points="12 8 12 12 14 14" />
                                    <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Колонка со страной (флаг) */}
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center">
                              {landing.is_poland ? <PolandFlag /> : <UkraineFlag />}
                            </div>
                          </td>

                          {/* Колонка с артикулом */}
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <div className="text-sm font-medium text-gray-900 cursor-text select-text">
                              {landing.article}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="text-center cursor-text select-text">
                              {landing.website || <span className="text-gray-400">—</span>}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="text-center cursor-text select-text">
                              {landing.template ? (
                                <span className="font-medium text-gray-900">{landing.template}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            {landing.tags && Array.isArray(landing.tags) && landing.tags.length > 0 ? (
                              <div className="space-y-1">
                                <div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTags(landing.id);
                                    }}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-200 transition-colors duration-200"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    <span>
                                      {isExpanded
                                        ? `Скрыть теги`
                                        : `Теги (${landing.tags.length})`
                                      }
                                    </span>
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3 ml-1" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 ml-1" />
                                    )}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="mt-2 space-y-1 max-w-xs">
                                    {landing.tags.map((tagName, index) => {
                                      // Находим полный объект тега из загруженных тегов
                                      const tagObj = tags && tags.length > 0 ? tags.find(t => t.name === tagName) : null;
                                      const colorMap = {
                                        'purple': { dot: 'bg-purple-500', border: 'border-purple-200', bg: 'bg-purple-50' },
                                        'blue': { dot: 'bg-blue-500', border: 'border-blue-200', bg: 'bg-blue-50' },
                                        'green': { dot: 'bg-green-500', border: 'border-green-200', bg: 'bg-green-50' },
                                        'yellow': { dot: 'bg-yellow-500', border: 'border-yellow-200', bg: 'bg-yellow-50' },
                                        'red': { dot: 'bg-red-500', border: 'border-red-200', bg: 'bg-red-50' },
                                        'indigo': { dot: 'bg-indigo-500', border: 'border-indigo-200', bg: 'bg-indigo-50' },
                                        'pink': { dot: 'bg-pink-500', border: 'border-pink-200', bg: 'bg-pink-50' },
                                        'orange': { dot: 'bg-orange-500', border: 'border-orange-200', bg: 'bg-orange-50' },
                                        'gray': { dot: 'bg-gray-500', border: 'border-gray-200', bg: 'bg-gray-50' }
                                      };
                                      const style = tagObj ? (colorMap[tagObj.color] || colorMap['blue']) : colorMap['blue'];
                                      return (
                                        <div key={index} className={`text-xs text-gray-700 ${style.bg} px-2 py-1 rounded flex items-center border ${style.border}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mr-1.5`}></span>
                                          <span className="truncate cursor-text select-text">{tagName}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "Источник" */}
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            <SourceBadges sources={getLandingSources(landing.id)} />
                          </td>

                          {/* Колонка "Байеры" */}
                          <td className="px-3 py-4 whitespace-nowrap text-center">
                            {buyerMetrics.length === 0 ? (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            ) : isBuyersExpanded ? (
                              // Раскрытый вид - сначала кнопка Свернуть, затем байеры
                              <div className="space-y-0 -mt-2 -mb-2">
                                {/* Кнопка "Свернуть" */}
                                <div className="h-10 flex items-center justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleBuyers(landing.id);
                                    }}
                                    className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-xs font-medium text-blue-600"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                    <span>Свернуть</span>
                                  </button>
                                </div>
                                {/* Разделительная линия */}
                                <div className="border-t border-gray-300"></div>
                                {/* Байеры по левому краю с разделителями */}
                                <div className="text-left pl-2">
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`grid gap-2 ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`} style={{ gridTemplateColumns: '24px max-content 24px', alignItems: 'center' }}>
                                        {/* Аватар */}
                                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                          {buyerMetric.buyer_avatar ? (
                                            <img
                                              src={buyerMetric.buyer_avatar}
                                              alt={buyerMetric.buyer_name}
                                              className="w-full h-full object-cover"
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                              }}
                                            />
                                          ) : null}
                                          <div className={`w-full h-full flex items-center justify-center ${buyerMetric.buyer_avatar ? 'hidden' : ''}`}>
                                            <User className="h-3 w-3 text-gray-400" />
                                          </div>
                                        </div>
                                        {/* Имя байера */}
                                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                                          {buyerMetric.buyer_name}
                                        </span>
                                        {/* Иконка источника */}
                                        <div className="flex items-center justify-center">
                                          {buyerMetric.buyer_source ? (
                                            <div className="rounded-full overflow-hidden bg-white border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0" style={{ width: '20px', height: '20px' }}>
                                              {buyerMetric.buyer_source === 'google' && <GoogleIcon className="w-full h-full" />}
                                              {buyerMetric.buyer_source === 'facebook' && <FacebookIcon className="w-full h-full" />}
                                              {buyerMetric.buyer_source === 'tiktok' && <TiktokIcon className="w-full h-full" />}
                                            </div>
                                          ) : (
                                            <div style={{ width: '20px', height: '20px' }}></div>
                                          )}
                                        </div>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              // Свернутый вид - кнопка с preview
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBuyers(landing.id);
                                }}
                                className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors duration-200 group"
                              >
                                {/* Аватарки байеров */}
                                <div className="flex -space-x-2">
                                  {buyerMetrics.slice(0, 3).map((buyerMetric, idx) => (
                                    <div
                                      key={idx}
                                      className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 border-2 border-white flex items-center justify-center flex-shrink-0"
                                      title={buyerMetric.buyer_name}
                                    >
                                      {buyerMetric.buyer_avatar ? (
                                        <img
                                          src={buyerMetric.buyer_avatar}
                                          alt={buyerMetric.buyer_name}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-full h-full flex items-center justify-center ${buyerMetric.buyer_avatar ? 'hidden' : ''}`}>
                                        <User className="h-3 w-3 text-gray-400" />
                                      </div>
                                    </div>
                                  ))}
                                  {buyerMetrics.length > 3 && (
                                    <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-700">
                                      +{buyerMetrics.length - 3}
                                    </div>
                                  )}
                                </div>
                                {/* Счетчик */}
                                <span className="text-xs font-medium text-gray-600">
                                  {buyerMetrics.length}
                                </span>
                                {/* Стрелка */}
                                {isBuyersExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            )}
                          </td>

                          {/* Колонка "Зона" */}
                          <td className="px-3 py-4 text-sm text-gray-900 text-center">
                            {isBuyersExpanded && buyerMetrics.length > 0 ? (
                              // Раскрытый вид - сначала общая зона, потом зоны байеров
                              <div className="space-y-0 -mt-2 -mb-2">
                                {/* Общая зона */}
                                <div className="h-10 flex items-center justify-center">
                                  <CurrentZoneDisplay article={landing.article} metricsData={aggregatedMetrics} />
                                </div>
                                {/* Разделительная линия */}
                                <div className="border-t border-gray-300"></div>
                                {/* Зоны байеров */}
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => {
                                    const buyerCpl = buyerMetric.data.raw.cpl;
                                    const buyerZone = getCurrentZoneByMetrics(landing.article, buyerCpl);

                                    return (
                                      <React.Fragment key={idx}>
                                        <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                          {buyerZone ? (
                                            (() => {
                                              const getZoneColors = (zone) => {
                                                switch (zone) {
                                                  case 'red':
                                                    return { bg: 'bg-red-500', text: 'text-white' };
                                                  case 'pink':
                                                    return { bg: 'bg-pink-500', text: 'text-white' };
                                                  case 'gold':
                                                    return { bg: 'bg-yellow-500', text: 'text-black' };
                                                  case 'green':
                                                    return { bg: 'bg-green-500', text: 'text-white' };
                                                  default:
                                                    return { bg: 'bg-gray-500', text: 'text-white' };
                                                }
                                              };

                                              const colors = getZoneColors(buyerZone.zone);

                                              return (
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                                                  {buyerZone.name}
                                                </span>
                                              );
                                            })()
                                          ) : (
                                            <span className="text-gray-400 text-xs">—</span>
                                          )}
                                        </div>
                                        {/* Разделитель между байерами */}
                                        {idx !== buyerMetrics.length - 1 && (
                                          <div className="border-t border-gray-300"></div>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              // Свернутый вид - агрегированная зона
                              <CurrentZoneDisplay article={landing.article} metricsData={aggregatedMetrics} />
                            )}
                          </td>

                          {/* Колонка "Лиды" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              // Раскрытый вид - сначала общие лиды, потом лиды байеров
                              <div className="space-y-0 -mt-2 -mb-2">
                                {/* Общие лиды */}
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">
                                      {aggregatedMetrics.data.formatted.leads}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </div>
                                {/* Разделительная линия */}
                                <div className="border-t border-gray-300"></div>
                                {/* Лиды байеров */}
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">
                                          {buyerMetric.data.formatted.leads}
                                        </span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.leads}
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "CPL" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              <div className="space-y-0 -mt-2 -mb-2">
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">{aggregatedMetrics.data.formatted.cpl}</span>
                                  ) : (<span className="text-gray-400">—</span>)}
                                </div>
                                <div className="border-t border-gray-300 my-1"></div>
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">{buyerMetric.data.formatted.cpl}</span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.cpl}
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "Расходы" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              <div className="space-y-0 -mt-2 -mb-2">
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">{aggregatedMetrics.data.formatted.cost}</span>
                                  ) : (<span className="text-gray-400">—</span>)}
                                </div>
                                <div className="border-t border-gray-300 my-1"></div>
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">{buyerMetric.data.formatted.cost}</span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.formatted.cost}
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  Расход (источник): {aggregatedMetrics.data.raw.cost_from_sources?.toFixed(2)}$
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "Клики" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              <div className="space-y-0 -mt-2 -mb-2">
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">{aggregatedMetrics.data.formatted.clicks}</span>
                                  ) : (<span className="text-gray-400">—</span>)}
                                </div>
                                <div className="border-t border-gray-300 my-1"></div>
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">{buyerMetric.data.formatted.clicks}</span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.formatted.clicks}
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  Клики (источник): {aggregatedMetrics.data.raw.clicks_on_link}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "CR" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              <div className="space-y-0 -mt-2 -mb-2">
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">
                                      {aggregatedMetrics.data.raw.clicks > 0 ? ((aggregatedMetrics.data.raw.leads / aggregatedMetrics.data.raw.clicks) * 100).toFixed(2) + '%' : '0.00%'}
                                    </span>
                                  ) : (<span className="text-gray-400">—</span>)}
                                </div>
                                <div className="border-t border-gray-300 my-1"></div>
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">{buyerMetric.data.formatted.cr}</span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span
                                className="font-bold text-sm cursor-text select-text text-black relative group"
                              >
                                {aggregatedMetrics.data.raw.clicks > 0
                                  ? ((aggregatedMetrics.data.raw.leads / aggregatedMetrics.data.raw.clicks) * 100).toFixed(2) + '%'
                                  : '0.00%'
                                }
                                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                  CR (источник): {aggregatedMetrics.data.raw.clicks_on_link > 0
                                    ? ((aggregatedMetrics.data.raw.leads / aggregatedMetrics.data.raw.clicks_on_link) * 100).toFixed(2) + '%'
                                    : '0.00%'
                                  }
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          {/* Колонка "Дней" */}
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {(metricsLoading || loadingCreativeIds.has(landing.id)) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              </div>
                            ) : isBuyersExpanded && buyerMetrics.length > 0 ? (
                              <div className="space-y-0 -mt-2 -mb-2">
                                <div className="h-10 flex items-center justify-center">
                                  {aggregatedMetrics?.found ? (
                                    <span className="font-bold text-sm text-black">{aggregatedMetrics.data.formatted.days}</span>
                                  ) : (<span className="text-gray-400">—</span>)}
                                </div>
                                <div className="border-t border-gray-300 my-1"></div>
                                <div>
                                  {buyerMetrics.map((buyerMetric, idx) => (
                                    <React.Fragment key={idx}>
                                      <div className={`flex items-center justify-center ${idx === buyerMetrics.length - 1 ? 'h-10 pt-1' : 'h-10'}`}>
                                        <span className="font-bold text-sm text-black">{buyerMetric.data.formatted.days}</span>
                                      </div>
                                      {/* Разделитель между байерами */}
                                      {idx !== buyerMetrics.length - 1 && (
                                        <div className="border-t border-gray-300"></div>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </div>
                            ) : aggregatedMetrics?.found ? (
                              <span className="font-bold text-sm cursor-text select-text text-black">
                                {aggregatedMetrics.data.formatted.days}
                              </span>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          <td className="px-3 py-4 text-sm text-gray-900 text-center">
                            <ZoneDataDisplay article={landing.article} />
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {landing.trello_link ? (
                              <div className="space-y-2">
                                <div>
                                  <a href={landing.trello_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1 border border-blue-300 text-xs font-medium rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Карточка
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                            {syncingLandings.has(landing.id) ? (
                              <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-xs text-blue-600">Синхронизация...</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-text select-text">
                                {getTrelloListName(landing.id)}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center justify-start space-x-2">
                              {landing.designer_id ? (
                                <>
                                  <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    {getDesignerAvatar(landing.designer_id) ? (
                                      <img
                                        src={getDesignerAvatar(landing.designer_id)}
                                        alt="Designer"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full flex items-center justify-center ${getDesignerAvatar(landing.designer_id) ? 'hidden' : ''}`}>
                                      <Palette className="h-3 w-3 text-gray-400" />
                                    </div>
                                  </div>
                                  <span className="text-sm text-gray-900">{getDesignerName(landing.designer_id)}</span>
                                </>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.buyer_id || landing.buyer) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getBuyerAvatar(landing.buyer_id) ? (
                                    <img
                                      src={getBuyerAvatar(landing.buyer_id)}
                                      alt="Buyer"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getBuyerAvatar(landing.buyer_id) ? 'hidden' : ''}`}>
                                    <User className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.buyer_id ? getBuyerName(landing.buyer_id) : landing.buyer}
                                </span>
                              </div>
                            ) : (
                              // Показываем "Склад" ТОЛЬКО если и buyer И content оба NULL (источник Warehouse)
                              !landing.content_manager_name ? (
                                <div className="flex justify-center">
                                  <WarehouseBadge />
                                </div>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.searcher_id || landing.searcher) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getSearcherAvatar(landing.searcher_id) ? (
                                    <img
                                      src={getSearcherAvatar(landing.searcher_id)}
                                      alt="Searcher"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getSearcherAvatar(landing.searcher_id) ? 'hidden' : ''}`}>
                                    <Search className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.searcher_id ? getSearcherName(landing.searcher_id) : landing.searcher}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.product_manager_id || landing.product_manager) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getProductManagerAvatar(landing.product_manager_id) ? (
                                    <img
                                      src={getProductManagerAvatar(landing.product_manager_id)}
                                      alt="Product"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getProductManagerAvatar(landing.product_manager_id) ? 'hidden' : ''}`}>
                                    <Target className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.product_manager_id ? getProductManagerName(landing.product_manager_id) : landing.product_manager}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(landing.gifer_id || landing.gifer) ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {getGiferAvatar(landing.gifer_id) ? (
                                    <img
                                      src={getGiferAvatar(landing.gifer_id)}
                                      alt="GIFer"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${getGiferAvatar(landing.gifer_id) ? 'hidden' : ''}`}>
                                    <Palette className="h-3 w-3 text-gray-400" />
                                  </div>
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.gifer_id ? getGiferName(landing.gifer_id) : landing.gifer}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-400 cursor-text select-text">—</span>
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {landing.content_manager_name ? (
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  <User className="h-3 w-3 text-gray-400" />
                                </div>
                                <span className="text-sm text-gray-900 cursor-text select-text">
                                  {landing.content_manager_name}
                                </span>
                              </div>
                            ) : (
                              // Показываем "Склад" ТОЛЬКО если и buyer И content оба NULL (источник Warehouse)
                              !landing.buyer_id && !landing.buyer ? (
                                <div className="flex justify-center">
                                  <WarehouseBadge />
                                </div>
                              ) : (
                                <span className="text-gray-400 cursor-text select-text">—</span>
                              )
                            )}
                          </td>

                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <button
                              onClick={() => handleDeleteLanding(landing)}
                              disabled={deletingLandingId === landing.id}
                              className="p-2 rounded-full transition-colors duration-200 text-red-600 hover:text-red-800 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Удалить лендинг"
                            >
                              {deletingLandingId === landing.id ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                              ) : (
                                <Trash2 className="h-5 w-5" />
                              )}
                            </button>
                          </td>

                        </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comment Modal */}
      {showCommentModal && selectedComment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-blue-600" />
                Комментарий
              </h3>
              <button
                onClick={() => setShowCommentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Артикул:</label>
                <p className="text-gray-900 font-medium">{selectedComment.article}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Автор:</label>
                <p className="text-gray-900">{selectedComment.editorName}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Дата создания:</label>
                <p className="text-gray-600 text-sm">
                  {formatKyivTime(selectedComment.createdAt).date} {formatKyivTime(selectedComment.createdAt).time}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Комментарий:</label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedComment.comment}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UUID Modal - Показ кода интеграции */}
      {showUuidModal && selectedLandingUuid && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div
            className="relative top-20 mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-lg bg-white my-5"
            style={{ maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Код интеграции лендинга</h3>
              </div>
              <button
                onClick={() => {
                  setShowUuidModal(false);
                  setSelectedLandingUuid(null);
                  setCopiedUuid(false);
                  setVerifiedUrls([]);
                  setLoadingUrls(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2 font-medium">
                  <AlertCircle className="h-4 w-4 inline mr-2" />
                  Используйте этот код для интеграции:
                </p>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 relative">
                <pre className="text-sm text-green-400 font-mono overflow-x-auto">
                  {`<div 
id="rt-meta" 
data-rt-sub16="${selectedLandingUuid}"
></div>`}
                </pre>

                <button
                  onClick={handleCopyUuid}
                  className={`absolute top-3 right-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${copiedUuid ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  title="Копировать код"
                >
                  {copiedUuid ? (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Скопировано!</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Копировать</span>
                    </div>
                  )}
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>UUID лендинга:</strong>
                </p>
                <p className="text-sm font-mono text-gray-900 bg-white px-3 py-2 rounded border border-gray-300">
                  {selectedLandingUuid}
                </p>
              </div>

              {/* Список верифицированных URL */}
              {verifiedUrls && verifiedUrls.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                    <h4 className="text-sm font-medium text-green-900">Верифицированные интеграции ({verifiedUrls.length})</h4>
                  </div>

                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {verifiedUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-green-100">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-green-600 hover:text-green-800 truncate flex items-center flex-1"
                        >
                          <ExternalLink className="h-3 w-3 mr-2 flex-shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingUrls && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <span className="ml-2 text-sm text-gray-600">Загрузка верифицированных ссылок...</span>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Вставьте этот код в HTML вашего лендинга для правильной работы трекинга
                </p>
              </div>

              {/* Разделитель */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                  Проверка интеграции
                </h4>

                {/* Компонент проверки интеграции */}
                <IntegrationChecker
                  landingUuid={selectedLandingUuid}
                  onIntegrationVerified={(urls) => handleIntegrationVerified(selectedLandingUuid, urls)}
                />
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowUuidModal(false);
                  setSelectedLandingUuid(null);
                  setCopiedUuid(false);
                  setVerifiedUrls([]);
                  setLoadingUrls(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-medium"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}


      {/* History Modal - ПОЛНАЯ РЕАЛИЗАЦИЯ */}
      {showHistoryModal && selectedHistory && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white my-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <svg className="h-5 w-5 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" />
                  <polyline points="12 8 12 12 14 14" />
                  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                </svg>
                История изменений: {selectedHistory.article}
              </h3>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistory(null);
                  setHistoryData([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Загрузка истории...</p>
                </div>
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-12">
                <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" />
                  <polyline points="12 8 12 12 14 14" />
                  <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
                </svg>
                <p className="text-gray-600">История изменений пуста</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {historyData.map((entry, index) => {
                  const formattedDateTime = formatKyivTime(entry.changed_at);
                  const isFirst = index === historyData.length - 1;

                  return (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${entry.change_type === 'created'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                            }`}>
                            {entry.change_type === 'created' ? 'Создано' : 'Изменено'}
                          </span>
                          {isFirst && (
                            <span className="text-xs text-gray-500">(Исходная версия)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div className="font-medium">{formattedDateTime.date} {formattedDateTime.time}</div>
                          <div className="text-xs">Автор: {entry.changed_by_name || 'Неизвестно'}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Версия сайта */}
                        {entry.website && (
                          <div>
                            <label className="text-xs font-medium text-gray-700">Версия:</label>
                            <div className="mt-1">
                              <span className="text-sm text-gray-900">{entry.website}</span>
                            </div>
                          </div>
                        )}

                        {/* Тип лендинга */}
                        {entry.is_edited && (
                          <div>
                            <label className="text-xs font-medium text-gray-700">Тип:</label>
                            <div className="mt-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Отредактированный
                              </span>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-gray-700">Шаблон:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.template || '—'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Страна:</label>
                          <div className="mt-1 flex items-center space-x-2">
                            {entry.is_poland ? <PolandFlag /> : <UkraineFlag />}
                            <span className="text-sm text-gray-900">{entry.is_poland ? 'Poland' : 'Ukraine'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Designer:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.designer || '—'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Buyer:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.buyer || '—'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Searcher:</label>
                          <div className="mt-1">
                            <span className="text-sm text-gray-900">{entry.searcher || '—'}</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-gray-700">Trello:</label>
                          <div className="mt-1">
                            {entry.trello_link ? (
                              <a
                                href={entry.trello_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800 truncate block"
                              >
                                Открыть карточку
                              </a>
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </div>
                        </div>

                        {/* Контент менеджер (источник) */}
                        {entry.content_manager_name && (
                          <div>
                            <label className="text-xs font-medium text-gray-700">Content Manager (источник):</label>
                            <div className="mt-1">
                              <span className="text-sm text-gray-900">{entry.content_manager_name}</span>
                            </div>
                          </div>
                        )}

                        {/* Verified URLs */}
                        {entry.verified_urls && entry.verified_urls.length > 0 && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-700">Верифицированные интеграции ({entry.verified_urls.length}):</label>
                            <div className="mt-1 space-y-1">
                              {entry.verified_urls.map((url, idx) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 block truncate"
                                >
                                  {url}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-gray-700">Теги:</label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {entry.tags && entry.tags.length > 0 ? (
                              entry.tags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                  {tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </div>
                        </div>

                        {entry.comment && (
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-gray-700">Комментарий:</label>
                            <div className="mt-1 p-2 bg-white border border-gray-200 rounded">
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">{entry.comment}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedHistory(null);
                  setHistoryData([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-5 mx-auto p-6 border w-full max-w-3xl shadow-lg rounded-lg bg-white my-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Settings className="h-6 w-6 text-gray-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900">Настройки</h3>
              </div>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingTemplate(null);
                  setEditingTag(null);
                  setNewTemplateName('');
                  setNewTagName('');
                  setNewTagColor('blue');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200">
              <button
                onClick={() => setSettingsTab('templates')}
                className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
                  settingsTab === 'templates'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Шаблоны ({templates.length})
              </button>
              <button
                onClick={() => setSettingsTab('tags')}
                className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
                  settingsTab === 'tags'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Теги ({tags.length})
              </button>
              <button
                onClick={() => {
                  setSettingsTab('sources');
                  loadBuyerSources();
                }}
                className={`pb-3 px-4 text-sm font-medium transition-colors border-b-2 ${
                  settingsTab === 'sources'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Источники байеров ({buyers.length})
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[600px] overflow-y-auto">
              {/* Templates Tab */}
              {settingsTab === 'templates' && (
                <div className="space-y-4">
                  {/* Create New Template */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Создать новый шаблон</h4>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTemplate();
                          }
                        }}
                        placeholder="Название шаблона..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleCreateTemplate}
                        disabled={savingSettings || !newTemplateName.trim()}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {savingSettings ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Создать
                      </button>
                    </div>
                  </div>

                  {/* Templates List */}
                  <div className="space-y-2">
                    {templates.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Palette className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p>Нет созданных шаблонов</p>
                        <p className="text-sm">Создайте первый шаблон выше</p>
                      </div>
                    ) : (
                      templates.map((template) => (
                        <div
                          key={template.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, template, 'template')}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, template, 'template')}
                          className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-move"
                        >
                          <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          
                          {editingTemplate?.id === template.id ? (
                            <>
                              <input
                                type="text"
                                value={editingTemplate.name}
                                onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateTemplate(template.id, { name: editingTemplate.name });
                                  }
                                }}
                                className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateTemplate(template.id, { name: editingTemplate.name })}
                                disabled={savingSettings}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingTemplate(null)}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-medium text-gray-900">{template.name}</span>
                              <button
                                onClick={() => setEditingTemplate(template)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(template.id, template.name)}
                                disabled={savingSettings}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Tags Tab */}
              {settingsTab === 'tags' && (
                <div className="space-y-4">
                  {/* Create New Tag */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Создать новый тег</h4>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateTag();
                          }
                        }}
                        placeholder="Название тега..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-[42px]"
                      />
                      <div className="flex items-center space-x-2 px-3 border border-gray-300 rounded-md bg-white h-[42px] min-w-[160px]">
                        <span className={`w-4 h-4 rounded-full flex-shrink-0 ${getTagColorClasses(newTagColor).dot}`}></span>
                        <select
                          value={newTagColor}
                          onChange={(e) => setNewTagColor(e.target.value)}
                          className="border-none focus:outline-none focus:ring-0 bg-transparent cursor-pointer text-sm flex-1"
                          style={{ 
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none'
                          }}
                        >
                          <option value="purple">Фиолетовый</option>
                          <option value="blue">Синий</option>
                          <option value="green">Зеленый</option>
                          <option value="yellow">Желтый</option>
                          <option value="red">Красный</option>
                          <option value="indigo">Индиго</option>
                          <option value="pink">Розовый</option>
                          <option value="orange">Оранжевый</option>
                          <option value="gray">Серый</option>
                        </select>
                      </div>
                      <button
                        onClick={handleCreateTag}
                        disabled={savingSettings || !newTagName.trim()}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-[42px]"
                      >
                        {savingSettings ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Создать
                      </button>
                    </div>
                  </div>

                  {/* Tags List */}
                  <div className="space-y-2">
                    {tags.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Star className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                        <p>Нет созданных тегов</p>
                        <p className="text-sm">Создайте первый тег выше</p>
                      </div>
                    ) : (
                      tags.map((tag) => {
                        const colorClasses = getTagColorClasses(tag.color);
                        return (
                          <div
                            key={tag.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, tag, 'tag')}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, tag, 'tag')}
                            className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-move"
                          >
                            <GripVertical className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            
                            <span className={`w-3 h-3 rounded-full ${colorClasses.dot} flex-shrink-0`}></span>
                            
                            {editingTag?.id === tag.id ? (
                              <>
                                <input
                                  type="text"
                                  value={editingTag.name}
                                  onChange={(e) => setEditingTag({...editingTag, name: e.target.value})}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateTag(tag.id, { name: editingTag.name, color: editingTag.color });
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-[38px]"
                                  autoFocus
                                />
                                <div className="flex items-center space-x-2 px-3 border border-gray-300 rounded-md bg-white h-[38px] min-w-[140px]">
                                  <span className={`w-3 h-3 rounded-full flex-shrink-0 ${getTagColorClasses(editingTag.color).dot}`}></span>
                                  <select
                                    value={editingTag.color}
                                    onChange={(e) => setEditingTag({...editingTag, color: e.target.value})}
                                    className="border-none focus:outline-none focus:ring-0 bg-transparent cursor-pointer text-sm flex-1"
                                    style={{ 
                                      appearance: 'none',
                                      WebkitAppearance: 'none',
                                      MozAppearance: 'none'
                                    }}
                                  >
                                    <option value="purple">Фиолетовый</option>
                                    <option value="blue">Синий</option>
                                    <option value="green">Зеленый</option>
                                    <option value="yellow">Желтый</option>
                                    <option value="red">Красный</option>
                                    <option value="indigo">Индиго</option>
                                    <option value="pink">Розовый</option>
                                    <option value="orange">Оранжевый</option>
                                    <option value="gray">Серый</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => handleUpdateTag(tag.id, { name: editingTag.name, color: editingTag.color })}
                                  disabled={savingSettings}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50 h-[38px] w-[38px] flex items-center justify-center"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingTag(null)}
                                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-md transition-colors h-[38px] w-[38px] flex items-center justify-center"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <div className={`flex-1 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${colorClasses.bg} ${colorClasses.text} ${colorClasses.border}`}>
                                  {tag.name}
                                </div>
                                <button
                                  onClick={() => setEditingTag(tag)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                                  disabled={savingSettings}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

              {/* Sources Tab */}
              {settingsTab === 'sources' && (
                <div className="space-y-4">
                  {loadingBuyerSources ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Загрузка источников байеров...</p>
                      </div>
                    </div>
                  ) : buyers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p>Нет байеров в системе</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {buyers.map((buyer) => {
                        const isEditing = editingBuyerId === buyer.id;
                        const sources = buyerSources.get(buyer.id) || [];

                        return (
                          <div
                            key={buyer.id}
                            className="bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                          >
                            {/* Buyer Header */}
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer"
                              onClick={() => !isEditing && handleEditBuyerSources(buyer.id)}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                                  {buyer.avatar_url ? (
                                    <img
                                      src={buyer.avatar_url}
                                      alt={buyer.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-full h-full flex items-center justify-center ${buyer.avatar_url ? 'hidden' : ''}`}>
                                    <User className="h-5 w-5 text-gray-400" />
                                  </div>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{buyer.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {sources.length > 0 ? `${sources.length} источник(ов)` : 'Источники не настроены'}
                                  </div>
                                </div>
                              </div>

                              {!isEditing && (
                                <div className="flex items-center space-x-2">
                                  {sources.length > 0 && (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {sources.slice(0, 3).map((sourceId, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                        >
                                          {sourceId}
                                        </span>
                                      ))}
                                      {sources.length > 3 && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                          +{sources.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <ChevronDown className="h-5 w-5 text-gray-400" />
                                </div>
                              )}
                            </div>

                            {/* Editing Sources */}
                            {isEditing && (
                              <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700">ID источников:</label>
                                    <button
                                      onClick={handleAddSourceField}
                                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      Добавить поле
                                    </button>
                                  </div>

                                  {tempSourceIds.map((sourceId, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                      <input
                                        type="text"
                                        value={sourceId}
                                        onChange={(e) => handleSourceChange(index, e.target.value)}
                                        placeholder="Введите ID источника..."
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                      />
                                      {tempSourceIds.length > 1 && (
                                        <button
                                          onClick={() => handleRemoveSourceField(index)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      )}
                                    </div>
                                  ))}

                                  <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-200">
                                    <button
                                      onClick={handleCancelEditSources}
                                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                    >
                                      Отмена
                                    </button>
                                    <button
                                      onClick={() => handleSaveBuyerSources(buyer.id)}
                                      disabled={savingSettings}
                                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {savingSettings ? (
                                        <>
                                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                          Сохранение...
                                        </>
                                      ) : (
                                        <>
                                          <Save className="h-4 w-4 mr-2" />
                                          Сохранить
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            {/* Footer */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Перетаскивайте элементы для изменения порядка отображения
              </p>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setEditingTemplate(null);
                  setEditingTag(null);
                  setNewTemplateName('');
                  setNewTagName('');
                  setNewTagColor('blue');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors font-medium"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Дропдауны фильтров (рендерятся через портал) */}
      <FilterDropdown
        isOpen={showTypeFilterDropdown}
        referenceElement={typeFilterButtonRef.current}
        title="Фильтровать по типу"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.type.all },
          { value: 'main', label: 'Основные', count: filterCounts.type.main, disabled: filterCounts.type.main === 0 },
          { value: 'test', label: 'Тестовые', count: filterCounts.type.test, disabled: filterCounts.type.test === 0 },
          { value: 'edited', label: 'Отредактированные', count: filterCounts.type.edited, disabled: filterCounts.type.edited === 0 }
        ]}
        selectedValues={tempTypeFilters}
        onApply={(values) => {
          setTempTypeFilters(values);
        }}
        onCancel={() => {
          setShowTypeFilterDropdown(false);
          setTempTypeFilters(typeFilters);
        }}
        onOk={() => {
          setTypeFilters(tempTypeFilters);
          setShowTypeFilterDropdown(false);
        }}
        onReset={() => {
          setTypeFilters(['main', 'test', 'edited']);
          setTempTypeFilters(['main', 'test', 'edited']);
          setShowTypeFilterDropdown(false);
        }}
        multiSelect={true}
      />

      <FilterDropdown
        isOpen={showVerificationFilterDropdown}
        referenceElement={verificationFilterButtonRef.current}
        title="Фильтровать по верифу"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.verification.all },
          { value: 'with', label: 'С верифом', count: filterCounts.verification.with, disabled: filterCounts.verification.with === 0 },
          { value: 'without', label: 'Без верифа', count: filterCounts.verification.without, disabled: filterCounts.verification.without === 0 }
        ]}
        selectedValues={tempVerificationFilter}
        onApply={(value) => {
          setTempVerificationFilter(value);
        }}
        onCancel={() => {
          setShowVerificationFilterDropdown(false);
          setTempVerificationFilter(verificationFilter);
        }}
        onOk={() => {
          setVerificationFilter(tempVerificationFilter);
          setShowVerificationFilterDropdown(false);
        }}
        onReset={() => {
          setVerificationFilter(null);
          setTempVerificationFilter(null);
          setShowVerificationFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showCommentFilterDropdown}
        referenceElement={commentFilterButtonRef.current}
        title="Фильтровать по комментам"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.comment.all },
          { value: 'with', label: 'С комментарием', count: filterCounts.comment.with, disabled: filterCounts.comment.with === 0 },
          { value: 'without', label: 'Без комментария', count: filterCounts.comment.without, disabled: filterCounts.comment.without === 0 }
        ]}
        selectedValues={tempCommentFilter}
        onApply={(value) => {
          setTempCommentFilter(value);
        }}
        onCancel={() => {
          setShowCommentFilterDropdown(false);
          setTempCommentFilter(commentFilter);
        }}
        onOk={() => {
          setCommentFilter(tempCommentFilter);
          setShowCommentFilterDropdown(false);
        }}
        onReset={() => {
          setCommentFilter(null);
          setTempCommentFilter(null);
          setShowCommentFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showHistoryFilterDropdown}
        referenceElement={historyFilterButtonRef.current}
        title="Фильтровать по истории"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.history.all },
          { value: 'with', label: 'С историей', count: filterCounts.history.with, disabled: filterCounts.history.with === 0 },
          { value: 'without', label: 'Без истории', count: filterCounts.history.without, disabled: filterCounts.history.without === 0 }
        ]}
        selectedValues={tempHistoryFilter}
        onApply={(value) => {
          setTempHistoryFilter(value);
        }}
        onCancel={() => {
          setShowHistoryFilterDropdown(false);
          setTempHistoryFilter(historyFilter);
        }}
        onOk={() => {
          setHistoryFilter(tempHistoryFilter);
          setShowHistoryFilterDropdown(false);
        }}
        onReset={() => {
          setHistoryFilter(null);
          setTempHistoryFilter(null);
          setShowHistoryFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showCountryFilterDropdown}
        referenceElement={countryFilterButtonRef.current}
        title="Фильтровать по стране"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.country.all },
          { value: 'ukraine', label: 'Украина', icon: '🇺🇦', count: filterCounts.country.ukraine, disabled: filterCounts.country.ukraine === 0 },
          { value: 'poland', label: 'Польша', icon: '🇵🇱', count: filterCounts.country.poland, disabled: filterCounts.country.poland === 0 }
        ]}
        selectedValues={tempCountryFilter}
        onApply={(value) => {
          setTempCountryFilter(value);
        }}
        onCancel={() => {
          setShowCountryFilterDropdown(false);
          setTempCountryFilter(countryFilter);
        }}
        onOk={() => {
          setCountryFilter(tempCountryFilter);
          setShowCountryFilterDropdown(false);
        }}
        onReset={() => {
          setCountryFilter(null);
          setTempCountryFilter(null);
          setShowCountryFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showVersionFilterDropdown}
        referenceElement={versionFilterButtonRef.current}
        title="Фильтровать по версии"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.version.all },
          ...uniqueFilterValues.versions.map(version => ({
            value: version,
            label: version,
            count: filterCounts.version[version] || 0
          }))
        ]}
        selectedValues={tempVersionFilter}
        onApply={(value) => {
          setTempVersionFilter(value);
        }}
        onCancel={() => {
          setShowVersionFilterDropdown(false);
          setTempVersionFilter(versionFilter);
        }}
        onOk={() => {
          setVersionFilter(tempVersionFilter);
          setShowVersionFilterDropdown(false);
        }}
        onReset={() => {
          setVersionFilter(null);
          setTempVersionFilter(null);
          setShowVersionFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showTemplateFilterDropdown}
        referenceElement={templateFilterButtonRef.current}
        title="Фильтровать по шаблону"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.template.all },
          ...templates.map(template => ({
            value: template.name,
            label: template.name,
            count: filterCounts.template[template.name] || 0,
            disabled: (filterCounts.template[template.name] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempTemplateFilter}
        onApply={(value) => {
          setTempTemplateFilter(value);
        }}
        onCancel={() => {
          setShowTemplateFilterDropdown(false);
          setTempTemplateFilter(templateFilter);
        }}
        onOk={() => {
          setTemplateFilter(tempTemplateFilter);
          setShowTemplateFilterDropdown(false);
        }}
        onReset={() => {
          setTemplateFilter(null);
          setTempTemplateFilter(null);
          setShowTemplateFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showTagsFilterDropdown}
        referenceElement={tagsFilterButtonRef.current}
        title="Фильтровать по тегам"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.tag.all },
          { value: 'empty', label: '—', count: filterCounts.tag.empty || 0, disabled: (filterCounts.tag.empty || 0) === 0 },
          ...tags.map(tag => ({
            value: tag.name,
            label: tag.name,
            count: filterCounts.tag[tag.name] || 0,
            disabled: (filterCounts.tag[tag.name] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempTagsFilter}
        onApply={(values) => {
          setTempTagsFilter(values);
        }}
        onCancel={() => {
          setShowTagsFilterDropdown(false);
          setTempTagsFilter(tagsFilter);
        }}
        onOk={() => {
          setTagsFilter(tempTagsFilter);
          setShowTagsFilterDropdown(false);
        }}
        onReset={() => {
          setTagsFilter([]);
          setTempTagsFilter([]);
          setShowTagsFilterDropdown(false);
        }}
        multiSelect={true}
      />

      <FilterDropdown
        isOpen={showStatusFilterDropdown}
        referenceElement={statusFilterButtonRef.current}
        title="Фильтровать по статусу"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.status.all },
          { value: 'empty', label: '—', count: filterCounts.status.empty || 0, disabled: (filterCounts.status.empty || 0) === 0 },
          ...uniqueFilterValues.statuses.map(status => ({
            value: status,
            label: status,
            count: filterCounts.status[status] || 0
          }))
        ]}
        selectedValues={tempStatusFilter}
        onApply={(value) => {
          setTempStatusFilter(value);
        }}
        onCancel={() => {
          setShowStatusFilterDropdown(false);
          setTempStatusFilter(statusFilter);
        }}
        onOk={() => {
          setStatusFilter(tempStatusFilter);
          setShowStatusFilterDropdown(false);
        }}
        onReset={() => {
          setStatusFilter(null);
          setTempStatusFilter(null);
          setShowStatusFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showDesignerFilterDropdown}
        referenceElement={designerFilterButtonRef.current}
        title="Фильтровать по дизайнеру"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.designer.all },
          { value: 'empty', label: '—', count: filterCounts.designer.empty || 0, disabled: (filterCounts.designer.empty || 0) === 0 },
          ...designers.map(designer => ({
            value: designer.id,
            label: getDesignerName(designer.id),
            count: filterCounts.designer[designer.id] || 0,
            avatar: getDesignerAvatar(designer.id),
            disabled: (filterCounts.designer[designer.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempDesignerFilter}
        onApply={(value) => {
          setTempDesignerFilter(value);
        }}
        onCancel={() => {
          setShowDesignerFilterDropdown(false);
          setTempDesignerFilter(designerFilter);
        }}
        onOk={() => {
          setDesignerFilter(tempDesignerFilter);
          setShowDesignerFilterDropdown(false);
        }}
        onReset={() => {
          setDesignerFilter(null);
          setTempDesignerFilter(null);
          setShowDesignerFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showBuyerFilterTableDropdown}
        referenceElement={buyerFilterTableButtonRef.current}
        title="Фильтровать по байеру"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.buyerTable.all },
          { value: 'empty', label: '—', count: filterCounts.buyerTable.empty || 0, disabled: (filterCounts.buyerTable.empty || 0) === 0 },
          ...buyers.map(buyer => ({
            value: buyer.id,
            label: getBuyerName(buyer.id),
            count: filterCounts.buyerTable[buyer.id] || 0,
            avatar: getBuyerAvatar(buyer.id),
            disabled: (filterCounts.buyerTable[buyer.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempBuyerFilterTable}
        onApply={(value) => {
          setTempBuyerFilterTable(value);
        }}
        onCancel={() => {
          setShowBuyerFilterTableDropdown(false);
          setTempBuyerFilterTable(buyerFilterTable);
        }}
        onOk={() => {
          setBuyerFilterTable(tempBuyerFilterTable);
          setShowBuyerFilterTableDropdown(false);
        }}
        onReset={() => {
          setBuyerFilterTable(null);
          setTempBuyerFilterTable(null);
          setShowBuyerFilterTableDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showSearcherFilterTableDropdown}
        referenceElement={searcherFilterTableButtonRef.current}
        title="Фильтровать по серчеру"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.searcherTable.all },
          { value: 'empty', label: '—', count: filterCounts.searcherTable.empty || 0, disabled: (filterCounts.searcherTable.empty || 0) === 0 },
          ...searchers.map(searcher => ({
            value: searcher.id,
            label: getSearcherName(searcher.id),
            count: filterCounts.searcherTable[searcher.id] || 0,
            avatar: getSearcherAvatar(searcher.id),
            disabled: (filterCounts.searcherTable[searcher.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempSearcherFilterTable}
        onApply={(value) => {
          setTempSearcherFilterTable(value);
        }}
        onCancel={() => {
          setShowSearcherFilterTableDropdown(false);
          setTempSearcherFilterTable(searcherFilterTable);
        }}
        onOk={() => {
          setSearcherFilterTable(tempSearcherFilterTable);
          setShowSearcherFilterTableDropdown(false);
        }}
        onReset={() => {
          setSearcherFilterTable(null);
          setTempSearcherFilterTable(null);
          setShowSearcherFilterTableDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showProductManagerFilterDropdown}
        referenceElement={productManagerFilterButtonRef.current}
        title="Фильтровать по продакт-менеджеру"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.productManager.all },
          { value: 'empty', label: '—', count: filterCounts.productManager.empty || 0, disabled: (filterCounts.productManager.empty || 0) === 0 },
          ...productManagers.map(pm => ({
            value: pm.id,
            label: getProductManagerName(pm.id),
            count: filterCounts.productManager[pm.id] || 0,
            avatar: getProductManagerAvatar(pm.id),
            disabled: (filterCounts.productManager[pm.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempProductManagerFilter}
        onApply={(value) => {
          setTempProductManagerFilter(value);
        }}
        onCancel={() => {
          setShowProductManagerFilterDropdown(false);
          setTempProductManagerFilter(productManagerFilter);
        }}
        onOk={() => {
          setProductManagerFilter(tempProductManagerFilter);
          setShowProductManagerFilterDropdown(false);
        }}
        onReset={() => {
          setProductManagerFilter(null);
          setTempProductManagerFilter(null);
          setShowProductManagerFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showGiferFilterDropdown}
        referenceElement={giferFilterButtonRef.current}
        title="Фильтровать по гиферу"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.gifer.all },
          { value: 'empty', label: '—', count: filterCounts.gifer.empty || 0, disabled: (filterCounts.gifer.empty || 0) === 0 },
          ...gifers.map(gifer => ({
            value: gifer.id,
            label: getGiferName(gifer.id),
            count: filterCounts.gifer[gifer.id] || 0,
            avatar: getGiferAvatar(gifer.id),
            disabled: (filterCounts.gifer[gifer.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempGiferFilter}
        onApply={(value) => {
          setTempGiferFilter(value);
        }}
        onCancel={() => {
          setShowGiferFilterDropdown(false);
          setTempGiferFilter(giferFilter);
        }}
        onOk={() => {
          setGiferFilter(tempGiferFilter);
          setShowGiferFilterDropdown(false);
        }}
        onReset={() => {
          setGiferFilter(null);
          setTempGiferFilter(null);
          setShowGiferFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showContentManagerFilterDropdown}
        referenceElement={contentManagerFilterButtonRef.current}
        title="Фильтровать по контент-менеджеру"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.contentManager.all },
          { value: 'empty', label: '—', count: filterCounts.contentManager.empty || 0, disabled: (filterCounts.contentManager.empty || 0) === 0 },
          ...contentManagers.map(cm => ({
            value: cm.id,
            label: getContentManagerName(cm.id),
            count: filterCounts.contentManager[cm.id] || 0,
            avatar: getContentManagerAvatar(cm.id),
            disabled: (filterCounts.contentManager[cm.id] || 0) === 0
          })).sort((a, b) => {
            // Сначала сортируем по наличию count (с count > 0 идут вверх)
            if (a.count === 0 && b.count > 0) return 1;
            if (a.count > 0 && b.count === 0) return -1;
            // Затем сортируем по убыванию count
            return b.count - a.count;
          })
        ]}
        selectedValues={tempContentManagerFilter}
        onApply={(value) => {
          setTempContentManagerFilter(value);
        }}
        onCancel={() => {
          setShowContentManagerFilterDropdown(false);
          setTempContentManagerFilter(contentManagerFilter);
        }}
        onOk={() => {
          setContentManagerFilter(tempContentManagerFilter);
          setShowContentManagerFilterDropdown(false);
        }}
        onReset={() => {
          setContentManagerFilter(null);
          setTempContentManagerFilter(null);
          setShowContentManagerFilterDropdown(false);
        }}
        multiSelect={false}
        alignRight={true}
      />

      <FilterDropdown
        isOpen={showZoneFilterDropdown}
        referenceElement={zoneFilterButtonRef.current}
        title="Фильтровать по зонам"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.zone.all },
          { value: 'with', label: 'С зонами', count: filterCounts.zone.with, disabled: filterCounts.zone.with === 0 },
          { value: 'without', label: 'Без зон', count: filterCounts.zone.without, disabled: filterCounts.zone.without === 0 }
        ]}
        selectedValues={tempZoneFilter}
        onApply={(value) => {
          setTempZoneFilter(value);
        }}
        onCancel={() => {
          setShowZoneFilterDropdown(false);
          setTempZoneFilter(zoneFilter);
        }}
        onOk={() => {
          setZoneFilter(tempZoneFilter);
          setShowZoneFilterDropdown(false);
        }}
        onReset={() => {
          setZoneFilter(null);
          setTempZoneFilter(null);
          setShowZoneFilterDropdown(false);
        }}
        multiSelect={false}
      />

      <FilterDropdown
        isOpen={showSourceFilterDropdown}
        referenceElement={sourceFilterButtonRef.current}
        title="Фильтровать по источнику"
        options={[
          { value: 'all', label: 'Все', count: filterCounts.source.all },
          { value: 'empty', label: '—', count: filterCounts.source.empty || 0, disabled: (filterCounts.source.empty || 0) === 0 },
          { value: 'facebook', label: 'Facebook', icon: <FacebookIcon className="w-4 h-4" />, count: filterCounts.source.facebook, disabled: filterCounts.source.facebook === 0 },
          { value: 'tiktok', label: 'TikTok', icon: <TiktokIcon className="w-4 h-4" />, count: filterCounts.source.tiktok, disabled: filterCounts.source.tiktok === 0 },
          { value: 'google', label: 'Google', icon: <GoogleIcon className="w-4 h-4" />, count: filterCounts.source.google, disabled: filterCounts.source.google === 0 }
        ]}
        selectedValues={tempSourceFilter}
        onApply={(value) => {
          setTempSourceFilter(value);
        }}
        onCancel={() => {
          setShowSourceFilterDropdown(false);
          setTempSourceFilter(sourceFilter);
        }}
        onOk={() => {
          setSourceFilter(tempSourceFilter);
          setShowSourceFilterDropdown(false);
        }}
        onReset={() => {
          setSourceFilter(null);
          setTempSourceFilter(null);
          setShowSourceFilterDropdown(false);
        }}
        multiSelect={false}
      />

    </div>
  );
}

// Добавляем стили для анимации
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
`;
document.head.appendChild(style);

export default LandingTeamLead;
