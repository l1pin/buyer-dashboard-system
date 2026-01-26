// src/components/DatabaseMenu.js
// Меню выбора таблиц для SQL Query Builder

import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Table2, TrendingUp, ShoppingCart, MousePointer, Package, DollarSign, Wallet } from 'lucide-react';

const DATABASE_TABLES = [
  {
    id: 'ads_collection',
    name: 'ads_collection',
    title: 'Рекламные данные',
    description: 'Статистика рекламных кампаний: показы, клики, конверсии, расходы',
    icon: TrendingUp,
    color: 'blue'
  },
  {
    id: 'offers_collection',
    name: 'offers_collection',
    title: 'Офферы',
    description: 'Данные офферов: цены, апрув, выкуп, зоны эффективности',
    icon: Package,
    color: 'emerald'
  },
  {
    id: 'conversions_collection',
    name: 'conversions_collection',
    title: 'Конверсии',
    description: 'Данные конверсий из RedTrack: клики, даты, типы, SUB параметры',
    icon: MousePointer,
    color: 'amber'
  },
  {
    id: 'sales_collection',
    name: 'sales_collection',
    title: 'Продажи (CRM)',
    description: 'Заказы из CRM: статусы, цены, прибыль, доставка',
    icon: ShoppingCart,
    color: 'violet'
  },
  {
    id: 'operational_cost_collection',
    name: 'operational_cost_collection',
    title: 'Операционные расходы',
    description: 'Расходы на одну конверсию по месяцам',
    icon: Wallet,
    color: 'rose'
  },
  {
    id: 'currency_collection',
    name: 'currency_collection',
    title: 'Курсы валют',
    description: 'Курсы конвертации валют по месяцам (USD → UAH)',
    icon: DollarSign,
    color: 'cyan'
  }
];

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    hoverBorder: 'hover:border-blue-400',
    icon: 'text-blue-600'
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-400',
    icon: 'text-emerald-600'
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hoverBorder: 'hover:border-amber-400',
    icon: 'text-amber-600'
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    hoverBorder: 'hover:border-violet-400',
    icon: 'text-violet-600'
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hoverBorder: 'hover:border-rose-400',
    icon: 'text-rose-600'
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    hoverBorder: 'hover:border-cyan-400',
    icon: 'text-cyan-600'
  }
};

function DatabaseMenu() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Database className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">База данных</h1>
            <p className="text-sm text-slate-500">Выберите таблицу для построения SQL запросов</p>
          </div>
        </div>

        {/* Таблицы - сетка 3x2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DATABASE_TABLES.map((table) => {
            const colors = colorClasses[table.color];
            const Icon = table.icon;

            return (
              <Link
                key={table.id}
                to={`/db/${table.id}`}
                className={`group block bg-white rounded-xl p-5 shadow-sm border ${colors.border} ${colors.hoverBorder} transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <Icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                      {table.title}
                    </h3>
                    <p className="text-xs font-mono text-slate-400 mb-2">{table.name}</p>
                    <p className="text-sm text-slate-500 line-clamp-2">{table.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DatabaseMenu;
