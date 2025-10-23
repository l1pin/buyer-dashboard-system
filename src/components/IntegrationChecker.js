import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader, ExternalLink, AlertCircle } from 'lucide-react';

function IntegrationChecker({ landingUuid }) {
    const [checkUrl, setCheckUrl] = useState('');
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState(null);
    const [error, setError] = useState('');

    const validateUrl = (url) => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const handleCheckIntegration = async () => {
        if (!checkUrl.trim()) {
            setError('Введите URL сайта для проверки');
            return;
        }

        if (!validateUrl(checkUrl)) {
            setError('Введите корректный URL (например: https://example.com)');
            return;
        }

        setChecking(true);
        setError('');
        setCheckResult(null);

        try {
            // Используем Netlify Function для проверки
            const response = await fetch('/.netlify/functions/check-integration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: checkUrl,
                    uuid: landingUuid
                })
            });

            const data = await response.json();

            if (response.ok) {
                setCheckResult(data);
            } else {
                setError(data.error || 'Ошибка проверки интеграции');
            }
        } catch (err) {
            console.error('Ошибка проверки интеграции:', err);
            setError('Не удалось проверить интеграцию. Проверьте подключение к интернету.');
        } finally {
            setChecking(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !checking) {
            handleCheckIntegration();
        }
    };

    return (
        <div className="space-y-4">
            {/* Поле ввода URL */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL сайта для проверки интеграции
                </label>
                <div className="flex space-x-2">
                    <input
                        type="url"
                        value={checkUrl}
                        onChange={(e) => {
                            setCheckUrl(e.target.value);
                            setError('');
                            setCheckResult(null);
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder="https://example.com/landing-page"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={checking}
                    />
                    <button
                        onClick={handleCheckIntegration}
                        disabled={checking || !checkUrl.trim()}
                        className={`px-4 py-2 rounded-md font-medium text-white transition-all duration-200 flex items-center space-x-2 ${
                            checking 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                        }`}
                    >
                        {checking ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                <span>Проверка...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Проверить интеграцию</span>
                            </>
                        )}
                    </button>
                </div>
                
                {/* Подсказка */}
                <p className="mt-1 text-xs text-gray-500">
                    Введите полный URL страницы, где установлен код интеграции
                </p>
            </div>

            {/* Сообщение об ошибке */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-red-800 font-medium">Ошибка проверки</p>
                        <p className="text-sm text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Результат проверки */}
            {checkResult && (
                <div className={`rounded-lg p-4 border ${
                    checkResult.found 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-yellow-50 border-yellow-200'
                }`}>
                    <div className="flex items-start space-x-3">
                        {checkResult.found ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${
                                checkResult.found ? 'text-green-800' : 'text-yellow-800'
                            }`}>
                                {checkResult.found 
                                    ? '✅ Интеграция успешно настроена!' 
                                    : '⚠️ Код интеграции не найден'}
                            </p>
                            
                            {checkResult.found ? (
                                <div className="mt-2 space-y-1">
                                    <p className="text-xs text-green-700">
                                        Код интеграции обнаружен на странице
                                    </p>
                                    <div className="bg-white bg-opacity-50 rounded p-2 mt-2">
                                        <p className="text-xs text-green-700 font-mono break-all">
                                            UUID: {landingUuid}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mt-2 space-y-2">
                                    <p className="text-xs text-yellow-700">
                                        Код интеграции не найден на указанной странице.
                                    </p>
                                    <div className="bg-white bg-opacity-50 rounded p-3">
                                        <p className="text-xs text-yellow-800 font-medium mb-2">
                                            Проверьте следующее:
                                        </p>
                                        <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                                            <li>Код размещен на правильной странице</li>
                                            <li>Код вставлен полностью, без изменений</li>
                                            <li>Страница доступна и не требует авторизации</li>
                                            <li>На странице нет ошибок JavaScript</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {checkResult.details && (
                                <div className="mt-3 p-2 bg-white bg-opacity-50 rounded">
                                    <p className="text-xs text-gray-600">
                                        <span className="font-medium">Детали:</span> {checkResult.details}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ссылка на проверенную страницу */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        
                            href={checkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800"
                        >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Открыть проверенную страницу
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IntegrationChecker;
