/**
 * Утилиты для работы с киевским временем (Europe/Kyiv)
 *
 * Supabase хранит данные в UTC (timestamptz),
 * но для бизнес-логики нам нужно киевское время:
 * - Группировка отчётов по дням
 * - Определение "Сегодня" / "Завтра"
 * - Фильтрация по датам
 */

const KYIV_TIMEZONE = 'Europe/Kyiv';

/**
 * Получить текущую дату в формате YYYY-MM-DD по киевскому времени
 * @returns {string} Дата в формате "2026-01-31"
 */
export function getKyivToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: KYIV_TIMEZONE });
}

/**
 * Преобразовать любую дату (UTC или локальную) в формат YYYY-MM-DD по киевскому времени
 * @param {Date|string} date - Дата для преобразования
 * @returns {string} Дата в формате "2026-01-31"
 */
export function toKyivDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('sv-SE', { timeZone: KYIV_TIMEZONE });
}

/**
 * Получить завтрашнюю дату в формате YYYY-MM-DD по киевскому времени
 * @returns {string} Дата в формате "2026-02-01"
 */
export function getKyivTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString('sv-SE', { timeZone: KYIV_TIMEZONE });
}

/**
 * Получить дату N дней назад в формате YYYY-MM-DD по киевскому времени
 * @param {number} daysBack - Количество дней назад
 * @returns {string} Дата в формате "2026-01-31"
 */
export function getKyivDateDaysAgo(daysBack) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toLocaleDateString('sv-SE', { timeZone: KYIV_TIMEZONE });
}

/**
 * Получить начало дня по киевскому времени в формате ISO (для Supabase запросов)
 * @param {string} dateKey - Дата в формате "2026-01-31"
 * @returns {string} ISO timestamp начала дня по Киеву
 */
export function getKyivDayStartISO(dateKey) {
  // Создаём дату в полночь по Киеву
  // Используем временную метку формата, совместимого с Intl
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KYIV_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Парсим dateKey и создаём дату в полночь UTC
  const [year, month, day] = dateKey.split('-').map(Number);

  // Создаём дату в полночь UTC и корректируем на offset Киева
  // Киев: UTC+2 зимой, UTC+3 летом
  // Для полночи по Киеву нужно вычесть offset
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // полдень UTC для определения offset

  // Получаем offset Киева для этой даты
  const kyivOffset = getKyivOffset(testDate);

  // Начало дня по Киеву = полночь минус offset часов в UTC
  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - kyivOffset * 60 * 60 * 1000);

  return startOfDayUTC.toISOString();
}

/**
 * Получить конец дня по киевскому времени в формате ISO (для Supabase запросов)
 * @param {string} dateKey - Дата в формате "2026-01-31"
 * @returns {string} ISO timestamp конца дня по Киеву
 */
export function getKyivDayEndISO(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);

  // Используем полдень для определения offset (чтобы избежать проблем с переходом на летнее время)
  const testDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const kyivOffset = getKyivOffset(testDate);

  // Конец дня по Киеву = 23:59:59.999 минус offset часов в UTC
  const endOfDayUTC = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - kyivOffset * 60 * 60 * 1000);

  return endOfDayUTC.toISOString();
}

/**
 * Получить offset Киева относительно UTC для конкретной даты (в часах)
 * Учитывает переход на летнее/зимнее время
 * @param {Date} date - Дата для определения offset
 * @returns {number} Offset в часах (2 зимой, 3 летом)
 */
export function getKyivOffset(date) {
  // Создаём форматтер для Киева
  const kyivFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: KYIV_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Парсим обе даты
  const kyivParts = kyivFormatter.formatToParts(date);
  const utcParts = utcFormatter.formatToParts(date);

  const getPartValue = (parts, type) => parseInt(parts.find(p => p.type === type)?.value || '0');

  const kyivHour = getPartValue(kyivParts, 'hour');
  const utcHour = getPartValue(utcParts, 'hour');
  const kyivDay = getPartValue(kyivParts, 'day');
  const utcDay = getPartValue(utcParts, 'day');

  // Вычисляем offset с учётом перехода через полночь
  let offset = kyivHour - utcHour;
  if (kyivDay > utcDay) offset += 24;
  if (kyivDay < utcDay) offset -= 24;

  return offset;
}

/**
 * Получить следующий день от заданной даты в формате YYYY-MM-DD по киевскому времени
 * @param {Date|string} date - Исходная дата
 * @returns {string} Следующий день в формате "2026-02-01"
 */
export function getNextKyivDay(date) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  // Добавляем день к UTC времени
  d.setDate(d.getDate() + 1);
  return toKyivDateKey(d);
}

/**
 * Создать объект Date для полночи указанного дня по киевскому времени
 * @param {string} dateKey - Дата в формате "2026-01-31"
 * @returns {Date} Date объект для полночи по Киеву
 */
export function createKyivMidnight(dateKey) {
  const isoString = getKyivDayStartISO(dateKey);
  return new Date(isoString);
}

/**
 * Проверить, является ли дата "сегодня" по киевскому времени
 * @param {Date|string} date - Дата для проверки
 * @returns {boolean}
 */
export function isKyivToday(date) {
  return toKyivDateKey(date) === getKyivToday();
}

/**
 * Проверить, является ли дата "вчера" по киевскому времени
 * @param {Date|string} date - Дата для проверки
 * @returns {boolean}
 */
export function isKyivYesterday(date) {
  return toKyivDateKey(date) === getKyivDateDaysAgo(1);
}

/**
 * Получить количество дней между двумя датами по киевскому времени
 * @param {Date|string} fromDate - Начальная дата
 * @param {Date|string} toDate - Конечная дата (по умолчанию - сегодня)
 * @returns {number} Количество дней
 */
export function getKyivDaysDiff(fromDate, toDate = new Date()) {
  const fromKey = toKyivDateKey(fromDate);
  const toKey = toKyivDateKey(toDate);

  const from = new Date(fromKey + 'T00:00:00Z');
  const to = new Date(toKey + 'T00:00:00Z');

  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export default {
  KYIV_TIMEZONE,
  getKyivToday,
  getKyivTomorrow,
  toKyivDateKey,
  getKyivDateDaysAgo,
  getKyivDayStartISO,
  getKyivDayEndISO,
  getKyivOffset,
  getNextKyivDay,
  createKyivMidnight,
  isKyivToday,
  isKyivYesterday,
  getKyivDaysDiff
};
