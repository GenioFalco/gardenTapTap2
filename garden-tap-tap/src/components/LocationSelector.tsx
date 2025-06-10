import React from 'react';
import { Location } from '../types';
import { motion } from 'framer-motion';

interface LocationSelectorProps {
  locations: Location[];
  unlockedLocations: number[];
  activeLocationId: number;
  onSelectLocation: (locationId: number) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  unlockedLocations,
  activeLocationId,
  onSelectLocation,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-800 bg-opacity-80 backdrop-blur-sm">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {locations.map((location) => {
          const isUnlocked = unlockedLocations.includes(location.id);
          const isActive = location.id === activeLocationId;
          
          return (
            <motion.div
              key={location.id}
              className={`location-button ${isActive ? 'ring-2 ring-white' : ''} 
                ${!isUnlocked ? 'opacity-50 grayscale' : ''}`}
              whileTap={{ scale: isUnlocked ? 0.95 : 1 }}
              onClick={() => isUnlocked && onSelectLocation(location.id)}
            >
              {!isUnlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 rounded-lg">
                  <span className="text-xs font-medium">{`Уровень ${location.unlockLevel}`}</span>
                </div>
              )}
              <span className="text-xs font-medium">{location.name}</span>
              <span className="text-[10px] opacity-75">{location.resourceName}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationSelector; 