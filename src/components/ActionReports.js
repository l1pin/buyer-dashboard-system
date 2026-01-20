// src/components/ActionReports.js
// Вкладка "Отчеты по действию" для Тим лида и Байера

import React, { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import {
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  Trash2,
  AlertCircle,
  Loader2,
  Star,
  RefreshCw,
  User,
  Filter,
  Zap,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { metricsAnalyticsService, userService, buyerSourceService } from '../supabaseClient';
import { offerStatusService, articleOfferMappingService, offerSeasonService, actionReportsService } from '../services/OffersSupabase';
import { effectivityZonesService } from '../services/effectivityZonesService';
import { updateStocksFromYml } from '../scripts/offers/Offers_stock';
import { calculateRemainingDays } from '../scripts/offers/Calculate_days';
import { updateLeadsFromSql, aggregateMetricsBySourceIds } from '../scripts/offers/Sql_leads';
import TooltipManager from './TooltipManager';

// URL для SQL API
const CORE_URL = 'https://api.trll-notif.com.ua/adsreportcollector/core.php';

/**
 * Получить уникальные значения из ads_collection за конкретный день
 * @param {string} offerId - ID оффера (offer_id_tracker)
 * @param {string[]} sourceIds - ID источников байера (source_id_tracker)
 * @param {string} targetDate - Целевая дата для сравнения (YYYY-MM-DD)
 * @returns {Promise<Object>} НОВЫЕ уникальные значения в иерархической структуре
 */
async function fetchAdsChanges(offerId, sourceIds, targetDate) {
  if (!offerId || !sourceIds?.length || !targetDate) {
    console.log('⚠️ fetchAdsChanges: отсутствуют параметры', { offerId, sourceIds, targetDate });
    return null;
  }

  try {
    const sourceIdsStr = sourceIds.map(id => `'${id}'`).join(',');

    // Поля для выборки (ID + названия)
    const selectFields = `
      source_id_tracker, source_tracker,
      campaign_id, campaign_name_tracker,
      adv_group_id, adv_group_name,
      adv_id, adv_name,
      account_id, account_name,
      video_id, video_name,
      target_url, adv_group_budjet
    `;

    // Запрос 1: Уникальные значения ДО целевой даты (история) - ID и значения для сравнения
    const sqlBeforeIds = `
      SELECT DISTINCT campaign_id, adv_group_id, adv_id, account_id, video_id, target_url, adv_group_budjet
      FROM ads_collection
      WHERE offer_id_tracker = '${offerId}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND adv_date < '${targetDate}'
    `;

    // Запрос 2: Полные данные ТОЛЬКО за целевую дату
    const sqlTarget = `
      SELECT DISTINCT ${selectFields}
      FROM ads_collection
      WHERE offer_id_tracker = '${offerId}'
        AND source_id_tracker IN (${sourceIdsStr})
        AND adv_date = '${targetDate}'
    `;

    console.log('📊 Запрос ads_collection:', { offerId, sourceIds, targetDate });

    // Выполняем оба запроса параллельно
    const [responseBefore, responseTarget] = await Promise.all([
      fetch(CORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assoc: true, sql: sqlBeforeIds })
      }),
      fetch(CORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assoc: true, sql: sqlTarget })
      })
    ]);

    const [dataBefore, dataTarget] = await Promise.all([
      responseBefore.json(),
      responseTarget.json()
    ]);

    // Собираем уникальные ID из ИСТОРИИ
    const historyIds = {
      campaign_id: new Set(),
      adv_group_id: new Set(),
      adv_id: new Set(),
      account_id: new Set(),
      video_id: new Set(),
      target_url: new Set(),
      adv_group_budget: new Set()
    };

    (dataBefore || []).forEach(row => {
      if (row.campaign_id) historyIds.campaign_id.add(row.campaign_id);
      if (row.adv_group_id) historyIds.adv_group_id.add(row.adv_group_id);
      if (row.adv_id) historyIds.adv_id.add(row.adv_id);
      if (row.account_id) historyIds.account_id.add(row.account_id);
      if (row.video_id) historyIds.video_id.add(row.video_id);
      if (row.target_url) historyIds.target_url.add(row.target_url);
      if (row.adv_group_budjet) historyIds.adv_group_budget.add(row.adv_group_budjet);
    });

    // Строим иерархическую структуру из НОВЫХ данных
    // Структура: sources -> campaigns -> adv_groups -> ads -> details
    const hierarchy = {};
    const seenIds = {
      campaign_id: new Set(),
      adv_group_id: new Set(),
      adv_id: new Set(),
      account_id: new Set(),
      video_id: new Set(),
      target_url: new Set(),
      adv_group_budget: new Set()
    };

    (dataTarget || []).forEach(row => {
      const sourceId = row.source_id_tracker;
      const sourceName = row.source_tracker || sourceId;
      const campaignId = row.campaign_id;
      const campaignName = row.campaign_name_tracker || campaignId;
      const advGroupId = row.adv_group_id;
      const advGroupName = row.adv_group_name || advGroupId;
      const advId = row.adv_id;
      const advName = row.adv_name || advId;

      // Инициализируем source
      if (!hierarchy[sourceId]) {
        hierarchy[sourceId] = {
          id: sourceId,
          name: sourceName,
          campaigns: {},
          isNew: false
        };
      }

      // Проверяем новая ли кампания
      const isNewCampaign = campaignId && !historyIds.campaign_id.has(campaignId);
      if (campaignId && !hierarchy[sourceId].campaigns[campaignId]) {
        hierarchy[sourceId].campaigns[campaignId] = {
          id: campaignId,
          name: campaignName,
          isNew: isNewCampaign,
          advGroups: {}
        };
        if (isNewCampaign && !seenIds.campaign_id.has(campaignId)) {
          seenIds.campaign_id.add(campaignId);
          hierarchy[sourceId].isNew = true;
        }
      }

      if (!campaignId) return;

      // Проверяем новая ли группа объявлений
      const isNewAdvGroup = advGroupId && !historyIds.adv_group_id.has(advGroupId);
      // Бюджет новый только если не было в истории И ещё не показывали
      const isNewBudget = row.adv_group_budjet && !historyIds.adv_group_budget.has(row.adv_group_budjet) && !seenIds.adv_group_budget.has(row.adv_group_budjet);
      if (advGroupId && !hierarchy[sourceId].campaigns[campaignId].advGroups[advGroupId]) {
        hierarchy[sourceId].campaigns[campaignId].advGroups[advGroupId] = {
          id: advGroupId,
          name: advGroupName,
          isNew: isNewAdvGroup,
          budget: row.adv_group_budjet,
          isNewBudget: isNewBudget,
          ads: {}
        };
        if (isNewAdvGroup && !seenIds.adv_group_id.has(advGroupId)) {
          seenIds.adv_group_id.add(advGroupId);
        }
        // Отмечаем бюджет как показанный
        if (isNewBudget) {
          seenIds.adv_group_budget.add(row.adv_group_budjet);
        }
      }

      if (!advGroupId) return;

      // Проверяем новое ли объявление
      const isNewAd = advId && !historyIds.adv_id.has(advId);
      // Проверяем уникальность деталей (не было в истории И ещё не показывали)
      const isNewAccount = row.account_id && !historyIds.account_id.has(row.account_id) && !seenIds.account_id.has(row.account_id);
      const isNewVideo = row.video_id && !historyIds.video_id.has(row.video_id) && !seenIds.video_id.has(row.video_id);
      const isNewUrl = row.target_url && !historyIds.target_url.has(row.target_url) && !seenIds.target_url.has(row.target_url);

      if (advId && !hierarchy[sourceId].campaigns[campaignId].advGroups[advGroupId].ads[advId]) {
        hierarchy[sourceId].campaigns[campaignId].advGroups[advGroupId].ads[advId] = {
          id: advId,
          name: advName,
          isNew: isNewAd,
          details: {
            accountId: row.account_id,
            accountName: row.account_name || row.account_id,
            isNewAccount: isNewAccount,
            videoId: row.video_id,
            videoName: row.video_name || row.video_id,
            isNewVideo: isNewVideo,
            targetUrl: row.target_url,
            isNewUrl: isNewUrl
          }
        };
        if (isNewAd && !seenIds.adv_id.has(advId)) {
          seenIds.adv_id.add(advId);
        }
        // Отмечаем детали как показанные
        if (isNewAccount) seenIds.account_id.add(row.account_id);
        if (isNewVideo) seenIds.video_id.add(row.video_id);
        if (isNewUrl) seenIds.target_url.add(row.target_url);
      }
    });

    // Подсчет новых элементов
    let newCampaigns = 0, newAdvGroups = 0, newAds = 0, newBudgets = 0, newCreatives = 0, newLandings = 0;
    Object.values(hierarchy).forEach(source => {
      Object.values(source.campaigns).forEach(campaign => {
        if (campaign.isNew) newCampaigns++;
        Object.values(campaign.advGroups).forEach(advGroup => {
          if (advGroup.isNew) newAdvGroups++;
          if (advGroup.isNewBudget) newBudgets++;
          Object.values(advGroup.ads).forEach(ad => {
            if (ad.isNew) newAds++;
            if (ad.details.isNewVideo) newCreatives++;
            if (ad.details.isNewUrl) newLandings++;
          });
        });
      });
    });

    const hasChanges = newCampaigns > 0 || newAdvGroups > 0 || newAds > 0 || newBudgets > 0 || newCreatives > 0 || newLandings > 0;

    console.log('✅ Сравнение за', targetDate, ':', {
      historyRecords: dataBefore?.length || 0,
      targetDayRecords: dataTarget?.length || 0,
      newCampaigns,
      newAdvGroups,
      newAds,
      newBudgets,
      newCreatives,
      newLandings
    });

    return {
      hasChanges,
      hierarchy,
      stats: {
        newCampaigns,
        newAdvGroups,
        newAds,
        newBudgets,
        newCreatives,
        newLandings
      },
      targetDate,
      beforeCount: dataBefore?.length || 0,
      targetCount: dataTarget?.length || 0
    };

  } catch (error) {
    console.error('❌ Ошибка fetchAdsChanges:', error);
    return null;
  }
}

// Кнопка копирования ID в буфер
const CopyButton = memo(({ value, size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sizeClasses = size === 'xs'
    ? 'h-3 w-3'
    : 'h-3.5 w-3.5';

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center p-0.5 rounded hover:bg-slate-200 transition-colors ${
        copied ? 'text-green-600' : 'text-slate-400 hover:text-slate-600'
      }`}
      title={copied ? 'Скопировано!' : 'Копировать ID'}
    >
      {copied ? (
        <Check className={sizeClasses} />
      ) : (
        <Copy className={sizeClasses} />
      )}
    </button>
  );
});

// Иконка информации
const InfoIcon = memo(({ onClick, className = "text-gray-500 w-3 h-3" }) => (
  <svg
    className={`${className} cursor-pointer hover:text-gray-700`}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
));

// Компонент skeleton для ячейки таблицы
function SkeletonCell({ width = 'w-10' }) {
  return (
    <div className={`${width} h-4 bg-slate-200 rounded animate-pulse mx-auto`} />
  );
}

// Расчет дней до прихода
const calculateDaysUntilArrival = (dateString) => {
  if (!dateString) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arrivalDate = new Date(dateString);
    arrivalDate.setHours(0, 0, 0, 0);
    const diffTime = arrivalDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
};

// Опции для действий с подменю
const ACTION_OPTIONS_WITH_SUBMENU = [
  { value: 'enabled_from_arrival', label: 'Вкл с прихода' },
  {
    value: 'reconfigured',
    label: 'Перенастроил',
    multiSelect: true,
    subOptions: [
      { value: 'new_account', label: 'Новый акк' },
      { value: 'target', label: 'Таргет' },
      { value: 'creative', label: 'Крео' },
      { value: 'audience', label: 'Аудитория' },
      { value: 'landing', label: 'Ленд' },
      { value: 'budget', label: 'Бюджет' },
      { value: 'duplicate', label: 'Дубль' },
      { value: 'other', label: 'Другое', requiresText: true }
    ]
  },
  {
    value: 'new_product',
    label: 'Новинка',
    multiSelect: false,
    subOptions: [
      { value: 'from_old', label: 'Из старого' },
      { value: 'from_new', label: 'Из нового' }
    ]
  },
  { value: 'out_of_stock', label: 'Закончились' },
  {
    value: 'tz',
    label: 'ТЗ',
    multiSelect: true,
    subOptions: [
      { value: 'tz_creative', label: 'Креатив', requiresTrelloLink: true },
      { value: 'tz_landing', label: 'Лендинг', requiresTrelloLink: true }
    ]
  }
];

// Опции для действий (для обратной совместимости)
const ACTION_OPTIONS = [
  { value: 'enabled_from_arrival', label: 'Вкл с прихода' },
  { value: 'reconfigured', label: 'Перенастроил' },
  { value: 'new_product', label: 'Новинка' },
  { value: 'out_of_stock', label: 'Закончились' },
  { value: 'tz', label: 'ТЗ' }
];

// Опции для "Перенастроил"
const RECONFIGURED_OPTIONS = [
  { value: 'new_account', label: 'Новый акк' },
  { value: 'target', label: 'Таргет' },
  { value: 'creative', label: 'Крео' },
  { value: 'audience', label: 'Аудитория' },
  { value: 'landing', label: 'Ленд' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'duplicate', label: 'Дубль' },
  { value: 'other', label: 'Другое' }
];

// Опции для "Новинка"
const NEW_PRODUCT_OPTIONS = [
  { value: 'from_old', label: 'Из старого' },
  { value: 'from_new', label: 'Из нового' }
];

// Компонент выпадающего списка с фиксированным позиционированием
function CustomDropdown({ value, options, onChange, placeholder = 'Выберите...', className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Обновляем позицию dropdown при открытии
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-left text-sm border rounded-lg flex items-center justify-between transition-colors ${
          value
            ? 'bg-white border-slate-300 text-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-400'
        } hover:border-slate-400`}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-auto"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                value === option.value ? 'bg-blue-50 text-blue-600' : 'text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Компонент мультивыбора действий с подменю
function MultiSelectActionDropdown({ selectedActions, onChange, hasError = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState({ top: 0, left: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isInputFocused, setIsInputFocused] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const submenuRef = useRef(null);
  const itemRefs = useRef({});

  const actions = selectedActions || [];

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          (!submenuRef.current || !submenuRef.current.contains(event.target))) {
        setIsOpen(false);
        setHoveredItem(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Позиция dropdown
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Позиция подменю при наведении
  const handleItemHover = (optionValue) => {
    const option = ACTION_OPTIONS_WITH_SUBMENU.find(o => o.value === optionValue);
    if (option?.subOptions) {
      setHoveredItem(optionValue);
      const itemEl = itemRefs.current[optionValue];
      if (itemEl) {
        const rect = itemEl.getBoundingClientRect();
        setSubmenuPosition({
          top: rect.top,
          left: rect.right + 2
        });
      }
    } else {
      setHoveredItem(null);
    }
  };

  // Проверка выбран ли action
  const isActionSelected = (actionValue) => {
    return actions.some(a => a.action === actionValue);
  };

  // Проверка выбран ли конкретный subAction
  const isSubSelected = (actionValue, subValue) => {
    return actions.some(a => a.action === actionValue && a.subAction === subValue);
  };

  // Переключение простого action - применяется сразу
  const toggleSimpleAction = (actionValue) => {
    if (isActionSelected(actionValue)) {
      onChange(actions.filter(a => a.action !== actionValue));
    } else {
      onChange([...actions, { action: actionValue, subAction: '', customText: '', trelloLink: '' }]);
    }
  };

  // Выбор/снятие sub-option - применяется сразу
  const toggleSubOption = (actionValue, subValue) => {
    const option = ACTION_OPTIONS_WITH_SUBMENU.find(o => o.value === actionValue);
    const isMultiSelect = option?.multiSelect;
    const alreadySelected = isSubSelected(actionValue, subValue);

    if (isMultiSelect) {
      if (alreadySelected) {
        onChange(actions.filter(a => !(a.action === actionValue && a.subAction === subValue)));
      } else {
        onChange([...actions, { action: actionValue, subAction: subValue, customText: '', trelloLink: '' }]);
      }
    } else {
      if (alreadySelected) {
        onChange(actions.filter(a => a.action !== actionValue));
      } else {
        const filtered = actions.filter(a => a.action !== actionValue);
        onChange([...filtered, { action: actionValue, subAction: subValue, customText: '', trelloLink: '' }]);
      }
    }
  };

  // Обновление customText для "Другое"
  const updateCustomText = (text) => {
    const updated = actions.map(a => {
      if (a.action === 'reconfigured' && a.subAction === 'other') {
        return { ...a, customText: text };
      }
      return a;
    });
    onChange(updated);
  };

  // Обновление trelloLink для ТЗ
  const updateTrelloLink = (subAction, link) => {
    const updated = actions.map(a => {
      if (a.action === 'tz' && a.subAction === subAction) {
        return { ...a, trelloLink: link };
      }
      return a;
    });
    onChange(updated);
  };

  // Проверка нужно ли показать поле "Другое"
  const showOtherInput = isSubSelected('reconfigured', 'other');
  const otherText = actions.find(a => a.action === 'reconfigured' && a.subAction === 'other')?.customText || '';

  // Проверка нужно ли показать поля ТЗ
  const showTzCreative = isSubSelected('tz', 'tz_creative');
  const showTzLanding = isSubSelected('tz', 'tz_landing');
  const tzCreativeLink = actions.find(a => a.action === 'tz' && a.subAction === 'tz_creative')?.trelloLink || '';
  const tzLandingLink = actions.find(a => a.action === 'tz' && a.subAction === 'tz_landing')?.trelloLink || '';

  // Рендер резюме
  const renderSummary = () => {
    if (actions.length === 0) {
      return <span className="text-slate-400">Выберите действия</span>;
    }

    const groups = {};
    actions.forEach(a => {
      if (!groups[a.action]) groups[a.action] = [];
      groups[a.action].push(a);
    });

    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {Object.entries(groups).map(([actionValue, items]) => {
          const opt = ACTION_OPTIONS_WITH_SUBMENU.find(o => o.value === actionValue);
          if (!opt) return null;

          if (!opt.subOptions) {
            return (
              <span key={actionValue} className="inline-flex items-center text-slate-700">
                <span className="text-blue-600 mr-1">✓</span>
                {opt.label}
              </span>
            );
          }

          const validItems = items.filter(item => item.subAction);
          if (validItems.length === 0) return null;

          if (actionValue === 'tz') {
            return (
              <span key={actionValue} className="inline-flex items-center gap-1 text-slate-700">
                <span className="text-blue-600">✓</span>
                <span>ТЗ:</span>
                {validItems.map((item, idx) => {
                  const subOpt = opt.subOptions.find(s => s.value === item.subAction);
                  return (
                    <span key={item.subAction} className="inline-flex items-center">
                      {idx > 0 && <span className="text-slate-400 mx-0.5">/</span>}
                      {item.trelloLink ? (
                        <a
                          href={item.trelloLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {subOpt?.label}
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span>{subOpt?.label}</span>
                      )}
                    </span>
                  );
                })}
              </span>
            );
          }

          const subLabels = validItems.map(item => {
            const subOpt = opt.subOptions.find(s => s.value === item.subAction);
            if (item.subAction === 'other') return item.customText || 'Другое';
            return subOpt?.label || '';
          }).filter(Boolean).join(', ');

          if (!subLabels) return null;

          return (
            <span key={actionValue} className="inline-flex items-center text-slate-700">
              <span className="text-blue-600 mr-1">✓</span>
              <span>{opt.label}:</span>
              <span className="ml-1 text-slate-600">{subLabels}</span>
            </span>
          );
        }).filter(Boolean)}
      </div>
    );
  };

  const hoveredOption = hoveredItem ? ACTION_OPTIONS_WITH_SUBMENU.find(o => o.value === hoveredItem) : null;

  return (
    <div className="space-y-2">
      {/* Кнопка dropdown */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-w-[200px] px-3 py-2 text-left text-sm border rounded-lg flex items-center justify-between transition-colors ${
          actions.length
            ? 'bg-white border-slate-300 text-slate-700'
            : 'bg-slate-50 border-slate-200 text-slate-400'
        } hover:border-slate-400 ${hasError ? 'ring-2 ring-red-500' : ''}`}
      >
        <div className="flex-1 min-w-0 mr-2">
          {renderSummary()}
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Поля ввода под dropdown */}
      {showOtherInput && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">Другое:</span>
          <input
            type="text"
            value={otherText}
            onChange={(e) => updateCustomText(e.target.value)}
            placeholder="Укажите что именно..."
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
      {showTzCreative && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">ТЗ Креатив:</span>
          <input
            type="text"
            value={tzCreativeLink}
            onChange={(e) => updateTrelloLink('tz_creative', e.target.value)}
            placeholder="https://trello.com/c/..."
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
      {showTzLanding && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">ТЗ Лендинг:</span>
          <input
            type="text"
            value={tzLandingLink}
            onChange={(e) => updateTrelloLink('tz_landing', e.target.value)}
            placeholder="https://trello.com/c/..."
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Основной dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl min-w-[200px]"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left, zIndex: 9999 }}
          onMouseLeave={() => !isInputFocused && setHoveredItem(null)}
        >
          <div className="py-1">
            {ACTION_OPTIONS_WITH_SUBMENU.map((option) => (
              <div
                key={option.value}
                ref={el => itemRefs.current[option.value] = el}
                onMouseEnter={() => handleItemHover(option.value)}
              >
                {option.subOptions ? (
                  <div
                    className={`px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors ${
                      hoveredItem === option.value ? 'bg-slate-100' : ''
                    } ${isActionSelected(option.value) ? 'text-blue-600' : 'text-slate-700'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-blue-600 font-bold">
                        {isActionSelected(option.value) && '✓'}
                      </span>
                      <span>{option.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                ) : (
                  <div
                    onClick={() => toggleSimpleAction(option.value)}
                    className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors hover:bg-slate-100 ${
                      isActionSelected(option.value) ? 'text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <span className="w-4 text-blue-600 font-bold">
                      {isActionSelected(option.value) && '✓'}
                    </span>
                    <span>{option.label}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Подменю */}
      {isOpen && hoveredItem && hoveredOption?.subOptions && (
        <div
          ref={submenuRef}
          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl min-w-[150px] py-1"
          style={{ top: submenuPosition.top, left: submenuPosition.left, zIndex: 10000 }}
          onMouseEnter={() => setHoveredItem(hoveredItem)}
          onMouseLeave={() => !isInputFocused && setHoveredItem(null)}
        >
          {hoveredOption.subOptions.map((sub) => (
            <div
              key={sub.value}
              onClick={() => toggleSubOption(hoveredItem, sub.value)}
              className={`px-3 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors hover:bg-slate-100 ${
                isSubSelected(hoveredItem, sub.value) ? 'text-blue-600' : 'text-slate-700'
              }`}
            >
              <span className="w-4 text-blue-600 font-bold">
                {isSubSelected(hoveredItem, sub.value) && '✓'}
              </span>
              <span>{sub.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Компонент строки артикула в конфигурации
function ArticleConfigRow({ article, config, onChange, onRemove, isInvalid = false, validationErrors = {} }) {
  // Получаем массив действий
  const actions = config.actions || [];
  const when = config.when || 'tomorrow'; // По умолчанию "На завтра"

  // Обновление действий
  const handleActionsChange = (newActions) => {
    onChange({ ...config, actions: newActions });
  };

  // Обновление "когда"
  const handleWhenChange = (value) => {
    onChange({ ...config, when: value });
  };

  const hasError = validationErrors.actions || (actions.length === 0 && !isInvalid);

  return (
    <div className={`py-3 border-b last:border-b-0 ${isInvalid ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
      <div className="flex items-start gap-3">
        {/* Артикул */}
        <div className="w-24 flex-shrink-0 pt-1">
          <span className={`font-mono text-sm font-medium px-2 py-1 rounded ${
            isInvalid
              ? 'text-red-700 bg-red-100 border border-red-300'
              : 'text-slate-700 bg-slate-100'
          }`}>
            {article}
          </span>
        </div>

        {/* Действия */}
        <div className="flex-1">
          {!isInvalid ? (
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <MultiSelectActionDropdown
                  selectedActions={actions}
                  onChange={handleActionsChange}
                  hasError={hasError}
                />
                {hasError && <span className="text-xs text-red-500 mt-1 block">Выберите хотя бы одно действие</span>}
              </div>
              {/* Кнопка "Когда?" - переключатель */}
              <button
                type="button"
                onClick={() => handleWhenChange(when === 'today' ? 'tomorrow' : 'today')}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex-shrink-0 ${
                  when === 'today'
                    ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                    : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {when === 'today' ? 'Сегодня' : 'На завтра'}
              </button>
            </div>
          ) : (
            <span className="text-sm text-red-600">Артикул не найден в базе</span>
          )}
        </div>

        {/* Кнопка удаления артикула */}
        <button
          onClick={onRemove}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Удалить артикул"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ActionReports({ user }) {
  // Состояния
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [articlesInput, setArticlesInput] = useState('');
  const [modalStep, setModalStep] = useState(1); // 1 = ввод артикулов, 2 = конфигурация
  const [articleConfigs, setArticleConfigs] = useState({}); // { article: { action, subAction, customText, trelloLink } }
  const [savedReports, setSavedReports] = useState([]); // Сохраненные отчеты

  // Фильтры для тимлида
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('all');
  const [selectedActionFilter, setSelectedActionFilter] = useState('all');
  const [selectedSubActionFilter, setSelectedSubActionFilter] = useState('all');
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [hoveredAction, setHoveredAction] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    // По умолчанию выбран сегодняшний день
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [reportsCountByDay, setReportsCountByDay] = useState({}); // { 'YYYY-MM-DD': count }
  const [loadingReports, setLoadingReports] = useState(false); // Загрузка отчетов из БД
  const [savingReports, setSavingReports] = useState(false); // Сохранение отчетов в БД
  const [calendarScrollPercent, setCalendarScrollPercent] = useState(100); // Позиция слайдера (100 = справа)

  // Данные офферов из БД
  const [allMetrics, setAllMetrics] = useState([]);
  const [allStatuses, setAllStatuses] = useState({});
  const [allUsers, setAllUsers] = useState([]); // Список пользователей для аватарок
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [validatingArticles, setValidatingArticles] = useState(false);

  // Маппинг артикулов -> offer_id для API запросов
  const [articleOfferMap, setArticleOfferMap] = useState({});

  // Состояния загрузки для каждой группы колонок
  const [loadingCplLeads, setLoadingCplLeads] = useState(false); // CPL, Лиды, Рейтинг
  const [loadingDays, setLoadingDays] = useState(false); // Дни
  const [loadingStock, setLoadingStock] = useState(false); // Ост., Приход
  const [loadingZones, setLoadingZones] = useState(false); // ROI, Апрув, Выкуп

  // Обновленные данные для отчетов (метрики после обновления)
  const [updatedMetricsMap, setUpdatedMetricsMap] = useState({}); // { article: updatedMetric }
  const [offerSeasons, setOfferSeasons] = useState({}); // { article: seasons[] }
  const [stockData, setStockData] = useState({}); // Данные об остатках для тултипа

  // Ref для tooltip менеджера
  const tooltipManagerRef = useRef(null);

  // Ошибки валидации
  const [invalidArticles, setInvalidArticles] = useState([]);
  const [validationError, setValidationError] = useState('');
  const [configValidationErrors, setConfigValidationErrors] = useState({}); // { article: { action: true, subAction: true, ... } }

  // Состояние для журнала изменений (ads_collection)
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesModalData, setChangesModalData] = useState(null);
  const [loadingChanges, setLoadingChanges] = useState(false);

  // Ref для горизонтального скролла календаря
  const calendarRef = useRef(null);
  const buyerDropdownRef = useRef(null);
  const actionDropdownRef = useRef(null);

  // Закрытие дропдаунов при клике вне них
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (buyerDropdownRef.current && !buyerDropdownRef.current.contains(event.target)) {
        setShowBuyerDropdown(false);
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target)) {
        setShowActionDropdown(false);
        setHoveredAction(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Загрузка данных офферов и отчетов при монтировании
  useEffect(() => {
    loadOffersData();
    loadReportsFromDB();
  }, []);

  const loadOffersData = async () => {
    try {
      setLoadingMetrics(true);

      // Загружаем метрики, статусы, маппинги, сезоны и пользователей параллельно
      const [metricsResult, statusesResult, mappingsResult, seasonsResult, usersResult] = await Promise.all([
        metricsAnalyticsService.getAllMetrics(),
        offerStatusService.getAllStatuses(),
        articleOfferMappingService.getAllMappings(),
        offerSeasonService.getAllSeasons(),
        userService.getAllUsers()
      ]);

      setAllMetrics(metricsResult.metrics || []);
      setAllUsers(usersResult || []);

      // Преобразуем статусы в map с расчетом дней в статусе
      const statusesMap = {};
      (statusesResult || []).forEach(status => {
        let daysInStatus = 0;
        if (status.status_history && status.status_history.length > 0) {
          const currentStatusEntry = status.status_history[0];
          const changedAt = new Date(currentStatusEntry.changed_at);
          const now = new Date();
          daysInStatus = Math.floor((now - changedAt) / (1000 * 60 * 60 * 24));
        }
        statusesMap[status.offer_id] = {
          ...status,
          days_in_status: daysInStatus
        };
      });
      setAllStatuses(statusesMap);

      // Сохраняем маппинг артикулов -> offer_id
      setArticleOfferMap(mappingsResult || {});
      console.log(`📊 Загружено ${Object.keys(mappingsResult || {}).length} маппингов артикулов`);

      // Обрабатываем сезоны (article -> seasons[])
      const seasonsMap = {};
      (seasonsResult || []).forEach(season => {
        seasonsMap[season.article] = season.seasons || [];
      });
      setOfferSeasons(seasonsMap);
      console.log(`🌿 Загружено ${Object.keys(seasonsMap).length} сезонов`);

    } catch (error) {
      console.error('Ошибка загрузки данных офферов:', error);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Загрузка отчетов из БД
  const loadReportsFromDB = async (date = null) => {
    try {
      setLoadingReports(true);

      // Загружаем отчеты и статистику параллельно
      const [reports, countByDay] = await Promise.all([
        date
          ? actionReportsService.getReportsByDate(date)
          : actionReportsService.getAllReports(),
        actionReportsService.getReportsCountByDays(60) // 60 дней для календаря
      ]);

      // Преобразуем отчеты из БД в формат компонента
      // Поддерживаем новый формат с JSONB actions и старый с отдельными полями
      const formattedReports = reports.map(r => {
        // Если есть JSONB actions - используем новый формат
        if (r.actions && Array.isArray(r.actions)) {
          const firstAction = r.actions[0] || {};
          return {
            id: r.id,
            article: r.article,
            actions: r.actions,  // Все действия из JSONB
            action: firstAction.action_type,  // Для обратной совместимости
            subAction: firstAction.sub_action,
            customText: firstAction.custom_text,
            trelloLink: firstAction.trello_link,
            createdAt: r.created_at,
            createdBy: r.created_by,
            createdByName: r.created_by_name
          };
        }
        // Старый формат (для обратной совместимости)
        return {
          id: r.id,
          article: r.article,
          actions: [{  // Создаём массив из одного действия
            action_type: r.action_type,
            sub_action: r.sub_action,
            custom_text: r.custom_text,
            trello_link: r.trello_link
          }],
          action: r.action_type,
          subAction: r.sub_action,
          customText: r.custom_text,
          trelloLink: r.trello_link,
          createdAt: r.created_at,
          createdBy: r.created_by,
          createdByName: r.created_by_name
        };
      });

      setSavedReports(formattedReports);
      setReportsCountByDay(countByDay);
      console.log(`📋 Загружено ${formattedReports.length} отчетов из БД`);

    } catch (error) {
      console.error('Ошибка загрузки отчетов из БД:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  // Карта артикулов для быстрого поиска
  const articlesMap = useMemo(() => {
    const map = {};
    allMetrics.forEach(metric => {
      if (metric.article) {
        map[metric.article.toLowerCase()] = metric;
      }
    });
    return map;
  }, [allMetrics]);

  // Генерация дней для календаря (от первого дня с товарами до сегодня)
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Для байеров показываем только их собственные отчеты
    const isUserTeamlead = user?.role === 'teamlead';
    const userReports = (!isUserTeamlead && user?.id)
      ? savedReports.filter(r => r.createdBy === user.id)
      : savedReports;

    // Находим самую раннюю дату с отчетами
    let startDate = today;
    if (userReports.length > 0) {
      const reportDates = userReports.map(r => {
        const d = new Date(r.createdAt);
        d.setHours(0, 0, 0, 0);
        return d;
      });
      startDate = new Date(Math.min(...reportDates.map(d => d.getTime())));
    }

    // Генерируем дни от startDate до today
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      const date = new Date(currentDate);
      const dateKey = date.toISOString().split('T')[0];
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));

      days.push({
        date: date,
        dateKey: dateKey,
        day: date.getDate(),
        weekday: date.toLocaleString('ru', { weekday: 'short' }),
        month: date.toLocaleString('ru', { month: 'short' }),
        isToday: daysAgo === 0,
        isYesterday: daysAgo === 1,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        daysAgo: daysAgo,
        // Считаем товары из userReports (отфильтрованных по пользователю)
        tasksCount: userReports.filter(r => {
          const reportDate = new Date(r.createdAt);
          reportDate.setHours(0, 0, 0, 0);
          return reportDate.getTime() === date.getTime();
        }).length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Если нет отчетов - показываем только сегодня
    if (days.length === 0) {
      days.push({
        date: today,
        dateKey: today.toISOString().split('T')[0],
        day: today.getDate(),
        weekday: today.toLocaleString('ru', { weekday: 'short' }),
        month: today.toLocaleString('ru', { month: 'short' }),
        isToday: true,
        isYesterday: false,
        isWeekend: today.getDay() === 0 || today.getDay() === 6,
        daysAgo: 0,
        tasksCount: 0
      });
    }

    return days;
  }, [savedReports, user]);

  // Скролл календаря вправо при загрузке (чтобы видеть свежие даты)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (calendarRef.current) {
        const maxScroll = calendarRef.current.scrollWidth - calendarRef.current.clientWidth;
        calendarRef.current.scrollLeft = maxScroll;
        setCalendarScrollPercent(100);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [calendarDays]);

  // Обработка клика по дню в календаре
  const handleDayClick = (day) => {
    if (selectedDate && selectedDate.getTime() === day.date.getTime()) {
      // Повторный клик — снять выбор (показать все)
      setSelectedDate(null);
    } else {
      setSelectedDate(day.date);
    }
  };

  // Навигация по календарю
  const handleCalendarScroll = (direction) => {
    if (calendarRef.current) {
      const scrollAmount = 300;
      calendarRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Пресеты фильтров (заглушки)
  const presetButtons = [
    { id: 'preset1', label: 'Пресет 1' },
    { id: 'preset2', label: 'Пресет 2' },
    { id: 'preset3', label: 'Пресет 3' },
    { id: 'preset4', label: 'Пресет 4' },
    { id: 'preset5', label: 'Пресет 5' }
  ];

  // Список артикулов из ввода
  const parsedArticles = useMemo(() => {
    return articlesInput
      .split('\n')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  }, [articlesInput]);

  // Обработка нажатия "Применить" - валидация и переход к шагу 2
  const handleApplyArticles = async () => {
    setValidatingArticles(true);
    setValidationError('');
    setInvalidArticles([]);

    try {
      const valid = [];
      const invalid = [];

      // Проверяем каждый артикул
      parsedArticles.forEach(article => {
        const metric = articlesMap[article.toLowerCase()];
        if (metric) {
          valid.push({ article: metric.article, metric }); // Используем оригинальный регистр из БД
        } else {
          invalid.push(article);
        }
      });

      if (invalid.length > 0) {
        setInvalidArticles(invalid);
        setValidationError(`Артикул${invalid.length > 1 ? 'ы' : ''} не найден${invalid.length > 1 ? 'ы' : ''}: ${invalid.join(', ')}`);
      }

      // Инициализируем конфигурации для валидных артикулов
      const configs = {};
      valid.forEach(({ article, metric }) => {
        configs[article] = {
          actions: [{ action: '', subAction: '', customText: '', trelloLink: '' }],
          metric // Сохраняем данные метрики
        };
      });

      // Добавляем невалидные с пометкой
      invalid.forEach(article => {
        configs[article] = {
          actions: [{ action: '', subAction: '', customText: '', trelloLink: '' }],
          metric: null,
          isInvalid: true
        };
      });

      setArticleConfigs(configs);
      setModalStep(2);

    } finally {
      setValidatingArticles(false);
    }
  };

  // Обновление конфигурации артикула
  const updateArticleConfig = (article, config) => {
    setArticleConfigs(prev => ({
      ...prev,
      [article]: { ...prev[article], ...config }
    }));
  };

  // Удаление артикула из списка
  const removeArticle = (article) => {
    setArticleConfigs(prev => {
      const newConfigs = { ...prev };
      delete newConfigs[article];
      return newConfigs;
    });
    // Убираем из списка невалидных
    setInvalidArticles(prev => prev.filter(a => a !== article));
  };

  // Обработка сохранения
  const handleSaveReport = async () => {
    // Получаем валидные конфигурации (не невалидные артикулы)
    const validConfigs = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);

    // Простая проверка: у каждого артикула должно быть хотя бы одно действие
    // и если выбраны поля требующие ввода - они должны быть заполнены
    for (const [article, config] of validConfigs) {
      const actions = config.actions || [];

      // Нет действий - ошибка
      if (actions.length === 0) {
        setValidationError(`Выберите действие для артикула ${article}`);
        return;
      }

      // Проверяем обязательные поля
      for (const action of actions) {
        // "Другое" требует текст
        if (action.action === 'reconfigured' && action.subAction === 'other' && !action.customText?.trim()) {
          setValidationError(`Заполните поле "Другое" для артикула ${article}`);
          return;
        }
        // ТЗ требует ссылку
        if (action.action === 'tz' && action.subAction && !action.trelloLink?.trim()) {
          const subLabel = action.subAction === 'tz_creative' ? 'Креатив' : 'Лендинг';
          setValidationError(`Заполните ссылку ТЗ ${subLabel} для артикула ${article}`);
          return;
        }
      }
    }

    // Всё ок, очищаем ошибки
    setValidationError('');
    setConfigValidationErrors({});

    // Подготавливаем отчеты для сохранения в БД
    // Одна запись на артикул с массивом actions в JSONB
    const reportsToSave = validConfigs.map(([article, config]) => {
      const actions = config.actions || [];
      const when = config.when || 'tomorrow'; // По умолчанию "На завтра"

      // Преобразуем действия с русскими лейблами, фильтруем пустые
      const actionsForDB = actions
        .filter(actionData => actionData.action) // Убираем записи без action
        .map(actionData => {
          const actionOption = ACTION_OPTIONS.find(a => a.value === actionData.action);
          const actionLabel = actionOption?.label || actionData.action;

          let subActionLabel = null;
          if (actionData.subAction) {
            if (actionData.action === 'reconfigured') {
              const subOption = RECONFIGURED_OPTIONS.find(s => s.value === actionData.subAction);
              subActionLabel = subOption?.label || actionData.subAction;
            } else if (actionData.action === 'new_product') {
              const subOption = NEW_PRODUCT_OPTIONS.find(s => s.value === actionData.subAction);
              subActionLabel = subOption?.label || actionData.subAction;
            } else if (actionData.action === 'tz') {
              // Для ТЗ берём лейбл из ACTION_OPTIONS_WITH_SUBMENU
              const tzOption = ACTION_OPTIONS_WITH_SUBMENU.find(a => a.value === 'tz');
              const subOption = tzOption?.subOptions?.find(s => s.value === actionData.subAction);
              subActionLabel = subOption?.label || actionData.subAction;
            }
          }

          return {
            action_type: actionLabel,
            sub_action: subActionLabel,
            custom_text: actionData.customText || null,
            trello_link: actionData.trelloLink || null
          };
        });

      return {
        article,
        actions: actionsForDB,  // JSONB массив действий
        when: when,  // "today" или "tomorrow"
        created_by: user?.id,
        created_by_name: user?.name || 'Неизвестно'
      };
    });

    // Сохраняем в БД
    setSavingReports(true);
    try {
      const savedToDB = await actionReportsService.createReports(reportsToSave);

      // Преобразуем сохраненные отчеты для отображения
      const reports = savedToDB.map(r => {
        // Берём первое действие для обратной совместимости отображения
        const firstAction = r.actions?.[0] || {};
        return {
          id: r.id,
          article: r.article,
          actions: r.actions,  // Все действия из JSONB
          action: firstAction.action_type,  // Для обратной совместимости
          subAction: firstAction.sub_action,
          customText: firstAction.custom_text,
          trelloLink: firstAction.trello_link,
          createdAt: r.created_at,
          createdBy: r.created_by,
          createdByName: r.created_by_name
        };
      });

      setSavedReports(prev => [...prev, ...reports]);

      // Обновляем статистику по дням для календаря
      const countByDay = await actionReportsService.getReportsCountByDays(60);
      setReportsCountByDay(countByDay);

      console.log(`✅ Сохранено ${reports.length} отчетов в БД`);
    } catch (error) {
      console.error('❌ Ошибка сохранения отчетов:', error);
      setValidationError('Ошибка сохранения в базу данных');
      return;
    } finally {
      setSavingReports(false);
    }

    // Закрываем модальное окно и сбрасываем состояние
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
    setConfigValidationErrors({});
  };

  // Закрытие модального окна
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setModalStep(1);
    setArticlesInput('');
    setArticleConfigs({});
    setInvalidArticles([]);
    setValidationError('');
    setConfigValidationErrors({});
  };

  // Удаление отчета
  const handleDeleteReport = async (reportId) => {
    try {
      // Удаляем из БД
      await actionReportsService.deleteReport(reportId);

      // Удаляем из локального состояния
      setSavedReports(prev => prev.filter(r => r.id !== reportId));

      // Обновляем статистику по дням для календаря
      const countByDay = await actionReportsService.getReportsCountByDays(60);
      setReportsCountByDay(countByDay);

      console.log(`✅ Отчет ${reportId} удалён`);
    } catch (error) {
      console.error('❌ Ошибка удаления отчета:', error);
    }
  };

  // Открыть журнал изменений для отчета
  const handleViewChanges = async (report) => {
    setLoadingChanges(true);
    setShowChangesModal(true);
    setChangesModalData({ report, changes: null, error: null });

    try {
      // Получаем offer_id для артикула
      const offerId = articleOfferMap[report.article];
      if (!offerId) {
        setChangesModalData({ report, changes: null, error: 'Не найден offer_id для артикула' });
        setLoadingChanges(false);
        return;
      }

      // Получаем source_ids байера
      const buyerSources = await buyerSourceService.getBuyerSourcesWithPeriods(report.createdBy);
      if (!buyerSources?.traffic_channels?.length) {
        setChangesModalData({ report, changes: null, error: 'Не найдены источники байера' });
        setLoadingChanges(false);
        return;
      }

      const sourceIds = buyerSources.traffic_channels.map(ch => ch.channel_id);

      // Определяем дату начала отслеживания
      const createdDate = new Date(report.createdAt);
      let startDate;

      if (report.when_day === 'today') {
        // Сегодня - начинаем с даты создания
        startDate = createdDate.toISOString().split('T')[0];
      } else {
        // На завтра - начинаем со следующего дня
        createdDate.setDate(createdDate.getDate() + 1);
        startDate = createdDate.toISOString().split('T')[0];
      }

      // Получаем изменения
      const changes = await fetchAdsChanges(offerId, sourceIds, startDate);

      setChangesModalData({ report, changes, error: null, startDate, offerId, sourceIds });
    } catch (error) {
      console.error('❌ Ошибка получения изменений:', error);
      setChangesModalData({ report, changes: null, error: error.message });
    } finally {
      setLoadingChanges(false);
    }
  };

  // Форматирование одного действия для отображения
  const formatSingleAction = (actionData) => {
    // Данные уже хранятся с русскими лейблами в БД
    const actionType = actionData.action_type || actionData.action || '';
    const subAction = actionData.sub_action || actionData.subAction || '';
    const customText = actionData.custom_text || actionData.customText || '';
    const trelloLink = actionData.trello_link || actionData.trelloLink || '';

    // Проверяем что это данные из БД (русские лейблы)
    const isDbFormat = actionData.action_type !== undefined;

    if (isDbFormat) {
      // Формат из БД - уже русские лейблы
      if (subAction) {
        if (customText) {
          return `${actionType}: ${customText}`;
        }
        return `${actionType}: ${subAction}`;
      }
      if (trelloLink) {
        return `${actionType}`;
      }
      return actionType || '—';
    }

    // Старый формат с английскими кодами
    const action = ACTION_OPTIONS.find(a => a.value === actionType);
    let label = action?.label || actionType || '—';

    if (actionType === 'reconfigured' && subAction) {
      const sub = RECONFIGURED_OPTIONS.find(s => s.value === subAction);
      if (subAction === 'other' && customText) {
        label = `Перенастроил: ${customText}`;
      } else {
        label += `: ${sub?.label || ''}`;
      }
    }

    if (actionType === 'new_product' && subAction) {
      const sub = NEW_PRODUCT_OPTIONS.find(s => s.value === subAction);
      label += ` (${sub?.label || ''})`;
    }

    return label;
  };

  // Получение текста всех действий для отображения
  const getActionLabel = (report) => {
    // Если есть массив actions - форматируем все действия
    if (report.actions && Array.isArray(report.actions) && report.actions.length > 0) {
      return report.actions.map(formatSingleAction).join(' + ');
    }
    // Обратная совместимость со старым форматом
    return formatSingleAction(report);
  };

  // Валидация Trello ссылки
  const isValidTrelloLink = (link) => {
    if (!link || link.trim() === '') return false;
    // Ссылка должна начинаться с https://trello.com/c/
    return /^https:\/\/trello\.com\/c\/[a-zA-Z0-9]+/.test(link.trim());
  };

  // Валидация одного действия (используется для подсветки ошибок в UI)
  const validateSingleAction = (actionData) => {
    const errors = {};

    if (!actionData.action) {
      errors.action = true;
      return errors;
    }

    // Простые действия - всегда валидны
    if (actionData.action === 'enabled_from_arrival' || actionData.action === 'out_of_stock') {
      return errors;
    }

    // Действия с подменю (reconfigured, new_product, tz) - валидны если выбран subAction
    // Исключение: для "Другое" нужен текст, для "ТЗ" нужна ссылка

    // Для "Перенастроил" -> "Другое" обязательно заполнить текст
    if (actionData.action === 'reconfigured' && actionData.subAction === 'other') {
      if (!actionData.customText?.trim()) {
        errors.customText = true;
      }
    }

    // Для "ТЗ" с выбранным Креатив/Лендинг - обязательна ссылка (просто не пустая)
    if (actionData.action === 'tz' && actionData.subAction) {
      if (!actionData.trelloLink?.trim()) {
        errors.trelloLink = true;
      }
    }

    return errors;
  };

  // Валидация конфигурации одного артикула (все действия)
  const validateArticleConfig = (config) => {
    const actions = config.actions || [];

    // Если нет действий - это ошибка
    if (actions.length === 0) {
      return { errors: { actions: true }, hasErrors: true };
    }

    const allErrors = {};
    let hasAnyError = false;

    actions.forEach((actionData, index) => {
      const errors = validateSingleAction(actionData);
      if (Object.keys(errors).length > 0) {
        allErrors[index] = errors;
        hasAnyError = true;
      }
    });

    return { errors: allErrors, hasErrors: hasAnyError };
  };

  // Проверка, что все валидные артикулы полностью сконфигурированы
  const allArticlesConfigured = useMemo(() => {
    const validArticles = Object.entries(articleConfigs).filter(([_, config]) => !config.isInvalid);
    if (validArticles.length === 0) return false;

    return validArticles.every(([_, config]) => {
      const actions = config.actions || [];

      // Должно быть хотя бы одно действие
      if (actions.length === 0) return false;

      // Проверяем обязательные поля для каждого действия
      for (const action of actions) {
        // Если выбрано "Другое" - текст обязателен
        if (action.action === 'reconfigured' && action.subAction === 'other') {
          if (!action.customText?.trim()) return false;
        }
        // Если выбран ТЗ Креатив или Лендинг - ссылка обязательна
        if (action.action === 'tz' && action.subAction) {
          if (!action.trelloLink?.trim()) return false;
        }
      }

      return true;
    });
  }, [articleConfigs]);

  // Есть ли хотя бы один валидный артикул
  const hasValidArticles = useMemo(() => {
    return Object.values(articleConfigs).some(config => !config.isInvalid);
  }, [articleConfigs]);

  // Фильтрация отчетов по дате, поиску, пользователю и фильтрам
  const filteredReports = useMemo(() => {
    let reports = savedReports;

    // Для байеров показываем только их собственные действия
    const isUserTeamlead = user?.role === 'teamlead';
    if (!isUserTeamlead && user?.id) {
      reports = reports.filter(r => r.createdBy === user.id);
    }

    // Фильтр по байеру (только для тимлида)
    if (isUserTeamlead && selectedBuyerFilter !== 'all') {
      reports = reports.filter(r => r.createdBy === selectedBuyerFilter);
    }

    // Фильтр по типу действия
    if (selectedActionFilter !== 'all') {
      reports = reports.filter(r => r.action === selectedActionFilter);
    }

    // Фильтр по подкатегории действия
    if (selectedSubActionFilter !== 'all') {
      reports = reports.filter(r => r.subAction === selectedSubActionFilter);
    }

    // Фильтруем по выбранной дате
    if (selectedDate) {
      reports = reports.filter(r => {
        const reportDate = new Date(r.createdAt);
        reportDate.setHours(0, 0, 0, 0);
        const selected = new Date(selectedDate);
        selected.setHours(0, 0, 0, 0);
        return reportDate.getTime() === selected.getTime();
      });
    }

    // Затем по поисковому запросу
    if (!searchTerm) return reports;
    const term = searchTerm.toLowerCase();
    return reports.filter(r =>
      r.article.toLowerCase().includes(term) ||
      r.metric?.offer?.toLowerCase().includes(term)
    );
  }, [savedReports, searchTerm, selectedDate, user, selectedBuyerFilter, selectedActionFilter, selectedSubActionFilter]);

  // Уникальные байеры из отчетов (для фильтра тимлида)
  const uniqueBuyers = useMemo(() => {
    const buyerMap = new Map();
    savedReports.forEach(r => {
      if (r.createdBy && !buyerMap.has(r.createdBy)) {
        const buyerUser = allUsers.find(u => u.id === r.createdBy);
        buyerMap.set(r.createdBy, {
          id: r.createdBy,
          name: r.createdByName || buyerUser?.name || 'Неизвестно',
          avatar_url: buyerUser?.avatar_url || null
        });
      }
    });
    return Array.from(buyerMap.values());
  }, [savedReports, allUsers]);

  // Уникальные типы действий из отчетов
  const uniqueActions = useMemo(() => {
    const actionMap = new Map();
    savedReports.forEach(r => {
      if (r.action && !actionMap.has(r.action)) {
        // Собираем подкатегории для этого действия
        const subActions = new Set();
        savedReports.forEach(report => {
          if (report.action === r.action && report.subAction) {
            subActions.add(report.subAction);
          }
        });
        actionMap.set(r.action, {
          action: r.action,
          subActions: Array.from(subActions)
        });
      }
    });
    return Array.from(actionMap.values());
  }, [savedReports]);

  // Получение цвета статуса и дней в статусе - данные подтягиваются динамически
  const getStatusDisplay = (report) => {
    // Ищем метрику по артикулу чтобы получить offer_id
    const articleLower = report.article?.toLowerCase();
    const metric = allMetrics.find(m => m.article?.toLowerCase() === articleLower);

    // Получаем статус по offer_id
    const statusData = metric?.id ? allStatuses[metric.id] : null;
    const status = statusData?.current_status;
    const daysInStatus = statusData?.days_in_status ?? null;

    if (!status) return { color: 'bg-slate-300', days: null, status: null };

    const config = offerStatusService.getStatusColor(status);
    return {
      color: config.color, // например 'bg-green-500'
      days: daysInStatus,
      status: status
    };
  };

  // Получение актуальных метрик для отчета - данные подтягиваются динамически
  const getReportMetric = useCallback((report) => {
    // Сначала ищем метрики специфичные для байера (по ключу article__buyerId)
    const reportKey = `${report.article}__${report.createdBy}`;
    if (updatedMetricsMap[reportKey]) {
      // Объединяем базовые метрики артикула с метриками байера
      const baseMetric = updatedMetricsMap[report.article] || {};
      const buyerMetric = updatedMetricsMap[reportKey];

      // Используем buyer_leads_data напрямую - там уже все периоды (4, 7, 14, 30, 60, 90)
      // отфильтрованные по source_id байера
      return {
        ...baseMetric,
        ...buyerMetric,
        leads_4days: buyerMetric.buyer_leads_data?.[4]?.leads ?? baseMetric.leads_4days,
        leads_data: buyerMetric.buyer_leads_data || baseMetric.leads_data
      };
    }

    // Если есть обновленные данные из updateVisibleReportsMetrics - приоритет им
    if (updatedMetricsMap[report.article]) {
      return updatedMetricsMap[report.article];
    }

    // Иначе ищем в загруженных метриках по артикулу
    const articleLower = report.article?.toLowerCase();
    const baseMetric = allMetrics.find(m => m.article?.toLowerCase() === articleLower) || {};

    return baseMetric;
  }, [updatedMetricsMap, allMetrics]);

  // Проверка, идет ли какое-либо обновление
  const isAnyLoading = loadingCplLeads || loadingDays || loadingStock || loadingZones;

  // ========== ГЛАВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ МЕТРИК ДЛЯ ВИДИМЫХ ОТЧЕТОВ ==========
  const updateVisibleReportsMetrics = useCallback(async (forDate = null) => {
    // Фильтруем отчеты по дате если указана
    let reportsToUpdate = savedReports;
    if (forDate) {
      reportsToUpdate = savedReports.filter(r => {
        const reportDate = new Date(r.createdAt);
        reportDate.setHours(0, 0, 0, 0);
        const targetDate = new Date(forDate);
        targetDate.setHours(0, 0, 0, 0);
        return reportDate.getTime() === targetDate.getTime();
      });
      console.log(`📅 Фильтруем отчеты для даты ${forDate.toLocaleDateString('ru')}: найдено ${reportsToUpdate.length} отчетов`);
    }

    // Получаем уникальные артикулы из отфильтрованных отчетов
    const uniqueArticles = [...new Set(reportsToUpdate.map(r => r.article))];

    if (uniqueArticles.length === 0) {
      console.log('⚠️ Нет артикулов для обновления');
      return;
    }

    console.log(`🔄 Обновляем метрики для ${uniqueArticles.length} артикулов...`);

    // Создаем массив метрик только для видимых артикулов
    // Данные берём из загруженных allMetrics по артикулу
    const visibleMetrics = uniqueArticles.map(article => {
      const articleLower = article.toLowerCase();
      const baseMetric = allMetrics.find(m => m.article?.toLowerCase() === articleLower) || {};
      return {
        id: baseMetric.id,
        article: article,
        offer: baseMetric.offer || baseMetric.offer_name,
        stock_quantity: baseMetric.stock_quantity,
        offer_price: baseMetric.offer_price,
        ...baseMetric
      };
    }).filter(m => m.article);

    // Создаем карту артикулов -> offer_id только для видимых
    const visibleArticleOfferMap = {};
    uniqueArticles.forEach(article => {
      if (articleOfferMap[article]) {
        visibleArticleOfferMap[article] = articleOfferMap[article];
      }
    });

    console.log(`📊 Доступно ${Object.keys(visibleArticleOfferMap).length} маппингов для видимых артикулов`);

    try {
      // ШАГ 1: Загружаем остатки (Ост., Приход)
      setLoadingStock(true);
      let updatedMetrics = [...visibleMetrics];

      try {
        const stocksResult = await updateStocksFromYml(updatedMetrics);
        updatedMetrics = stocksResult.metrics;
        setStockData(stocksResult.skuData || {}); // Сохраняем данные для тултипа
        console.log('✅ Остатки обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки остатков:', error);
      } finally {
        setLoadingStock(false);
      }

      // ШАГ 2: Загружаем зоны эффективности (ROI, Апрув, Выкуп, red_zone_price)
      // ВАЖНО: Зоны должны быть загружены ДО расчета рейтинга, т.к. рейтинг зависит от red_zone_price
      setLoadingZones(true);

      try {
        const zonesResult = await effectivityZonesService.enrichMetricsWithZones(updatedMetrics);
        updatedMetrics = zonesResult;
        console.log('✅ Зоны эффективности обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки зон:', error);
      } finally {
        setLoadingZones(false);
      }

      // ШАГ 3: Рассчитываем дни продаж (Дни)
      setLoadingDays(true);
      let rawData = null;

      try {
        const daysResult = await calculateRemainingDays(updatedMetrics, visibleArticleOfferMap);
        updatedMetrics = daysResult.metrics;
        rawData = daysResult.rawData; // Сохраняем для следующего шага
        console.log('✅ Дни продаж рассчитаны');
      } catch (error) {
        console.error('❌ Ошибка расчета дней:', error);
      } finally {
        setLoadingDays(false);
      }

      // ШАГ 4: Обновляем CPL, Лиды, Рейтинг
      // Теперь red_zone_price уже доступен из шага 2, рейтинг будет рассчитан корректно
      setLoadingCplLeads(true);

      let dataBySourceIdAndDate = null;
      try {
        const leadsResult = await updateLeadsFromSql(updatedMetrics, visibleArticleOfferMap, rawData);
        updatedMetrics = leadsResult.metrics;
        dataBySourceIdAndDate = leadsResult.dataBySourceIdAndDate; // Сохраняем для фильтрации по байерам
        console.log('✅ CPL, Лиды, Рейтинг обновлены');
      } catch (error) {
        console.error('❌ Ошибка загрузки CPL/Лидов:', error);
      } finally {
        setLoadingCplLeads(false);
      }

      // ШАГ 5: Рассчитываем CPL и Лиды для каждого байера (по его source_id_tracker)
      // Загружаем source_ids всех байеров
      let buyerSourcesMap = {}; // { buyer_id: { source_ids: [...], accessDatesMap: {...} } }
      try {
        const allBuyerSources = await buyerSourceService.getAllBuyerSourcesWithPeriods();
        allBuyerSources.forEach(buyer => {
          const sourceIds = buyer.traffic_channels.map(ch => ch.channel_id);
          const accessDatesMap = {};
          buyer.traffic_channels.forEach(ch => {
            accessDatesMap[ch.channel_id] = {
              accessGranted: ch.access_granted,
              accessLimited: ch.access_limited
            };
          });
          buyerSourcesMap[buyer.buyer_id] = { source_ids: sourceIds, accessDatesMap };
        });
        console.log(`📊 Загружено ${Object.keys(buyerSourcesMap).length} байеров с source_ids`);
      } catch (error) {
        console.error('❌ Ошибка загрузки источников байеров:', error);
      }

      // Сохраняем обновленные метрики в map по артикулу
      // Но для каждого отчета рассчитываем индивидуальные CPL/Leads по source_id байера
      const newMetricsMap = {};

      // Создаем базовую карту метрик по артикулу
      updatedMetrics.forEach(metric => {
        if (metric.article) {
          newMetricsMap[metric.article] = metric;
        }
      });

      // Теперь для каждого отчета рассчитываем индивидуальные CPL/Leads по source_id байера
      // Для ВСЕХ периодов: 4, 7, 14, 30, 60, 90 дней
      const BUYER_PERIODS = [4, 7, 14, 30, 60, 90];
      const periodLabels = { 4: '4 дня', 7: '7 дней', 14: '14 дней', 30: '30 дней', 60: '60 дней', 90: '90 дней' };

      if (dataBySourceIdAndDate && Object.keys(buyerSourcesMap).length > 0) {
        reportsToUpdate.forEach(report => {
          const buyerId = report.createdBy;
          const article = report.article;
          const buyerData = buyerSourcesMap[buyerId];

          if (buyerData && buyerData.source_ids.length > 0 && dataBySourceIdAndDate[article]) {
            // Рассчитываем CPL/Leads для КАЖДОГО периода по source_ids байера
            const buyerLeadsData = {};

            BUYER_PERIODS.forEach(periodDays => {
              const periodMetrics = aggregateMetricsBySourceIds(
                article,
                buyerData.source_ids,
                dataBySourceIdAndDate,
                periodDays
              );

              buyerLeadsData[periodDays] = {
                leads: periodMetrics.leads,
                cost: periodMetrics.cost,
                cpl: periodMetrics.cpl,
                label: periodLabels[periodDays]
              };
            });

            // Создаем уникальный ключ для этого отчета (артикул + байер)
            const reportKey = `${article}__${buyerId}`;
            const baseMetric = newMetricsMap[article] || {};

            newMetricsMap[reportKey] = {
              ...baseMetric,
              buyer_leads_data: buyerLeadsData,
              buyer_source_ids: buyerData.source_ids
            };

            console.log(`📈 ${article} (байер ${report.createdByName}): Лиды 14д=${buyerLeadsData[14]?.leads || 0}, CPL=${buyerLeadsData[14]?.cpl?.toFixed(2) || '—'}`);
          }
        });
      }

      setUpdatedMetricsMap(prev => ({ ...prev, ...newMetricsMap }));
      console.log(`✅ Обновлено ${Object.keys(newMetricsMap).length} метрик`);

    } catch (error) {
      console.error('❌ Ошибка обновления метрик:', error);
    }
  }, [savedReports, articleOfferMap, allMetrics]);

  // ========== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ МЕТРИК ==========

  // Автоматическое обновление при загрузке отчетов из БД
  useEffect(() => {
    if (savedReports.length > 0 && !loadingReports && Object.keys(articleOfferMap).length > 0) {
      // Обновляем метрики для выбранной даты или сегодня при первой загрузке
      const dateToUpdate = selectedDate || new Date();
      console.log(`🚀 Автообновление метрик для ${dateToUpdate.toLocaleDateString('ru')}`);
      updateVisibleReportsMetrics(dateToUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingReports, articleOfferMap]);

  // Автоматическое обновление при смене выбранной даты
  useEffect(() => {
    if (selectedDate && savedReports.length > 0 && Object.keys(articleOfferMap).length > 0 && !isAnyLoading) {
      console.log(`📅 Смена даты: обновляем метрики для ${selectedDate.toLocaleDateString('ru')}`);
      updateVisibleReportsMetrics(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // ========== СИСТЕМА ТУЛТИПОВ ==========

  // Функция генерации заголовка тултипа
  const getTooltipTitleSync = (type, article) => {
    const articleBadge = article ? (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        {article}
      </span>
    ) : null;
    const titles = {
      cpl: 'CPL по периодам',
      leads: 'Лиды по периодам',
      rating: 'История рейтинга',
      zone: 'Зоны эффективности',
      stock: 'Остатки по модификациям',
      date: 'Дата прихода',
      season: 'Сезонность'
    };
    return <div className="flex items-center gap-2"><span>{titles[type] || 'Информация'}</span>{articleBadge}</div>;
  };

  // Функция генерации контента тултипа
  const renderTooltipContentSync = useCallback((type, data) => {
    const getRatingColorLocal = (rating) => {
      switch (rating) {
        case 'A': return 'bg-green-100 text-green-800';
        case 'B': return 'bg-yellow-100 text-yellow-800';
        case 'C': return 'bg-orange-100 text-orange-800';
        case 'D': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-400';
      }
    };
    const getZoneColorsLocal = (zoneType) => {
      switch (zoneType) {
        case 'red': return { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400' };
        case 'pink': return { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' };
        case 'gold': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
        case 'green': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
        default: return null;
      }
    };
    const formatDateLocal = (dateString) => {
      if (!dateString) return '—';
      try { return new Date(dateString).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
      catch { return '—'; }
    };

    switch (type) {
      case 'rating':
        return (
          <div className="flex flex-col gap-2">
            {data.ratingHistory?.length > 0 ? data.ratingHistory.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs border-b border-gray-100 pb-2 last:border-b-0">
                <span className="text-gray-600 w-20">{item.month} {item.year}</span>
                <span className={`font-semibold px-2 py-1 rounded ${getRatingColorLocal(item.rating)}`}>{item.rating}</span>
                <span className="text-gray-700 font-mono">CPL: {item.cpl > 0 ? item.cpl.toFixed(2) : '—'}</span>
                <span className="text-gray-700">Лиды: {item.leads}</span>
              </div>
            )) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
          </div>
        );
      case 'cpl':
      case 'leads':
        return (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-1 px-2">Период</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'CPL' : 'Лидов'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Расход' : 'CPL'}</th>
              <th className="text-right py-1 px-2">{type === 'cpl' ? 'Лидов' : 'Расход'}</th>
            </tr></thead>
            <tbody>
              {[7, 14, 30, 60, 90].map(days => {
                const d = data.leadsData?.[days];
                if (!d) return null;
                return <tr key={days} className="border-b border-gray-100">
                  <td className="py-1 px-2">{d.label}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? (d.cpl > 0 ? d.cpl.toFixed(2) : '—') : d.leads}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? (d.cost > 0 ? d.cost.toFixed(2) : '—') : (d.cpl > 0 ? d.cpl.toFixed(2) : '—')}</td>
                  <td className="py-1 px-2 text-right font-mono">{type === 'cpl' ? d.leads : (d.cost > 0 ? d.cost.toFixed(2) : '—')}</td>
                </tr>;
              })}
            </tbody>
          </table>
        );
      case 'stock':
        const baseArticle = data.article?.split("-")[0];
        const mods = baseArticle && stockData[baseArticle]?.modificationsDisplay || [];
        return <div className="flex flex-col gap-1.5">
          {mods.length > 0 ? mods.map((m, i) => <div key={i} className="text-xs text-gray-700">{m}</div>) : <div className="text-xs text-gray-500 italic">Нет данных</div>}
        </div>;
      case 'date':
        return <div className="text-sm text-gray-900 font-mono">{data.date ? formatDateLocal(data.date) : 'Нет данных'}</div>;
      case 'zone':
        const m = data.metric;
        return <div className="flex flex-col gap-2">
          {['red', 'pink', 'gold', 'green'].map(z => {
            const price = m[`${z}_zone_price`];
            if (price == null) return null;
            const c = getZoneColorsLocal(z);
            return <div key={z} className="flex items-center gap-2">
              <span className="text-xs text-gray-600 w-20 capitalize">{z === 'red' ? 'Красная' : z === 'pink' ? 'Розовая' : z === 'gold' ? 'Золотая' : 'Зеленая'}:</span>
              <span className={`font-mono px-2 py-1 rounded-full text-xs border ${c.bg} ${c.text} ${c.border}`}>${Number(price).toFixed(2)}</span>
            </div>;
          })}
        </div>;
      case 'season':
        return <div className="flex flex-col gap-3">
          <div><div className="text-xs font-medium text-gray-600 mb-1">Категория:</div><div className="text-sm">{data.category || '—'}</div></div>
          {data.categoryDetails?.length > 0 && <div><div className="text-xs font-medium text-gray-600 mb-1">Категории товаров:</div>
            {data.categoryDetails.map((d, i) => <div key={i} className="text-xs text-gray-700">{d}</div>)}
          </div>}
          <div><div className="text-xs font-medium text-gray-600 mb-1">Спецсезон:</div>
            {data.specialSeasonStart || data.specialSeasonEnd ? <div className="text-sm font-mono">{data.specialSeasonStart || '—'} — {data.specialSeasonEnd || '—'}</div> : <div className="text-sm text-gray-500 italic">Не задан</div>}
          </div>
        </div>;
      default:
        return <div>Неизвестный тип</div>;
    }
  }, [stockData]);

  // Функция открытия тултипа
  const openTooltip = useCallback((type, index, data, event) => {
    if (!tooltipManagerRef.current) return;

    const tooltipId = `${type}-${index}`;
    let position = { x: 100, y: 100 };
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      position = { x: rect.left + rect.width + 10, y: rect.top };
    }

    const title = getTooltipTitleSync(type, data.article);
    const content = renderTooltipContentSync(type, data);

    tooltipManagerRef.current.open(tooltipId, title, content, position);
  }, [renderTooltipContentSync]);

  // Автообновление метрик при добавлении новых отчетов
  const prevReportsCountRef = useRef(0);
  useEffect(() => {
    const currentCount = savedReports.length;
    const prevCount = prevReportsCountRef.current;

    // Если добавились новые отчеты - запускаем обновление сразу
    if (currentCount > prevCount) {
      console.log(`📈 Добавлено ${currentCount - prevCount} новых отчетов, запускаем обновление...`);
      // Сразу ставим loading для всех колонок
      setLoadingStock(true);
      setLoadingDays(true);
      setLoadingCplLeads(true);
      setLoadingZones(true);
      updateVisibleReportsMetrics();
    }

    prevReportsCountRef.current = currentCount;
  }, [savedReports.length, updateVisibleReportsMetrics]);

  // Определяем название панели в зависимости от роли
  const isTeamlead = user?.role === 'teamlead';
  const panelTitle = isTeamlead ? 'Отчеты по байерам' : 'Отчет по действиям';

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {panelTitle}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            {/* Кнопка обновления метрик */}
            <button
              onClick={updateVisibleReportsMetrics}
              disabled={isAnyLoading || savedReports.length === 0}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all duration-200 shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnyLoading ? 'animate-spin' : ''}`} />
              Обновить метрики
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              disabled={loadingMetrics}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm disabled:opacity-50"
            >
              {loadingMetrics ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Создать отчет
            </button>
          </div>
        </div>
      </div>

      {/* Календарь - горизонтальные карточки */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        {/* Карточки дней с snap-скроллом */}
        <div
          ref={calendarRef}
          className="flex space-x-2 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          onScroll={(e) => {
            const el = e.target;
            const scrollPercent = el.scrollLeft / (el.scrollWidth - el.clientWidth) * 100;
            setCalendarScrollPercent(scrollPercent || 0);
          }}
        >
          {calendarDays.map((day, index) => {
            const isSelected = selectedDate && selectedDate.getTime() === day.date.getTime();
            const isToday = day.isToday;

            let containerClass = '';
            let dateClass = '';
            let countClass = '';

            if (isSelected) {
              containerClass = 'bg-blue-500 border-blue-500 shadow-md shadow-blue-200';
              dateClass = 'bg-blue-400 text-white';
              countClass = 'text-white';
            } else if (isToday) {
              containerClass = 'bg-white border-2 border-blue-400 shadow-sm';
              dateClass = 'bg-slate-100 text-blue-600';
              countClass = 'text-slate-600';
            } else {
              containerClass = 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm';
              dateClass = 'bg-slate-100 text-slate-500';
              countClass = 'text-slate-600';
            }

            return (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={`flex-shrink-0 flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 snap-start ${containerClass}`}
              >
                <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-md text-xs font-medium ${dateClass}`}>
                  <span className="text-sm font-bold leading-none">{day.day}</span>
                  <span className="text-[10px] leading-none mt-0.5">{day.month}</span>
                </div>
                <div className={`flex items-center gap-1.5 ${countClass}`}>
                  <span className="text-sm font-medium">Товаров</span>
                  <span className="text-lg font-bold">{day.tasksCount}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Простой слайдер */}
        <div className="mt-3 px-2">
          <input
            type="range"
            min="0"
            max={calendarDays.length - 1}
            value={Math.round((calendarScrollPercent / 100) * (calendarDays.length - 1))}
            onChange={(e) => {
              const dayIndex = Number(e.target.value);
              const percent = (dayIndex / (calendarDays.length - 1)) * 100;
              setCalendarScrollPercent(percent);

              // Скроллим карточки
              if (calendarRef.current) {
                const maxScroll = calendarRef.current.scrollWidth - calendarRef.current.clientWidth;
                calendarRef.current.scrollLeft = (percent / 100) * maxScroll;
              }

              // Выбираем день
              if (calendarDays[dayIndex]) {
                setSelectedDate(calendarDays[dayIndex].date);
              }
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Панель поиска и фильтров - стиль как в OffersTL */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Кнопка фильтров */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-lg border transition-all duration-200 ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-600'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="Фильтры"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12L5 4" />
              <path d="M19 20L19 17" />
              <path d="M5 20L5 16" />
              <path d="M19 13L19 4" />
              <path d="M12 7L12 4" />
              <path d="M12 20L12 11" />
              <circle cx="5" cy="14" r="2" />
              <circle cx="12" cy="9" r="2" />
              <circle cx="19" cy="15" r="2" />
            </svg>
          </button>

          {/* Поиск */}
          <div className="w-64 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50 hover:bg-white transition-colors"
            />
          </div>

          {/* Фильтры для тимлида */}
          {isTeamlead && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />

              {/* Фильтр по байеру */}
              <div className="relative" ref={buyerDropdownRef}>
                <button
                  onClick={() => {
                    setShowBuyerDropdown(!showBuyerDropdown);
                    setShowActionDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                    selectedBuyerFilter !== 'all'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {selectedBuyerFilter === 'all' ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                      {uniqueBuyers.find(b => b.id === selectedBuyerFilter)?.avatar_url ? (
                        <img
                          src={uniqueBuyers.find(b => b.id === selectedBuyerFilter)?.avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate">
                    {selectedBuyerFilter === 'all' ? 'Все байеры' : uniqueBuyers.find(b => b.id === selectedBuyerFilter)?.name || 'Байер'}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showBuyerDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedBuyerFilter('all');
                        setShowBuyerDropdown(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                        selectedBuyerFilter === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <User className="h-5 w-5 text-slate-400" />
                      <span>Все байеры</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    {uniqueBuyers.map(buyer => (
                      <button
                        key={buyer.id}
                        onClick={() => {
                          setSelectedBuyerFilter(buyer.id);
                          setShowBuyerDropdown(false);
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                          selectedBuyerFilter === buyer.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {buyer.avatar_url ? (
                            <img src={buyer.avatar_url} alt={buyer.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-3 w-3 text-gray-400" />
                          )}
                        </div>
                        <span className="truncate">{buyer.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Фильтр по типу действия */}
              <div className="relative" ref={actionDropdownRef}>
                <button
                  onClick={() => {
                    setShowActionDropdown(!showActionDropdown);
                    setShowBuyerDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                    selectedActionFilter !== 'all'
                      ? 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span className="max-w-[120px] truncate">
                    {selectedActionFilter === 'all'
                      ? 'Все действия'
                      : selectedSubActionFilter !== 'all'
                        ? `${selectedActionFilter}: ${selectedSubActionFilter}`
                        : selectedActionFilter
                    }
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>

                {showActionDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1">
                    <button
                      onClick={() => {
                        setSelectedActionFilter('all');
                        setSelectedSubActionFilter('all');
                        setShowActionDropdown(false);
                        setHoveredAction(null);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                        selectedActionFilter === 'all' ? 'bg-purple-50 text-purple-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <Zap className="h-5 w-5 text-slate-400" />
                      <span>Все действия</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    {uniqueActions.map(({ action, subActions }) => (
                      <div
                        key={action}
                        className="relative"
                        onMouseEnter={() => setHoveredAction(action)}
                        onMouseLeave={() => setHoveredAction(null)}
                      >
                        <button
                          onClick={() => {
                            if (subActions.length === 0) {
                              setSelectedActionFilter(action);
                              setSelectedSubActionFilter('all');
                              setShowActionDropdown(false);
                            }
                          }}
                          className={`flex items-center justify-between w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                            selectedActionFilter === action ? 'bg-purple-50 text-purple-700 font-medium' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${
                              action === 'Перенастроил' ? 'bg-blue-500' :
                              action === 'Новинка' ? 'bg-green-500' :
                              action === 'ТЗ' ? 'bg-purple-500' :
                              action === 'Выключил' ? 'bg-red-500' :
                              action === 'Включил' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                            <span>{action}</span>
                          </div>
                          {subActions.length > 0 && (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                        </button>

                        {/* Подменю для подкатегорий */}
                        {subActions.length > 0 && hoveredAction === action && (
                          <div className="absolute left-full top-0 ml-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1">
                            <button
                              onClick={() => {
                                setSelectedActionFilter(action);
                                setSelectedSubActionFilter('all');
                                setShowActionDropdown(false);
                                setHoveredAction(null);
                              }}
                              className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                selectedActionFilter === action && selectedSubActionFilter === 'all'
                                  ? 'bg-purple-50 text-purple-700 font-medium'
                                  : 'text-slate-700'
                              }`}
                            >
                              Все «{action}»
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            {subActions.map(sub => (
                              <button
                                key={sub}
                                onClick={() => {
                                  setSelectedActionFilter(action);
                                  setSelectedSubActionFilter(sub);
                                  setShowActionDropdown(false);
                                  setHoveredAction(null);
                                }}
                                className={`flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                                  selectedActionFilter === action && selectedSubActionFilter === sub
                                    ? 'bg-purple-50 text-purple-700 font-medium'
                                    : 'text-slate-600'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                {sub}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Кнопка сброса фильтров */}
              {(selectedBuyerFilter !== 'all' || selectedActionFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedBuyerFilter('all');
                    setSelectedActionFilter('all');
                    setSelectedSubActionFilter('all');
                  }}
                  className="px-2 py-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Сбросить фильтры"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Кнопка пресетов и панель пресетов */}
          <div className="flex items-center">
            <button
              onClick={() => setShowPresets(!showPresets)}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200 ${
                showPresets
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              Пресеты
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${showPresets ? 'rotate-180' : ''}`} />
            </button>

            {/* Панель пресетов с анимацией */}
            <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
              showPresets ? 'max-w-[600px] opacity-100 ml-3' : 'max-w-0 opacity-0 ml-0'
            }`}>
              {presetButtons.map((preset) => (
                <button
                  key={preset.id}
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Заголовки таблицы - стиль как в OffersTL */}
      <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 overflow-hidden">
        <div className="flex items-center text-xs font-semibold text-slate-600">
          <div className="w-[3%] min-w-[25px] text-center">№</div>
          <div className="w-[6%] min-w-[55px] text-center">Артикул</div>
          <div className={`${isTeamlead ? 'w-[12%] min-w-[90px]' : 'w-[20%] min-w-[150px]'} text-left`}>Название</div>
          <div className="w-[5%] min-w-[45px] text-center">Статус</div>
          {isTeamlead && <div className="w-[8%] min-w-[70px] text-center">Байер</div>}
          <div className="w-[5%] min-w-[42px] text-center">CPL</div>
          <div className="w-[4%] min-w-[35px] text-center">Лиды</div>
          <div className="w-[4%] min-w-[35px] text-center">Акт. дней</div>
          <div className="w-[3%] min-w-[30px] text-center" title="Рейтинг">
            <Star className="h-3.5 w-3.5 mx-auto text-slate-500" />
          </div>
          <div className="w-[5%] min-w-[38px] text-center">ROI</div>
          <div className="w-[6%] min-w-[50px] text-center">CPL зона</div>
          <div className="w-[5%] min-w-[42px] text-center">Прибыль</div>
          <div className="w-[4%] min-w-[32px] text-center">Дни</div>
          <div className="w-[4%] min-w-[32px] text-center">Ост.</div>
          <div className="w-[5%] min-w-[38px] text-center">Приход</div>
          <div className="w-[5%] min-w-[40px] text-center">Апрув</div>
          <div className="w-[5%] min-w-[40px] text-center">Выкуп</div>
          <div className="w-[5%] min-w-[55px] text-center">Сезон</div>
          <div className="w-[5%] min-w-[50px] text-center">Цена</div>
          <div className="w-[5%] min-w-[35px]"></div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-auto">
        {filteredReports.length === 0 ? (
          <div className="text-center text-slate-500 py-12">
            <Calendar className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Нет данных для отображения
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Нажмите "Создать отчет" чтобы добавить артикулы
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={loadingMetrics}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Создать отчет
            </button>
          </div>
        ) : (
          <div className="px-4 py-2">
            {filteredReports.map((report, index) => {
              const statusDisplay = getStatusDisplay(report);
              const metric = getReportMetric(report);

              // Определение цвета рейтинга
              const getRatingColor = (rating) => {
                switch (rating) {
                  case 'A': return 'bg-green-100 text-green-800';
                  case 'B': return 'bg-yellow-100 text-yellow-800';
                  case 'C': return 'bg-orange-100 text-orange-800';
                  case 'D': return 'bg-red-100 text-red-800';
                  default: return 'bg-gray-100 text-gray-400';
                }
              };

              // Цвет для типа действия
              const getActionColor = (action) => {
                switch (action) {
                  case 'Перенастроил': return 'bg-blue-50 text-blue-700 border-blue-200';
                  case 'Новинка': return 'bg-green-50 text-green-700 border-green-200';
                  case 'ТЗ': return 'bg-purple-50 text-purple-700 border-purple-200';
                  case 'Выключил': return 'bg-red-50 text-red-700 border-red-200';
                  case 'Включил': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  default: return 'bg-slate-50 text-slate-600 border-slate-200';
                }
              };

              // Формирование текста действия
              const actionText = report.subAction
                ? `${report.action}: ${report.subAction}${report.customText ? ` — ${report.customText}` : ''}`
                : report.action || '—';

              return (
                <div
                  key={report.id}
                  className="bg-white rounded-lg border border-slate-200 mb-2 hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Основная строка с метриками */}
                  <div className="flex items-center text-sm px-4 py-3">
                    <div className="w-[3%] min-w-[25px] text-center text-slate-500 font-medium">
                    {index + 1}
                  </div>
                  <div className="w-[6%] min-w-[55px] text-center">
                    <span className="font-mono text-xs text-slate-800">
                      {report.article}
                    </span>
                  </div>
                  <div className={`${isTeamlead ? 'w-[12%] min-w-[90px]' : 'w-[20%] min-w-[150px]'} text-left text-slate-700 truncate pr-2`} title={metric.offer}>
                    {metric.offer || '—'}
                  </div>
                  {/* Статус - кружок + дни */}
                  <div className="w-[5%] min-w-[45px] flex items-center justify-center gap-1" title={statusDisplay.status ? `${statusDisplay.status} • ${statusDisplay.days ?? 0} дней` : ''}>
                    <span className={`w-3 h-3 rounded-full ${statusDisplay.color} shadow-sm border border-white`}></span>
                    <span className="text-xs font-medium text-slate-700">
                      {statusDisplay.days !== null ? `${statusDisplay.days}д` : '—'}
                    </span>
                  </div>
                  {/* Байер - аватар + имя (только для тимлида) */}
                  {isTeamlead && (
                    <div className="w-[8%] min-w-[70px] flex items-center justify-center gap-1.5">
                      {(() => {
                        const buyerUser = allUsers.find(u => u.id === report.createdBy);
                        const avatarUrl = buyerUser?.avatar_url;
                        const buyerName = report.createdByName || buyerUser?.name || '—';
                        return (
                          <>
                            <div className="w-5 h-5 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={buyerName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full flex items-center justify-center ${avatarUrl ? 'hidden' : ''}`}>
                                <User className="h-3 w-3 text-gray-400" />
                              </div>
                            </div>
                            <span className="text-xs text-slate-700 truncate" title={buyerName}>
                              {buyerName.split(' ')[0]}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                    {/* CPL - loading при loadingCplLeads */}
                    <div className="w-[5%] min-w-[42px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        <>
                          <span className={`font-mono text-xs ${metric.leads_data?.[4]?.cpl != null ? 'text-slate-800' : 'text-slate-400'}`}>
                            {metric.leads_data?.[4]?.cpl?.toFixed(2) || '—'}
                          </span>
                          {metric.leads_data && <InfoIcon onClick={(e) => openTooltip('cpl', index, { leadsData: metric.leads_data, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* Лиды - loading при loadingCplLeads */}
                    <div className="w-[4%] min-w-[35px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        <>
                          <span className={`font-mono text-xs ${metric.leads_data?.[4]?.leads != null ? 'text-slate-800' : 'text-slate-400'}`}>
                            {metric.leads_data?.[4]?.leads || '—'}
                          </span>
                          {metric.leads_data && <InfoIcon onClick={(e) => openTooltip('leads', index, { leadsData: metric.leads_data, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* Акт. дней - пока заглушка */}
                    <div className="w-[4%] min-w-[35px] text-center text-xs font-mono text-slate-400">
                      —
                    </div>

                    {/* Рейтинг - loading при loadingCplLeads */}
                    <div className="w-[3%] min-w-[30px] flex items-center justify-center gap-1">
                      {loadingCplLeads ? (
                        <SkeletonCell width="w-6" />
                      ) : (
                        <>
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRatingColor(metric.lead_rating)}`}>
                            {metric.lead_rating || '—'}
                          </span>
                          {metric.rating_history?.length > 0 && <InfoIcon onClick={(e) => openTooltip('rating', index, { ratingHistory: metric.rating_history, article: report.article }, e)} />}
                        </>
                      )}
                    </div>

                    {/* ROI - loading при loadingZones */}
                    <div className="w-[5%] min-w-[38px] text-center text-xs font-mono text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.actual_roi_percent != null ? `${metric.actual_roi_percent}%` : '—'
                      )}
                    </div>

                    {/* CPL зона - loading при loadingZones */}
                    <div className="w-[6%] min-w-[50px] flex items-center justify-center gap-1">
                      {loadingZones ? (
                        <SkeletonCell width="w-12" />
                      ) : (
                        <>
                          {metric.red_zone_price != null ? (
                            <span className="font-mono inline-flex items-center px-1 py-0.5 rounded-full text-[10px] border bg-red-100 text-red-800 border-red-200">
                              ${Number(metric.red_zone_price).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                          <InfoIcon onClick={(e) => openTooltip('zone', index, { metric, article: report.article }, e)} />
                        </>
                      )}
                    </div>

                    {/* Прибыль */}
                    <div className="w-[5%] min-w-[42px] text-center text-xs font-mono text-green-600 font-medium">
                      {metric.profit != null ? `$${metric.profit}` : '—'}
                    </div>

                    {/* Дни - loading при loadingDays */}
                    <div className="w-[4%] min-w-[32px] text-center text-xs text-slate-700">
                      {loadingDays ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        metric.days_remaining ?? '—'
                      )}
                    </div>

                    {/* Ост. - loading при loadingStock */}
                    <div className="w-[4%] min-w-[32px] text-center text-xs font-mono text-slate-800">
                      {loadingStock ? (
                        <SkeletonCell width="w-8" />
                      ) : (
                        metric.stock_quantity ?? '—'
                      )}
                    </div>

                    {/* Приход - дней до прихода */}
                    <div className="w-[5%] min-w-[38px] text-center text-xs font-mono">
                      {(() => {
                        const daysUntil = calculateDaysUntilArrival(metric.next_calculated_arrival);
                        if (daysUntil === null) {
                          return <span className="text-slate-400">—</span>;
                        }
                        return (
                          <span className={daysUntil < 0 ? 'text-red-600' : 'text-green-600'}>
                            {daysUntil}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Апрув - loading при loadingZones */}
                    <div className="w-[5%] min-w-[40px] text-center text-xs text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.approve_percent != null ? `${metric.approve_percent}%` : '—'
                      )}
                    </div>

                    {/* Выкуп - loading при loadingZones */}
                    <div className="w-[5%] min-w-[40px] text-center text-xs text-slate-700">
                      {loadingZones ? (
                        <SkeletonCell width="w-10" />
                      ) : (
                        metric.sold_percent != null ? `${metric.sold_percent}%` : '—'
                      )}
                    </div>

                    {/* Сезон */}
                    <div className="w-[5%] min-w-[55px] text-center whitespace-nowrap">
                      <span className="text-sm">{offerSeasons[report.article]?.length > 0
                        ? offerSeasons[report.article].join('')
                        : <span className="text-slate-400 text-xs">—</span>
                      }</span>
                    </div>
                    {/* Цена */}
                    <div className="w-[5%] min-w-[50px] text-center font-mono text-xs text-slate-800">
                      {metric.offer_price ? `${Number(metric.offer_price).toFixed(0)}₴` : '—'}
                    </div>
                    <div className="w-[5%] min-w-[35px] text-center">
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Удалить отчет"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Панель с типом действия */}
                  <div className={`px-4 py-2 border-t ${getActionColor(report.action)} flex items-center gap-3`}>
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-60">Действие:</span>
                    <span className="text-sm font-medium">{actionText}</span>
                    {/* Иконка журнала изменений - только для тимлида */}
                    {isTeamlead && (
                      <button
                        onClick={() => handleViewChanges(report)}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Журнал изменений в рекламе"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}
                    {report.trelloLink && (
                      <a
                        href={report.trelloLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM10.5 17.25a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-10.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v10.5zm9-4.5a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-6a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5v6z"/>
                        </svg>
                        Trello
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно создания отчета */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white rounded-xl shadow-2xl mx-4 transition-all duration-300 ${
            modalStep === 1 ? 'w-full max-w-md' : 'w-full max-w-3xl'
          }`}>
            {/* Header модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-900">
                  {modalStep === 1 ? 'Создать отчет' : 'Настройка артикулов'}
                </h3>
                {modalStep === 2 && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                    {Object.values(articleConfigs).filter(c => !c.isInvalid).length} артикул(ов)
                  </span>
                )}
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Ошибка валидации */}
            {modalStep === 2 && validationError && (
              <div className="mx-6 mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Ошибка валидации</p>
                  <p className="text-sm text-red-600">{validationError}</p>
                </div>
              </div>
            )}

            {/* Body модального окна */}
            <div className="px-6 py-4 max-h-[60vh] overflow-auto">
              {modalStep === 1 ? (
                <>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Артикулы
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Введите артикулы, по одному в каждой строке
                  </p>
                  <textarea
                    value={articlesInput}
                    onChange={(e) => setArticlesInput(e.target.value)}
                    placeholder={"R00009\nC01063\nC01064"}
                    className="w-full h-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono bg-slate-50"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    {parsedArticles.length} артикул(ов)
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500 mb-4">
                    Укажите действие для каждого артикула
                  </p>
                  <div className="space-y-1">
                    {Object.entries(articleConfigs).map(([article, config]) => (
                      <ArticleConfigRow
                        key={article}
                        article={article}
                        config={config}
                        onChange={(newConfig) => {
                          updateArticleConfig(article, newConfig);
                          // Очищаем ошибки валидации при изменении
                          setConfigValidationErrors(prev => {
                            const next = { ...prev };
                            delete next[article];
                            return next;
                          });
                        }}
                        onRemove={() => removeArticle(article)}
                        isInvalid={config.isInvalid}
                        validationErrors={configValidationErrors[article] || {}}
                      />
                    ))}
                  </div>
                  {Object.keys(articleConfigs).length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      Нет артикулов для настройки
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer модального окна */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <div>
                {modalStep === 2 && (
                  <button
                    onClick={() => {
                      setModalStep(1);
                      setValidationError('');
                      setInvalidArticles([]);
                      setConfigValidationErrors({});
                    }}
                    className="text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    ← Назад к вводу артикулов
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Отмена
                </button>
                {modalStep === 1 ? (
                  <button
                    onClick={handleApplyArticles}
                    disabled={parsedArticles.length === 0 || validatingArticles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {validatingArticles && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Применить
                  </button>
                ) : (
                  <button
                    onClick={handleSaveReport}
                    disabled={!allArticlesConfigured || !hasValidArticles}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Сохранить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно журнала изменений */}
      {showChangesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Журнал изменений в рекламе</h3>
                {changesModalData?.report && (
                  <p className="text-sm text-slate-500">
                    Артикул: {changesModalData.report.article} •
                    Дата отслеживания: {changesModalData?.startDate || '—'}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setShowChangesModal(false);
                  setChangesModalData(null);
                }}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {loadingChanges ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-slate-600">Загрузка данных...</span>
                </div>
              ) : changesModalData?.error ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-700">{changesModalData.error}</span>
                </div>
              ) : changesModalData?.changes ? (
                <div className="space-y-4">
                  {!changesModalData.changes.hasChanges ? (
                    <div className="text-center py-8 text-slate-500">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>Новых уникальных значений не найдено</p>
                      <p className="text-xs mt-2">
                        Записей в истории: {changesModalData.changes.beforeCount || 0} •
                        Записей за {changesModalData?.startDate}: {changesModalData.changes.targetCount || 0}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Статистика */}
                      <div className="text-sm text-slate-600 mb-4 flex flex-wrap gap-2">
                        <span>Новые за <strong>{changesModalData.startDate}</strong>:</span>
                        {changesModalData.changes.stats?.newCampaigns > 0 && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            {changesModalData.changes.stats.newCampaigns} кампаний
                          </span>
                        )}
                        {changesModalData.changes.stats?.newAdvGroups > 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            {changesModalData.changes.stats.newAdvGroups} групп
                          </span>
                        )}
                        {changesModalData.changes.stats?.newAds > 0 && (
                          <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs">
                            {changesModalData.changes.stats.newAds} объявлений
                          </span>
                        )}
                        {changesModalData.changes.stats?.newBudgets > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">
                            {changesModalData.changes.stats.newBudgets} бюджетов
                          </span>
                        )}
                        {changesModalData.changes.stats?.newCreatives > 0 && (
                          <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded text-xs">
                            {changesModalData.changes.stats.newCreatives} креативов
                          </span>
                        )}
                        {changesModalData.changes.stats?.newLandings > 0 && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                            {changesModalData.changes.stats.newLandings} лендингов
                          </span>
                        )}
                      </div>

                      {/* Иерархическое отображение по источникам */}
                      {changesModalData.changes.hierarchy && Object.entries(changesModalData.changes.hierarchy).map(([sourceId, source]) => (
                        <div key={sourceId} className="mb-4 border border-slate-200 rounded-lg overflow-hidden">
                          {/* Source header */}
                          <div className="bg-slate-100 px-4 py-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-500" />
                            <span className="font-medium text-slate-700">{source.name}</span>
                            <CopyButton value={source.id} />
                          </div>

                          {/* Tree structure */}
                          <div className="bg-white px-4 py-2 font-mono text-sm">
                            {Object.values(source.campaigns).map((campaign, campIdx, campArr) => {
                              const isLastCampaign = campIdx === campArr.length - 1;
                              const campPrefix = isLastCampaign ? '└── ' : '├── ';
                              const campChildPrefix = isLastCampaign ? '    ' : '│   ';

                              return (
                              <div key={campaign.id}>
                                {/* Campaign */}
                                <div className="flex items-start gap-1 py-1">
                                  <span className="text-slate-400 whitespace-pre">{campPrefix}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-slate-500 text-xs">Кампания:</div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-slate-800">{campaign.name}</span>
                                      <CopyButton value={campaign.name} size="xs" />
                                      {campaign.isNew && (
                                        <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs font-bold rounded">Новый</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                      {campaign.id} <CopyButton value={campaign.id} size="xs" />
                                    </div>
                                  </div>
                                </div>

                                {/* Adv Groups */}
                                {Object.values(campaign.advGroups).map((advGroup, groupIdx, groupArr) => {
                                  const isLastGroup = groupIdx === groupArr.length - 1;
                                  const groupPrefix = isLastGroup ? '└── ' : '├── ';
                                  const groupChildPrefix = isLastGroup ? '    ' : '│   ';

                                  return (
                                  <div key={advGroup.id}>
                                    {/* Adv Group */}
                                    <div className="flex items-start gap-1 py-1">
                                      <span className="text-slate-400 whitespace-pre">{campChildPrefix}{groupPrefix}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-slate-500 text-xs">Группа:</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-slate-700">{advGroup.name}</span>
                                          <CopyButton value={advGroup.name} size="xs" />
                                          {advGroup.isNew && (
                                            <span className="px-1.5 py-0.5 bg-blue-500 text-white text-xs font-bold rounded">Новый</span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1">
                                          {advGroup.id} <CopyButton value={advGroup.id} size="xs" />
                                        </div>
                                        {advGroup.isNewBudget && advGroup.budget && (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-slate-500 text-xs">Бюджет:</span>
                                            <span className="font-medium text-yellow-700">${advGroup.budget}</span>
                                            <span className="px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded">Новый</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Ads */}
                                    {Object.values(advGroup.ads).map((ad, adIdx, adArr) => {
                                      const isLastAd = adIdx === adArr.length - 1;
                                      const adPrefix = isLastAd ? '└── ' : '├── ';
                                      const adChildPrefix = isLastAd ? '    ' : '│   ';

                                      return (
                                      <div key={ad.id}>
                                        {/* Ad */}
                                        <div className="flex items-start gap-1 py-1">
                                          <span className="text-slate-400 whitespace-pre">{campChildPrefix}{groupChildPrefix}{adPrefix}</span>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-slate-500 text-xs">Объявление:</div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-medium text-slate-600">{ad.name}</span>
                                              <CopyButton value={ad.name} size="xs" />
                                              {ad.isNew && (
                                                <span className="px-1.5 py-0.5 bg-cyan-500 text-white text-xs font-bold rounded">Новый</span>
                                              )}
                                            </div>
                                            <div className="text-xs text-slate-400 flex items-center gap-1">
                                              {ad.id} <CopyButton value={ad.id} size="xs" />
                                            </div>
                                          </div>
                                        </div>

                                        {/* Details - только новые */}
                                        {(ad.details.isNewAccount || ad.details.isNewVideo || ad.details.isNewUrl) && (
                                          <div className="text-xs">
                                            {ad.details.isNewAccount && ad.details.accountId && (
                                              <div className="flex items-start gap-1 py-0.5">
                                                <span className="text-slate-400 whitespace-pre">{campChildPrefix}{groupChildPrefix}{adChildPrefix}├── </span>
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-slate-500">Аккаунт:</div>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-medium text-purple-700">{ad.details.accountName}</span>
                                                    <CopyButton value={ad.details.accountName} size="xs" />
                                                    <span className="px-1.5 py-0.5 bg-purple-500 text-white font-bold rounded">Новый</span>
                                                  </div>
                                                  <div className="text-slate-400 flex items-center gap-1">
                                                    {ad.details.accountId} <CopyButton value={ad.details.accountId} size="xs" />
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                            {ad.details.isNewVideo && ad.details.videoName && (
                                              <div className="flex items-start gap-1 py-0.5">
                                                <span className="text-slate-400 whitespace-pre">{campChildPrefix}{groupChildPrefix}{adChildPrefix}{ad.details.isNewUrl ? '├── ' : '└── '}</span>
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-slate-500">Креатив:</div>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-medium text-pink-700">{ad.details.videoName}</span>
                                                    <CopyButton value={ad.details.videoName} size="xs" />
                                                    <span className="px-1.5 py-0.5 bg-pink-500 text-white font-bold rounded">Новый</span>
                                                  </div>
                                                  {ad.details.videoId && (
                                                    <div className="text-slate-400 flex items-center gap-1">
                                                      {ad.details.videoId} <CopyButton value={ad.details.videoId} size="xs" />
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                            {ad.details.isNewUrl && ad.details.targetUrl && (
                                              <div className="flex items-start gap-1 py-0.5">
                                                <span className="text-slate-400 whitespace-pre">{campChildPrefix}{groupChildPrefix}{adChildPrefix}└── </span>
                                                <div className="flex-1 min-w-0">
                                                  <div className="text-slate-500">Лендинг:</div>
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <a
                                                      href={ad.details.targetUrl}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="text-blue-600 hover:underline"
                                                    >
                                                      {ad.details.targetUrl}
                                                    </a>
                                                    <CopyButton value={ad.details.targetUrl} size="xs" />
                                                    <span className="px-1.5 py-0.5 bg-orange-500 text-white font-bold rounded">Новый</span>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      );
                                    })}
                                  </div>
                                  );
                                })}
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Нет данных
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => {
                  setShowChangesModal(false);
                  setChangesModalData(null);
                }}
                className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Менеджер тултипов */}
      <TooltipManager ref={tooltipManagerRef} />
    </div>
  );
}

export default ActionReports;
