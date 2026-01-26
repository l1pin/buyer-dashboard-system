// src/components/DatabaseMenu.js
// Меню выбора таблиц для SQL Query Builder

import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Table2, TrendingUp, ShoppingCart, MousePointer, Package, DollarSign, Wallet } from 'lucide-react';

const DATABASE_TABLES = [
  {
    id: 'ads_collection',
    name: 'ads_collection',
    title: 'Рекламні дані',
    description: 'Статистика рекламних кампаній: покази, кліки, конверсії, витрати',
    icon: TrendingUp,
    color: 'blue',
    columns: 64,
    category: 'Реклама'
  },
  {
    id: 'offers_collection',
    name: 'offers_collection',
    title: 'Оффери',
    description: 'Дані офферів: ціни, апрув, викуп, зони ефективності',
    icon: Package,
    color: 'emerald',
    columns: 24,
    category: 'Товари'
  },
  {
    id: 'conversions_collection',
    name: 'conversions_collection',
    title: 'Конверсії',
    description: 'Дані конверсій з RedTrack: кліки, дати, типи, SUB параметри',
    icon: MousePointer,
    color: 'amber',
    columns: 26,
    category: 'Трекер'
  },
  {
    id: 'sales_collection',
    name: 'sales_collection',
    title: 'Продажі (CRM)',
    description: 'Замовлення з CRM: статуси, ціни, прибуток, доставка',
    icon: ShoppingCart,
    color: 'violet',
    columns: 24,
    category: 'CRM'
  },
  {
    id: 'operational_cost_collection',
    name: 'operational_cost_collection',
    title: 'Операційні витрати',
    description: 'Витрати на одну конверсію по місяцях',
    icon: Wallet,
    color: 'rose',
    columns: 4,
    category: 'Фінанси'
  },
  {
    id: 'currency_collection',
    name: 'currency_collection',
    title: 'Курси валют',
    description: 'Курси конвертації валют по місяцях (USD → UAH)',
    icon: DollarSign,
    color: 'cyan',
    columns: 6,
    category: 'Фінанси'
  }
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700'
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700'
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    hoverBorder: 'hover:border-violet-400',
    icon: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-700'
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hoverBorder: 'hover:border-rose-400',
    icon: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-700'
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    hoverBorder: 'hover:border-cyan-400',
    icon: 'text-cyan-600',
    badge: 'bg-cyan-100 text-cyan-700'
  }
};

function DatabaseMenu() {
  // Группировка по категориям
  const categories = DATABASE_TABLES.reduce((acc, table) => {
    if (!acc[table.category]) acc[table.category] = [];
    acc[table.category].push(table);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Заголовок */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Database Explorer</h1>
          <p className="text-gray-500">Виберіть таблицю для побудови SQL запитів</p>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-indigo-600">{DATABASE_TABLES.length}</div>
            <div className="text-sm text-gray-500">Таблиць</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-emerald-600">{DATABASE_TABLES.reduce((sum, t) => sum + t.columns, 0)}</div>
            <div className="text-sm text-gray-500">Колонок</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-purple-600">{Object.keys(categories).length}</div>
            <div className="text-sm text-gray-500">Категорій</div>
          </div>
        </div>

        {/* Таблицы по категориям */}
        {Object.entries(categories).map(([category, tables]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tables.map((table) => {
                const colors = colorClasses[table.color];
                const Icon = table.icon;

                return (
                  <Link
                    key={table.id}
                    to={`/db/${table.id}`}
                    className={`group block bg-white rounded-xl p-5 shadow-sm border-2 ${colors.border} ${colors.hoverBorder} transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${colors.bg}`}>
                        <Icon className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">
                            {table.title}
                          </h3>
                        </div>
                        <p className="text-xs font-mono text-gray-400 mb-2">{table.name}</p>
                        <p className="text-sm text-gray-500 line-clamp-2">{table.description}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                            <Table2 className="w-3 h-3 inline mr-1" />
                            {table.columns} колонок
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Подвал */}
        <div className="mt-12 text-center text-sm text-gray-400">
          <p>SQL Query Builder v1.0 • Powered by MySQL API</p>
        </div>
      </div>
    </div>
  );
}

export default DatabaseMenu;
