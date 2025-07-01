import React from 'react';

interface StorageButtonProps {
  onClick: () => void;
  activeTab: string;
}

const StorageButton: React.FC<StorageButtonProps> = ({ onClick, activeTab }) => {
  // Отображаем кнопку только на главном экране (когда activeTab === "tap")
  if (activeTab !== "tap") {
    return null;
  }
  
  return (
    <button
      className="fixed right-4 top-40 z-10 flex h-14 w-14 items-center justify-center bg-gray-800 bg-opacity-60 shadow-lg hover:bg-gray-700 rounded-lg"
      onClick={onClick}
      aria-label="Открыть склад"
    >
      <img
        src="/assets/icons/storage.png"
        alt="Склад"
        className="h-12 w-12"
        onError={(e) => {
          // Если иконка не найдена, показываем эмодзи вместо неё
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement!.innerHTML += '<span class="text-white text-xl">📦</span>';
        }}
      />
    </button>
  );
};

export default StorageButton; 