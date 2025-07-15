import React, { useState, useEffect } from 'react';
import { Helper, CurrencyType } from '../types';
import * as api from '../lib/api';

interface OfficeModalProps {
  show: boolean;
  onClose: () => void;
  locationId: number;
  locationName: string;
  playerLevel: number;
  playerRank: number;
  locationCurrency: number;
  locationCurrencyType: CurrencyType;
  onHelpersChanged: (amount?: number) => void; // Callback для обновления игрового экрана
  embedded?: boolean; // Флаг, указывающий что компонент встроен в таб
  updateResources?: (currencyId?: string | number, newAmount?: number) => Promise<void>; // Функция для обновления ресурсов
}

const HelperCard: React.FC<{
  helper: Helper;
  playerLevel: number;
  playerRank: number;
  locationCurrency: number;
  helperLevels: Record<number, any[]>;
  processingHelperId: number | null;
  onBuy: (helper: Helper) => void;
  onUpgrade: (helper: Helper) => void;
}> = ({ helper, playerLevel, playerRank, locationCurrency, helperLevels, processingHelperId, onBuy, onUpgrade }) => {
  // Проверяем, куплен ли помощник
  const isUnlocked = helper.isUnlocked === true || (helper as any).is_unlocked === 1;
  
  // Проверяем, доступен ли помощник для покупки по уровню
  const hasRequiredLevel = (helper as any).hasRequiredLevel || playerLevel >= helper.unlockLevel;
  
  // Проверяем, доступен ли помощник для покупки по рангу
  const helperRequiredRank = (helper as any).unlockRank || 1;
  const hasRequiredRank = playerRank >= helperRequiredRank;
  

  
  // Получаем данные об уровне помощника
  const helperLevel = isUnlocked ? ((helper as any).level || 1) : 0;
  const maxLevel = (helper as any).max_level || (helper as any).maxLevel || 5;
  const isMaxLevel = helperLevel >= maxLevel;
  
  // Получаем информацию о текущем уровне
  const helperLevelData = helperLevels[helper.id]?.find((level: any) => level.level === helperLevel) || {};
  
  // Получаем доход в час для текущего уровня
  const incomePerHour = helperLevelData.income_per_hour || helper.incomePerHour || 0;
  
  // Стоимость прокачки
  const nextLevelData = helperLevels[helper.id]?.find((level: any) => level.level === helperLevel + 1) || {};
  const upgradeCost = isUnlocked ? (nextLevelData.upgrade_cost || helper.unlockCost * 2) : 0;
  
  // Может ли игрок позволить себе купить или улучшить помощника
  const playerCanAfford = locationCurrency >= helper.unlockCost;
  const canUpgrade = isUnlocked && locationCurrency >= upgradeCost && !isMaxLevel;
  
  // Классы для кнопок
  const upgradeButtonClass = "w-full text-xs py-1 px-1 rounded bg-yellow-600" + 
    (canUpgrade ? " text-white hover:bg-yellow-700" : " opacity-70 text-gray-300") +
    (processingHelperId === helper.id ? " opacity-50 cursor-wait" : "");
    
  const buyButtonClass = "w-full text-xs py-1 px-1 rounded bg-yellow-500" + 
    (playerCanAfford ? " text-white hover:bg-yellow-600" : " opacity-70 text-gray-300") +
    (processingHelperId === helper.id ? " opacity-50 cursor-wait" : "");
  
  return (
    <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-gray-700' : 'bg-gray-900'}`}>
      {/* Верхняя часть с изображением и информацией */}
      <div className="flex items-center">
        <img 
          src={helper.imagePath || '/assets/helpers/apprentice.png'} 
          alt={helper.name} 
          className="w-7 h-7 mr-2 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white truncate">{helper.name}</div>
          <div className="text-xs text-green-400">
            +{incomePerHour}/ч
          </div>
        </div>
      </div>
      
      {/* Разделительная линия */}
      <div className="border-t border-white border-opacity-10 my-1"></div>
      
      {/* Нижняя часть с уровнем и кнопкой */}
      <div className="flex items-center justify-between">
        {/* Отображение уровня */}
        <div className="flex-shrink-0">
          {isUnlocked ? (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-xs text-white font-medium">
              {helperLevel}
            </span>
          ) : (
            !hasRequiredLevel ? (
              <span className="text-xs text-gray-400">
                {helper.unlockLevel}+
              </span>
            ) : (
              <span className="w-5"></span>
            )
          )}
        </div>
        
        {/* Кнопка улучшения/покупки */}
        <div className="flex-1 ml-2">
          {isUnlocked && isMaxLevel && (
            <div className="text-xs text-yellow-400 text-center py-1 px-1 rounded border border-yellow-600">
              Макс
            </div>
          )}
          
          {isUnlocked && !isMaxLevel && (
            <button 
              className={upgradeButtonClass}
              onClick={() => onUpgrade(helper)}
              disabled={processingHelperId === helper.id || !canUpgrade}
            >
              <span className={canUpgrade ? "" : "opacity-70"}>
                {upgradeCost}
              </span>
            </button>
          )}
          
          {!isUnlocked && hasRequiredLevel && hasRequiredRank && (
            <button 
              className={buyButtonClass}
              onClick={() => onBuy(helper)}
              disabled={!playerCanAfford || processingHelperId === helper.id}
            >
              <span className={playerCanAfford ? "" : "opacity-70"}>
                {helper.unlockCost}
              </span>
            </button>
          )}
          
          {!isUnlocked && !hasRequiredLevel && (
            <div className="text-xs text-gray-400 text-center py-1 px-1 rounded border border-gray-700">
              Уровень {helper.unlockLevel}+
            </div>
          )}
          
          {!isUnlocked && hasRequiredLevel && !hasRequiredRank && (
            <div className="text-xs text-red-400 text-center py-1 px-1 rounded border border-red-700">
                             Требуется {((helper as any).unlockRank || 1)} ранг
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Компонент для отображения и сбора накопленной прибыли помощников
const HelperIncomeCollector: React.FC<{
  onCollect: () => void;
}> = ({ onCollect }) => {
  const [pendingIncome, setPendingIncome] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPendingIncome();
    // Обновляем информацию о прибыли каждые 30 секунд
    const intervalId = setInterval(loadPendingIncome, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const loadPendingIncome = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getHelpersPendingIncome();
      setPendingIncome(data);
    } catch (error) {
      console.error('Ошибка при загрузке информации о прибыли:', error);
      setError('Не удалось загрузить информацию о прибыли');
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    try {
      setCollecting(true);
      setError(null);
      setSuccessMessage(null);
      
      const result = await api.collectHelpersPendingIncome();
      
      // Обновляем информацию о прибыли
      await loadPendingIncome();
      
      // Вызываем callback для обновления основного интерфейса
      onCollect();
      
      // Показываем сообщение об успехе
      if (result.collected && result.collected.length > 0) {
        const totalCollected = result.collected.reduce((sum: number, item: any) => sum + item.collected, 0);
        const anyStorageFull = result.collected.some((item: any) => item.storage_full);
        
        if (anyStorageFull) {
          setSuccessMessage(`Собрано ${totalCollected.toFixed(2)} монет. Склад заполнен!`);
        } else {
          setSuccessMessage(`Собрано ${totalCollected.toFixed(2)} монет`);
        }
        
        // Скрываем сообщение через 3 секунды
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setSuccessMessage('Нечего собирать');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error) {
      console.error('Ошибка при сборе прибыли:', error);
      setError('Не удалось собрать прибыль');
    } finally {
      setCollecting(false);
    }
  };

  // Вычисляем общую сумму накопленной прибыли
  const totalPendingAmount = pendingIncome.reduce((sum, income) => sum + income.pending_amount, 0);
  
  // Форматируем число с двумя знаками после запятой
  const formatAmount = (amount: number) => amount.toFixed(2);
  
  // Проверяем, есть ли что собирать
  const hasIncome = totalPendingAmount > 0;

  // Определяем названия валют
  const getCurrencyName = (currencyId: string) => {
    switch (currencyId) {
      case '1': return 'Брёвна';
      case '5': return 'Монеты';
      default: return `Валюта ${currencyId}`;
    }
  };

  return (
    <div className="bg-gray-800 p-3 rounded-lg mb-4">
      <h3 className="text-white text-center font-medium mb-2">Прибыль помощников</h3>
      
      {loading && !collecting && (
        <div className="text-center text-gray-400 text-sm mb-2">Загрузка...</div>
      )}
      
      {error && (
        <div className="bg-red-500 text-white p-2 text-center text-sm mb-2 rounded">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-500 text-white p-2 text-center text-sm mb-2 rounded">
          {successMessage}
        </div>
      )}
      
      <div className="text-center text-yellow-400 text-lg font-bold mb-2">
        {hasIncome ? `${formatAmount(totalPendingAmount)} монет` : 'Нет прибыли'}
      </div>
      
      {pendingIncome.map(income => (
        <div key={income.currency_id} className="flex justify-between text-xs text-gray-300 mb-1">
          <span>{getCurrencyName(income.currency_id)}:</span>
          <span>{formatAmount(income.pending_amount)}</span>
        </div>
      ))}
      
      <button
        onClick={handleCollect}
        disabled={!hasIncome || collecting}
        className={`w-full mt-2 py-2 px-4 rounded text-sm font-medium ${
          hasIncome && !collecting
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {collecting ? 'Сбор...' : 'Собрать прибыль'}
      </button>
    </div>
  );
};

const OfficeModal: React.FC<OfficeModalProps> = ({
  show,
  onClose,
  locationId,
  locationName,
  playerLevel,
  playerRank,
  locationCurrency,
  locationCurrencyType,
  onHelpersChanged,
  embedded = false, // По умолчанию не встроен
  updateResources
}) => {
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingHelperId, setProcessingHelperId] = useState<number | null>(null);
  const [helperLevels, setHelperLevels] = useState<Record<number, any[]>>({});

  useEffect(() => {
    if (show) {
      loadHelpers();
      loadHelperLevels();
    }
  }, [show, locationId]);

  const loadHelpers = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedHelpers = await api.getHelpersByLocationId(locationId);
      console.log('Загруженные помощники:', loadedHelpers);
      setHelpers(loadedHelpers);
    } catch (error) {
      console.error('Ошибка при загрузке помощников:', error);
      setError('Не удалось загрузить помощников');
    } finally {
      setLoading(false);
    }
  };

  const loadHelperLevels = async () => {
    try {
      // Получаем уровни всех помощников
      const helpersLevelsData = await api.getHelpersWithLevels();
      console.log('Загруженные уровни помощников:', helpersLevelsData);
      
      // Если нет данных или пустой массив, просто выходим
      if (!helpersLevelsData || helpersLevelsData.length === 0) {
        console.log('Нет данных об уровнях помощников');
        setHelperLevels({});
        return;
      }
      
      const levelsMap: Record<number, any[]> = {};
      
      // Группируем уровни по ID помощника
      helpersLevelsData.forEach(item => {
        if (!item || !item.helper_id) {
          console.warn('Пропускаем некорректные данные:', item);
          return;
        }
        
        if (!levelsMap[item.helper_id]) {
          levelsMap[item.helper_id] = [];
        }
        
        levelsMap[item.helper_id].push({
          level: item.level,
          income_per_hour: item.income_per_hour,
          upgrade_cost: item.upgrade_cost
        });
      });
      
      console.log('Сгруппированные уровни помощников:', levelsMap);
      setHelperLevels(levelsMap);
    } catch (error) {
      console.error('Ошибка при загрузке уровней помощников:', error);
      // В случае ошибки устанавливаем пустой объект, чтобы не блокировать интерфейс
      setHelperLevels({});
    }
  };

  const handleBuyHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setError(null);
      const result = await api.buyHelper(helper.id);
      
      // Если покупка успешна и вернулось обновленное количество ресурсов
      if (result.success && result.updatedCurrency) {
        console.log(`Помощник ${helper.id} успешно куплен. Обновленное количество ресурсов:`, result.updatedCurrency);
        
        // Обновляем локальное состояние количества ресурсов
        if (result.updatedCurrency.currencyId === helper.currencyId) {
          // Если передана функция updateResources, используем её
          if (updateResources) {
            await updateResources(
              result.updatedCurrency.currencyId, 
              result.updatedCurrency.amount
            );
          } else {
            // Иначе используем старый способ
            onHelpersChanged(result.updatedCurrency.amount);
          }
        }
      }
      
      await loadHelpers();
      onHelpersChanged(); // Обновляем состояние игрового экрана
    } catch (error: any) {
      console.error('Ошибка при покупке помощника:', error);
      setError(error.message || 'Ошибка при покупке помощника');
    } finally {
      setProcessingHelperId(null);
    }
  };

  const handleUpgradeHelper = async (helper: Helper) => {
    try {
      setProcessingHelperId(helper.id);
      setError(null);
      
      console.log(`Попытка улучшить помощника ID: ${helper.id}, текущий уровень: ${(helper as any).level}`);
      
      // API вызов для прокачки помощника
      const result = await api.upgradeHelper(helper.id);
      console.log('Результат запроса на улучшение:', result);
      
      await loadHelpers();
      await loadHelperLevels();
      onHelpersChanged(); // Обновляем состояние игрового экрана
    } catch (error: any) {
      console.error('Ошибка при прокачке помощника:', error);
      
      // Обработка конкретных ошибок с сервера
      let errorMessage = 'Ошибка при прокачке помощника';
      
      if (error.message) {
        if (error.message.includes('Достигнут максимальный уровень')) {
          errorMessage = 'Достигнут максимальный уровень помощника';
        } else if (error.message.includes('Недостаточно ресурсов')) {
          errorMessage = 'Недостаточно ресурсов для улучшения';
        } else if (error.message.includes('404')) {
          errorMessage = 'Информация о следующем уровне не найдена';
        } else if (error.message.includes('400')) {
          // Перезагружаем данные и пробуем снова показать актуальную информацию
          await loadHelpers();
          await loadHelperLevels();
          errorMessage = 'Невозможно улучшить помощника. Данные обновлены.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setProcessingHelperId(null);
    }
  };

  // Обработчик сбора прибыли помощников
  const handleIncomeCollected = async () => {
    try {
      // Если передана функция updateResources, используем её для обновления всех ресурсов
      if (updateResources) {
        await updateResources();
      } else {
        // Иначе используем старый способ
        onHelpersChanged();
      }
    } catch (error) {
      console.error('Ошибка при обновлении ресурсов после сбора прибыли:', error);
    }
  };

  // Рендеринг модального окна
  if (!show) return null;

  // Содержимое офиса (общее для обоих вариантов отображения)
  const officeContent = (
    <>
      {/* Сообщение об ошибке */}
      {error && (
        <div className={`bg-red-500 text-white p-2 text-center ${embedded ? 'mb-4' : ''}`}>
          {error}
        </div>
      )}
      
      {/* Компонент для сбора прибыли помощников */}
      <div className={embedded ? '' : 'p-4 pb-0'}>
        <HelperIncomeCollector onCollect={handleIncomeCollected} />
      </div>
      
      {/* Список помощников */}
      <div className={embedded ? '' : 'p-4 max-h-96 overflow-y-auto'}>
        {loading ? (
          <div className="text-center text-white py-4">Загрузка...</div>
        ) : helpers.length === 0 ? (
          <div className="text-center text-white py-4">Работников пока нет</div>
        ) : (
          <div>
            {embedded && <h3 className="text-white font-medium mb-4">Помощники локации</h3>}
            <div className="grid grid-cols-2 gap-2">
              {helpers.map(helper => (
                <HelperCard
                  key={helper.id}
                  helper={helper}
                  playerLevel={playerLevel}
                  playerRank={playerRank}
                  locationCurrency={locationCurrency}
                  helperLevels={helperLevels}
                  processingHelperId={processingHelperId}
                  onBuy={handleBuyHelper}
                  onUpgrade={handleUpgradeHelper}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Если компонент встроен в таб, отображаем только содержимое без модального окна
  if (embedded) {
    return <div>{officeContent}</div>;
  }

  // Полноэкранное модальное окно
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-md relative">
        {/* Крестик для закрытия */}
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        {/* Заголовок */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Офис</h2>
          <p className="text-gray-400 text-sm">Управление работниками всех локаций</p>
        </div>
        
        {officeContent}
      </div>
    </div>
  );
};

export default OfficeModal; 