import React from 'react';
import { motion } from 'framer-motion';
import { CurrencyType, RewardType } from '../types';

interface Reward {
  id: number;
  level_id: number;
  reward_type: string;
  amount: number;
  target_id?: number;
  currency_id?: string;
}

interface LevelUpModalProps {
  level: number;
  rewards: Reward[];
  onClose: () => void;
  toolNames: Record<number, string>;
  locationNames: Record<number, string>;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({
  level,
  rewards,
  onClose,
  toolNames = {},
  locationNames = {}
}) => {
  // Получаем изображение для валюты по её типу
  const getCurrencyImage = (currencyType: string): string => {
    switch (currencyType.toLowerCase()) {
      case 'main':
        return '/assets/currencies/garden_coin.png';
      case 'forest':
        return '/assets/currencies/wood.png';
      case 'dirt':
        return '/assets/currencies/dirt.png';
      case 'weed':
        return '/assets/currencies/weed.png';
      default:
        return '/assets/currencies/default.png';
    }
  };

  // Получаем название для валюты по её типу
  const getCurrencyName = (currencyType: string): string => {
    switch (currencyType.toLowerCase()) {
      case 'main':
        return 'Сад-коины';
      case 'forest':
        return 'Дерево';
      case 'dirt':
        return 'Грязь';
      case 'weed':
        return 'Сорняки';
      default:
        return 'Ресурсы';
    }
  };

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-gray-800 rounded-xl p-5 m-4 w-full max-w-sm text-white"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Заголовок */}
        <div className="text-center mb-4">
          <h2 className="text-yellow-400 text-2xl font-bold">Новый уровень!</h2>
          <p className="text-xl">Вы достигли уровня {level}</p>
        </div>
        
        <div className="w-full h-px bg-gray-600 my-3"></div>

        {/* Список наград */}
        <div className="my-4">
          <h3 className="text-lg font-semibold mb-2">Ваши награды:</h3>
          <ul className="space-y-3">
            {rewards.map((reward, index) => {
              let content;
              
              if (reward.reward_type === RewardType.MAIN_CURRENCY || reward.reward_type === 'main_currency') {
                const currencyType = reward.currency_id || 'main';
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src={getCurrencyImage(currencyType)} 
                      alt="Валюта" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">{getCurrencyName(currencyType)}</span>
                      <span className="text-yellow-400 ml-2">+{reward.amount}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type === RewardType.LOCATION_CURRENCY || reward.reward_type === 'location_currency') {
                const currencyType = reward.currency_id || 'forest';
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src={getCurrencyImage(currencyType)} 
                      alt="Ресурсы" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">{getCurrencyName(currencyType)}</span>
                      <span className="text-yellow-400 ml-2">+{reward.amount}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type === RewardType.UNLOCK_TOOL || reward.reward_type === 'unlock_tool') {
                const toolName = reward.target_id ? toolNames[reward.target_id] || 'Инструмент' : 'Инструмент';
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src="/assets/tools/default.png" 
                      alt="Инструмент" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 150
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">Новый инструмент</span>
                      <span className="text-yellow-400 ml-2">{toolName}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type === RewardType.UNLOCK_LOCATION || reward.reward_type === 'unlock_location') {
                const locationName = reward.target_id ? locationNames[reward.target_id] || 'Локация' : 'Локация';
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src="/assets/backgrounds/location_icon.png" 
                      alt="Локация" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0, rotate: 45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.6, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 150
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">Новая локация</span>
                      <span className="text-yellow-400 ml-2">{locationName}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type === RewardType.ENERGY || reward.reward_type === 'energy') {
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src="/assets/ui/energy_icon.png" 
                      alt="Энергия" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">Макс. энергия</span>
                      <span className="text-yellow-400 ml-2">+{reward.amount}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type === 'currency') {
                // Универсальный тип для любой валюты с указанным currency_id
                const currencyType = reward.currency_id || 'main';
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src={getCurrencyImage(currencyType)} 
                      alt="Валюта" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">{getCurrencyName(currencyType)}</span>
                      <span className="text-yellow-400 ml-2">+{reward.amount}</span>
                    </motion.div>
                  </li>
                );
              } else if (reward.reward_type.endsWith('_currency')) {
                // Для специфических валют типа forest_currency, garden_currency и т.д.
                const currencyType = reward.reward_type.split('_')[0];
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.img 
                      src={getCurrencyImage(currencyType)} 
                      alt="Валюта" 
                      className="w-8 h-8 mr-3"
                      initial={{ scale: 0.8, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ 
                        duration: 0.5, 
                        delay: index * 0.1 + 0.2,
                        type: "spring",
                        stiffness: 200
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      <span className="font-medium">{getCurrencyName(currencyType)}</span>
                      <span className="text-yellow-400 ml-2">+{reward.amount}</span>
                    </motion.div>
                  </li>
                );
              } else {
                content = (
                  <li key={reward.id} className="flex items-center bg-gray-700 rounded-lg p-2">
                    <motion.div 
                      className="w-8 h-8 bg-blue-500 rounded-full mr-3"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.4, delay: index * 0.1 + 0.2 }}
                    />
                    <motion.span
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 + 0.4 }}
                    >
                      Неизвестная награда ({reward.reward_type})
                    </motion.span>
                  </li>
                );
              }
              
              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  {content}
                </motion.div>
              );
            })}
          </ul>
        </div>

        {/* Кнопка закрытия */}
        <div className="mt-4 text-center">
          <motion.button
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-6 rounded-full text-lg"
            onClick={onClose}
            whileTap={{ scale: 0.95 }}
          >
            Отлично!
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LevelUpModal; 