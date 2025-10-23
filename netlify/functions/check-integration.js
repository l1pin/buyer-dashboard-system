exports.handler = async (event, context) => {
    // Только POST запросы
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { url, uuid } = JSON.parse(event.body);

        if (!url || !uuid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'URL и UUID обязательны' })
            };
        }

        // Загружаем страницу
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    found: false, 
                    error: `Не удалось загрузить страницу (код ${response.status})`,
                    details: 'Проверьте доступность страницы'
                })
            };
        }

        const html = await response.text();
        
        // Ищем код интеграции
        const integrationPattern = new RegExp(
            `<div[^>]*id\\s*=\\s*["']rt-meta["'][^>]*data-rt-sub16\\s*=\\s*["']${uuid}["'][^>]*>\\s*</div>`,
            'i'
        );
        
        // Альтернативные паттерны для поиска
        const altPattern1 = new RegExp(`data-rt-sub16\\s*=\\s*["']${uuid}["']`, 'i');
        const altPattern2 = new RegExp(`${uuid}`, 'i');
        
        const found = integrationPattern.test(html) || altPattern1.test(html);
        const uuidExists = altPattern2.test(html);

        let details = '';
        if (!found && uuidExists) {
            details = 'UUID найден на странице, но код интеграции неполный или неправильно оформлен';
        } else if (!found) {
            details = 'UUID не найден на странице';
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                found,
                details,
                checkedUrl: url
            })
        };

    } catch (error) {
        console.error('Ошибка проверки интеграции:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Ошибка при проверке интеграции',
                details: error.message
            })
        };
    }
};
