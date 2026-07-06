/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface PhoneSimulatorProps {
  children: React.ReactNode;
}

export default function PhoneSimulator({ children }: PhoneSimulatorProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'م' : 'ص';
      hours = hours % 12 || 12;
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="phone-container" className="relative mx-auto select-none">
      {/* Phone Case Outer Border */}
      <div className="relative w-[390px] h-[844px] bg-slate-950 rounded-[55px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700">
        
        {/* Screen Bezel Glass */}
        <div className="relative w-full h-full bg-[#F1F5F9] rounded-[44px] overflow-hidden flex flex-col border border-slate-900 shadow-inner">
          
          {/* Dynamic Island / Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-full z-50 flex items-center justify-between px-3">
            {/* Front Camera Lens */}
            <div className="w-3.5 h-3.5 bg-slate-900 rounded-full border border-slate-800/50 flex items-center justify-center">
              <div className="w-1 h-1 bg-blue-950 rounded-full" />
            </div>
            {/* Speaker Grille */}
            <div className="w-12 h-1 bg-slate-800 rounded-full opacity-60" />
            {/* Sensor */}
            <div className="w-2 h-2 bg-slate-900 rounded-full" />
          </div>

          {/* Status Bar */}
          <div className="w-full h-11 bg-[#0E7569] text-white flex items-center justify-between px-6 pt-2 select-none z-40 text-xs font-sans tracking-tight">
            {/* Right side in Arabic RTL: Signal, Wi-Fi, Carrier (Wait, or the opposite? Let's check: in iOS Arabic RTL: Clock is on the right, icons on the left!) */}
            <div className="flex items-center gap-1.5 order-2">
              <span className="font-medium tracking-tight">{time}</span>
            </div>

            {/* Left side: Carrier name and phone indicators */}
            <div className="flex items-center gap-1.5 order-1">
              <span className="opacity-90 mr-1 text-[10px] font-semibold tracking-wide">Vodafone EG</span>
              <Signal className="w-3.5 h-3.5" strokeWidth={2.5} />
              <Wifi className="w-3.5 h-3.5" strokeWidth={2.5} />
              <div className="flex items-center gap-0.5">
                <span className="text-[9px] font-medium leading-none">٨٧٪</span>
                <Battery className="w-4 h-4 ml-0.5 rotate-180" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Inner Content Area */}
          <div className="flex-1 flex flex-col relative overflow-hidden bg-[#F1F5F9]">
            {children}
          </div>

          {/* iOS Bottom Home Indicator Pill */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-400 rounded-full z-50 opacity-40 hover:opacity-80 transition-opacity" />

        </div>

        {/* Physical Side Buttons (Simulated on outer case) */}
        {/* Volume Up */}
        <div className="absolute left-[-4px] top-40 w-1 h-14 bg-slate-800 rounded-r border-y border-r border-slate-700" />
        {/* Volume Down */}
        <div className="absolute left-[-4px] top-58 w-1 h-14 bg-slate-800 rounded-r border-y border-r border-slate-700" />
        {/* Ring/Silent Switch */}
        <div className="absolute left-[-4px] top-28 w-1 h-8 bg-slate-800 rounded-r border-y border-r border-slate-700" />
        {/* Power Button */}
        <div className="absolute right-[-4px] top-48 w-1 h-20 bg-slate-800 rounded-l border-y border-l border-slate-700" />

      </div>
    </div>
  );
}
