# План оптимізації завантаження метрик байера

## Поточна проблема
- Таблиця `ads_collection`: 10+ мільйонів рядків
- Завантаження через Netlify Function (таймаут 10-26 секунд)
- Можливі таймаути при великій кількості даних

## Архітектура
```
Frontend → Netlify SQL Proxy (26s) → api.trll-notif.com.ua/core.php → MySQL
```

## ✅ Рішення 1: Додати індекси (КРИТИЧНО!)

### Запит до адміна БД:
```sql
-- Створити композитний індекс для швидкого пошуку
CREATE INDEX idx_ads_offer_source_date
ON ads_collection(offer_id_tracker, source_id_tracker, adv_date);

-- Перевірити що індекс створено
SHOW INDEX FROM ads_collection;
```

### Очікуваний результат:
- Без індексів: 30-60+ секунд (таймаут ❌)
- З індексами: 1-3 секунди ✅

---

## ✅ Рішення 2: Оптимізований SQL з GROUP BY

### Замість (зараз - ПОВІЛЬНО):
```sql
SELECT adv_date, campaign_name_tracker, campaign_name, adv_group_name, adv_name, cost, valid
FROM ads_collection
WHERE offer_id_tracker = 'xxx'
  AND source_id_tracker IN ('1','2','3')
  AND adv_date >= '2024-01-01' AND adv_date <= '2024-01-30'
ORDER BY adv_date ASC
```
- Повертає: 100-500 окремих рядків
- Агрегація в JavaScript (повільно)

### Використати (ШВИДКО):
```sql
SELECT
  adv_date,
  campaign_name_tracker,
  campaign_name,
  adv_group_name,
  adv_name,
  SUM(cost) as cost,
  SUM(valid) as valid
FROM ads_collection
WHERE offer_id_tracker = 'xxx'
  AND source_id_tracker IN ('1','2','3')
  AND adv_date >= '2024-01-01' AND adv_date <= '2024-01-30'
GROUP BY adv_date, campaign_name_tracker, campaign_name, adv_group_name, adv_name
ORDER BY adv_date ASC
```
- Повертає: 30-100 агрегованих рядків
- Агрегація в MySQL (швидко!)
- **В 5-10 разів менше даних для передачі**

---

## ✅ Рішення 3: Створити окремий PHP endpoint

Якщо у вас є доступ до `api.trll-notif.com.ua`, створити оптимізований endpoint:

### Файл: `/adsreportcollector/buyer_metrics.php`
```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$offer_id = $_POST['offer_id'] ?? '';
$source_ids = $_POST['source_ids'] ?? [];
$start_date = $_POST['start_date'] ?? '';
$end_date = $_POST['end_date'] ?? '';

// Безпека: підготовлені запити
$source_ids_placeholder = implode(',', array_fill(0, count($source_ids), '?'));

$sql = "
SELECT
  adv_date,
  campaign_name_tracker,
  campaign_name,
  adv_group_name,
  adv_name,
  SUM(cost) as cost,
  SUM(valid) as valid
FROM ads_collection
WHERE offer_id_tracker = ?
  AND source_id_tracker IN ($source_ids_placeholder)
  AND adv_date BETWEEN ? AND ?
GROUP BY adv_date, campaign_name_tracker, campaign_name, adv_group_name, adv_name
ORDER BY adv_date ASC
";

$stmt = $pdo->prepare($sql);
$params = array_merge([$offer_id], $source_ids, [$start_date, $end_date]);
$stmt->execute($params);

echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
```

### Використання:
```javascript
const response = await fetch('https://api.trll-notif.com.ua/adsreportcollector/buyer_metrics.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    offer_id: 'xxx',
    source_ids: ['1', '2', '3'],
    start_date: '2024-01-01',
    end_date: '2024-01-30'
  })
});
```

---

## ✅ Рішення 4: Materialized View (для дуже великих даних)

Якщо навіть з індексами повільно, створити materialized view:

```sql
-- Створити view з попередньою агрегацією
CREATE TABLE ads_collection_daily_summary AS
SELECT
  offer_id_tracker,
  source_id_tracker,
  adv_date,
  campaign_name_tracker,
  campaign_name,
  adv_group_name,
  adv_name,
  SUM(cost) as cost,
  SUM(valid) as valid
FROM ads_collection
WHERE adv_date >= DATE_SUB(NOW(), INTERVAL 90 DAY) -- Останні 90 днів
GROUP BY offer_id_tracker, source_id_tracker, adv_date,
         campaign_name_tracker, campaign_name, adv_group_name, adv_name;

-- Додати індекс
CREATE INDEX idx_summary ON ads_collection_daily_summary(
  offer_id_tracker, source_id_tracker, adv_date
);

-- Оновлювати щодня через cron
-- 0 2 * * * /usr/bin/mysql -e "TRUNCATE ads_collection_daily_summary; INSERT INTO ..."
```

Тоді запити будуть до `ads_collection_daily_summary` (100K рядків) замість `ads_collection` (10M рядків).

---

## Пріоритети реалізації:

1. **ПЕРШОЧЕРГОВО:** Додати індекс `idx_ads_offer_source_date` ← Це вирішить 80% проблеми
2. **ВАЖЛИВО:** Використати GROUP BY в SQL запиті ← Зменшить трафік в 5-10 разів
3. **ОПЦІОНАЛЬНО:** Створити окремий PHP endpoint ← Якщо є доступ до API
4. **ADVANCED:** Materialized view ← Якщо дуже багато даних

## Перевірка швидкості

Після додавання індексів перевірити:
```javascript
const start = performance.now();
const data = await getBuyerMetricsCalendar(sourceIds, article);
const elapsed = performance.now() - start;
console.log(`⏱️ Завантаження зайняло: ${elapsed.toFixed(0)}ms`);
```

**Очікувані результати:**
- Без оптимізації: 10,000-30,000ms (10-30 секунд) ⚠️
- З індексами: 1,000-3,000ms (1-3 секунди) ✅
- З індексами + GROUP BY: 500-1,500ms (0.5-1.5 секунди) ✅✅
- З Materialized View: 100-500ms (0.1-0.5 секунди) ⚡
