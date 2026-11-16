import React from 'react';
import { useImageStore } from '../../store/useImageStore';

interface AdSlotProps {
  position: 'left' | 'right' | 'inline';
  className?: string;
}

/**
 * AdSlot Component:
 * - Free users: renders a clean container (hidden on mobile/small screens < xl)
 * - Pro users: renders null (completely removed from DOM)
 * - Ready for Google AdSense or advertising script integration
 */
export const AdSlot: React.FC<AdSlotProps> = ({ position, className = '' }) => {
  const isPro = useImageStore((s) => s.isPro);

  // If user is on Pro plan, do not render any ad container
  if (isPro) {
    return null;
  }

  // Side ads: hidden on mobile & tablets, visible on large screens
  return (
    <aside
      aria-label="Advertisement"
      className={`hidden xl:flex flex-col items-center justify-center shrink-0 w-40 min-h-[600px] bg-slate-50 dark:bg-slate-900/40 rounded-xl transition-all ${className}`}
    >
      {/* 
        ============================================================
        PASTE YOUR GOOGLE ADSENSE CODE HERE:
        Example:
        <ins className="adsbygoogle"
             style={{ display: 'block', width: '160px', height: '600px' }}
             data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
             data-ad-slot="XXXXXXXXXX"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        ============================================================
      */}
      <div className="w-full h-full pointer-events-none" />
    </aside>
  );
};
