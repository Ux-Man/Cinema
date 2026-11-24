import React, { useRef, useState } from 'react';
import { PersonStanding, Armchair } from 'lucide-react';
import { TRANSLATIONS } from '../data/cinemaData';
import { Language } from '../types/cinema';

interface VirtualJoystickProps {
  lang: Language;
  seated: boolean;
  onToggleSeated: (seated: boolean) => void;
  onMove: (x: number, y: number) => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  lang,
  seated,
  onToggleSeated,
  onMove,
}) => {
  const t = TRANSLATIONS[lang];
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const updateFromClient = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / maxR, -dy / maxR);
  };

  const reset = () => {
    activeRef.current = false;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="fixed bottom-24 start-5 z-20 flex flex-col items-start gap-2.5 pointer-events-auto">
      {/* Standing / Seated Eye Height Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-neutral-200 dark:border-white/15 bg-white/95 dark:bg-[#0b0c10]/90 text-xs">
        <button
          onClick={() => onToggleSeated(false)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
            !seated
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <PersonStanding className="w-3.5 h-3.5" />
          {t.standing}
        </button>
        <button
          onClick={() => onToggleSeated(true)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${
            seated
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-medium'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <Armchair className="w-3.5 h-3.5" />
          {t.seated}
        </button>
      </div>

      {/* Virtual Movement Pad */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          activeRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activeRef.current) updateFromClient(e.clientX, e.clientY);
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
        className="w-24 h-24 rounded-full border border-neutral-300 dark:border-white/20 bg-white/90 dark:bg-[#0b0c10]/85 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shadow-lg"
      >
        <div
          className="w-9 h-9 rounded-full bg-amber-500/90 border-2 border-white shadow-md transition-transform duration-75"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      <div className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-[#0b0c10]/85 border border-neutral-200 dark:border-white/10 text-[10px] text-neutral-600 dark:text-neutral-300">
        {t.walkHint}
      </div>
    </div>
  );
};
