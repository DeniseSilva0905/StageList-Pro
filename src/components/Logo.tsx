import React from 'react';

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      {/* Brand Text Columns */}
      <div className="flex flex-col select-none">
        <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none flex items-baseline">
          <span className="text-foreground -tracking-wide font-extrabold">StageList</span>
          <span className="ml-1 text-red-500 text-[18px] md:text-[20px] font-extrabold italic drop-shadow-[0_0_12px_rgba(239,68,68,0.55)]">Pro</span>
        </h1>
        <p className="text-[7.5px] font-bold tracking-[0.24em] uppercase text-muted-foreground leading-none mt-1.5 whitespace-nowrap opacity-85">
          YOUR LYRICS, ON STAGE.
        </p>
      </div>
    </div>
  );
}

