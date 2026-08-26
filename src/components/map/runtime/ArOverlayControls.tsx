'use client';

import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

export default function ArOverlayControls() {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const opacity = useMapRuntimeStore((state) => state.arOverlayOpacity);
  const fieldOfView = useMapRuntimeStore((state) => state.arFieldOfViewDegrees);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const setOpacity = useMapRuntimeStore((state) => state.setArOverlayOpacity);
  const setFieldOfView = useMapRuntimeStore((state) => state.setArFieldOfViewDegrees);

  if (cameraMode !== 'ar') return null;

  return (
    <aside className="absolute right-3 top-[calc(env(safe-area-inset-top)+6.4rem)] z-40 w-40 rounded-2xl border border-white/20 bg-slate-950/60 p-3 text-white shadow-2xl backdrop-blur-xl" aria-label="AR calibration controls">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">AR Calibrate</span>
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black tabular-nums">{Math.round(bearing)}°</span>
      </div>

      <label className="mt-3 block text-[10px] font-bold text-white/75">
        Map blend <span className="float-right tabular-nums text-white">{Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min="15"
          max="85"
          step="1"
          value={Math.round(opacity * 100)}
          onChange={(event) => setOpacity(Number(event.target.value) / 100)}
          className="mt-1 w-full accent-sky-300"
          aria-label="AR map overlay opacity"
        />
      </label>

      <label className="mt-2 block text-[10px] font-bold text-white/75">
        Camera FOV <span className="float-right tabular-nums text-white">{Math.round(fieldOfView)}°</span>
        <input
          type="range"
          min="45"
          max="100"
          step="1"
          value={Math.round(fieldOfView)}
          onChange={(event) => setFieldOfView(Number(event.target.value))}
          className="mt-1 w-full accent-sky-300"
          aria-label="AR horizontal field of view"
        />
      </label>
    </aside>
  );
}
