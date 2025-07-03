import React, { useEffect, useState } from 'react';
import * as api from '../lib/api';

// Интерфейс для задания
interface Task {
  id: number;
  description: string;
  taskType: string;
  targetValue: number;
  seasonPoints: number;
  exp: number;
  coins: number;
  progress?: number;
  completed?: boolean;
  rewardClaimed?: boolean;
}

// Свойства модального окна заданий
interface TasksModalProps {
  show: boolean;
  onClose: () => void;
  userId: string;
}

const TasksModal: React.FC<TasksModalProps> = ({ show, onClose, userId }) => {
  const [activeTab, setActiveTab] = useState<'season' | 'daily'>('season');
  const [seasonTasks, setSeasonTasks] = useState<Task[]>([]);
  const [dailyTasks, setDailyTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingTaskId, setClaimingTaskId] = useState<number | null>(null);

  // Загрузка заданий
  useEffect(() => {
    if (show) {
      loadTasks();
    }
  }, [show, activeTab]);

  // Функция загрузки заданий
  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Сначала проверяем и обновляем прогресс всех типов заданий
      try {
        await api.checkAllTasksProgress(userId);
      } catch (checkError) {
        console.error('Ошибка при проверке прогресса заданий:', checkError);
        // Продолжаем загрузку заданий, даже если проверка не удалась
      }
      
      // Получаем активные задания в зависимости от выбранной вкладки
      if (activeTab === 'season') {
        const response = await api.getSeasonTasks(userId);
        setSeasonTasks(response.tasks || []);
      } else {
        const response = await api.getDailyTasks(userId);
        setDailyTasks(response.tasks || []);
      }
    } catch (err) {
      console.error('Ошибка при загрузке заданий:', err);
      setError('Не удалось загрузить задания. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  // Функция для получения награды
  const claimReward = async (taskId: number, isSeasonTask: boolean) => {
    try {
      setClaimingTaskId(taskId);
      const response = await api.claimTaskReward(userId, taskId, isSeasonTask ? 'season' : 'daily');
      
      if (response.success) {
        // Обновляем состояние заданий после получения награды
        if (isSeasonTask) {
          setSeasonTasks(seasonTasks.map(task => 
            task.id === taskId 
              ? { ...task, rewardClaimed: true } 
              : task
          ));
        } else {
          setDailyTasks(dailyTasks.map(task => 
            task.id === taskId 
              ? { ...task, rewardClaimed: true } 
              : task
          ));
        }
      } else {
        setError('Не удалось получить награду');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Ошибка при получении награды:', err);
      setError('Произошла ошибка. Попробуйте позже.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setClaimingTaskId(null);
    }
  };

  // Отрисовка карточки задания
  const renderTaskCard = (task: Task, isSeasonTask: boolean) => {
    // Процент выполнения
    const progressPercent = task.progress && task.targetValue 
      ? Math.min((task.progress / task.targetValue) * 100, 100) 
      : 0;

    // Статус задания
    let status = 'В процессе';
    if (task.rewardClaimed) status = 'Награда получена';
    else if (task.completed) status = 'Выполнено';

    return (
      <div 
        key={task.id} 
        className="bg-gray-800 rounded-lg p-4 mb-4 shadow-lg border border-gray-700"
      >
        <h3 className="text-white text-lg font-semibold mb-2">{task.description}</h3>
        
        <div className="text-gray-300 text-sm mb-3">
          Цель: {task.progress || 0}/{task.targetValue} {
            task.taskType === 'taps' || task.taskType === 'daily_taps' || task.taskType === 'tap' 
              ? 'тапов' 
              : task.taskType === 'resources' || task.taskType === 'daily_resources' || task.taskType === 'collect_currency' 
                ? 'ресурсов' 
                : task.taskType === 'energy' || task.taskType === 'daily_energy' || task.taskType === 'spend_energy'
                  ? 'единиц энергии'
                  : task.taskType === 'unlock_tool'
                    ? 'инструментов'
                    : task.taskType === 'upgrade_helpers'
                      ? 'улучшений'
                      : task.taskType === 'level_up'
                        ? 'уровней'
                        : task.taskType === 'unlock_location'
                          ? 'локаций'
                          : task.taskType === 'complete_dailies'
                            ? 'заданий'
                            : task.taskType === 'earn_exp_season'
                              ? 'опыта'
                              : 'единиц'
          }
        </div>
        
        {/* Прогресс-бар */}
        <div className="w-full bg-gray-700 h-2 rounded-full mb-3">
          <div 
            className="bg-blue-500 h-2 rounded-full" 
            style={{ width: `${progressPercent}%` }} 
          ></div>
        </div>
        
        {/* Награды */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <img src="/assets/currencies/garden_coin.png" alt="Монеты" className="w-5 h-5 mr-1" />
              <span className="text-yellow-400">{task.coins}</span>
            </div>
            
            <div className="flex items-center">
              <span className="text-blue-400 mr-1">XP:</span>
              <span className="text-white">{task.exp}</span>
            </div>
            
            {isSeasonTask && (
              <div className="flex items-center">
                <span className="text-purple-400 mr-1">Очки:</span>
                <span className="text-white">{task.seasonPoints}</span>
              </div>
            )}
          </div>
          
          {/* Статус или кнопка */}
          {task.completed && !task.rewardClaimed ? (
            <button
              onClick={() => claimReward(task.id, isSeasonTask)}
              className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-sm"
              disabled={claimingTaskId === task.id}
            >
              {claimingTaskId === task.id ? 'Получение...' : 'Забрать'}
            </button>
          ) : (
            task.rewardClaimed ? (
              <div className="flex items-center text-green-400">
                <img src="/assets/icons/galochka.png" alt="Получено" className="w-6 h-6 mr-1" />
                <span>Получено</span>
              </div>
            ) : (
              <span className="text-yellow-500 text-sm">{status}</span>
            )
          )}
        </div>
      </div>
    );
  };

  // Если не нужно показывать модальное окно
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Заголовок с кнопкой закрытия */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Задания</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        {/* Табы */}
        <div className="flex border-b border-gray-700">
          <button 
            className={`flex-1 py-2 text-center ${activeTab === 'season' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('season')}
          >
            Сезонные задания
          </button>
          <button 
            className={`flex-1 py-2 text-center ${activeTab === 'daily' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}
            onClick={() => setActiveTab('daily')}
          >
            Ежедневные задания
          </button>
        </div>
        
        {/* Содержимое */}
        <div className="p-4 overflow-y-auto flex-grow">
          {/* Сообщение об ошибке */}
          {error && (
            <div className="bg-red-500 text-white p-2 mb-4 rounded text-center">
              {error}
            </div>
          )}
          
          {/* Индикатор загрузки */}
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
              <p className="text-gray-400 mt-2">Загрузка заданий...</p>
            </div>
          ) : (
            /* Отображение заданий в зависимости от активной вкладки */
            <>
              {activeTab === 'season' ? (
                seasonTasks.length > 0 ? (
                  seasonTasks.map(task => renderTaskCard(task, true))
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    Нет активных сезонных заданий
                  </p>
                )
              ) : (
                dailyTasks.length > 0 ? (
                  dailyTasks.map(task => renderTaskCard(task, false))
                ) : (
                  <p className="text-gray-400 text-center py-8">
                    Нет активных ежедневных заданий
                  </p>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasksModal; 