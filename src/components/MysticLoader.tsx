import React from 'react';
import { motion } from 'motion/react';

export const MysticLoader: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="loading-animation flex flex-col items-center justify-center space-y-8 py-12 w-full">
      {/* Container for the crystal/symbol */}
      <div className="relative w-32 h-32 flex items-center justify-center perspective-[1000px]">
        {/* Outer glowing ring */}
        <motion.div
          animate={{ rotateX: 360, rotateY: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-4 border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.2)]"
          style={{ transformStyle: 'preserve-3d' }}
        />
        
        {/* Inner reverse spinning ring */}
        <motion.div
          animate={{ rotateX: -360, rotateZ: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-4 rounded-full border border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          style={{ transformStyle: 'preserve-3d' }}
        />

        {/* The Crystal Centerpiece */}
        <motion.div
          animate={{ 
            y: [-10, 10, -10],
            rotateY: [0, 180, 360],
            scale: [0.9, 1.1, 0.9]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="w-12 h-16 bg-gradient-to-br from-yellow-300 via-yellow-600 to-purple-800 rounded-t-full rounded-b-md shadow-[0_0_40px_rgba(234,179,8,0.6)] backdrop-blur-md opacity-90 border border-yellow-200/50"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
          }}
        />

        {/* Small orbiting particles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 3, 
              delay: i, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute inset-0 z-20"
          >
            <div className="w-2 h-2 bg-purple-300 rounded-full blur-[1px] absolute -top-1 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#d8b4fe]" />
          </motion.div>
        ))}
      </div>

      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="text-center"
      >
        <h3 className="text-xl md:text-2xl font-light text-white tracking-widest uppercase font-sans mb-3">
          {text}
        </h3>
        <div className="flex items-center justify-center gap-2">
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-ping" />
          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
        </div>
      </motion.div>
    </div>
  );
};
