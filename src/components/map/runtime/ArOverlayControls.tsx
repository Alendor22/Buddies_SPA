'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapRuntimeStore } from '@/stores/useMapRuntimeStore';

const AUTO_HIDE_MS = 5_000;

export default function ArOverlayControls() {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const opacity = useMapRuntimeStore((state) => state.arOverlayOpacity);
  const fieldOfView = useMapRuntimeStore((state) => state.arFieldOfViewDegrees);
  const bearing = useMapRuntimeStore((state) => state.bearing);
  const setOpacity = useMapRuntimeStore((state) => state.setArOverlayOpacity);
  const setFieldOfView = useMapRuntimeStore((state) => state.setArFieldOfViewDegrees);
  const panelRef = useRef<HTMLElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, AUTO_HIDE_MS);
  }, [clearHideTimer]);

  const showControls = useCallback(() => {
    setVisible(true);
  }, []);

  const hideControls = useCallback(() => {
    clearHideTimer();
    setVisible(false);
  }, [clearHideTimer]);

  useEffect(() => {
    if (cameraMode === 'ar') {
      setVisible(true);
      scheduleAutoHide();
      return;
    }

    clearHideTimer();
  }, [cameraMode, clearHideTimer, scheduleAutoHide]);

  useEffect(() => {
    if (cameraMode !== 'ar' || !visible) {
      clearHideTimer();
      return;
    }

    scheduleAutoHide();
    return clearHideTimer;
  }, [cameraMode, clearHideTimer, scheduleAutoHide, visible]);

  useEffect(() => {
    if (cameraMode !== 'ar' || !visible) return;

    function handleOutsidePointer(event: PointerEvent) {
      const panel = panelRef.current;
      const target = event.target;
      if (!panel || !(target instanceof Node) || panel.contains(target)) return;
      hideControls();
    }

    document.addEventListener('pointerdown', handleOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointer, true);
  }, [cameraMode, hideControls, visible]);

  if (cameraMode !== 'ar') return null;

  if (!visible) {
    return (
      <button
        type="button"
        onClick={showControls}
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+6.4rem)] z-40 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-slate-950/65 text-white shadow-2xl backdrop-blur-xl active:scale-95"
        aria-label="Show AR calibration controls"
        title="AR calibration"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      </button>
    );
  }

  return (
    <aside
      ref={panelRef}
      className="absolute right-3 top-[calc(env(safe-area-inset-top)+6.4rem)] z-40 w-40 rounded-2xl border border-white/20 bg-slate-950/60 p-3 text-white shadow-2xl backdrop-blur-xl"
      aria-label="AR calibration controls"
      onPointerDown={scheduleAutoHide}
      onKeyDown={scheduleAutoHide}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/65">AR Calibrate</span>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black tabular-nums">{Math.round(bearing)}°</span>
          <button
            type="button"
            onClick={hideControls}
            className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-xs font-black text-white/70 active:scale-95"
            aria-label="Hide AR calibration controls"
          >
            ×
          </button>
        </div>
      </div>

      <label className="mt-3 block text-[10px] font-bold text-white/75">
        Map blend <span className="float-right tabular-nums text-white">{Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min="15"
          max="85"
          step="1"
          value={Math.round(opacity * 100)}
          onChange={(event) => {
            setOpacity(Number(event.target.value) / 100);
            scheduleAutoHide();
          }}
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
          onChange={(event) => {
            setFieldOfView(Number(event.target.value));
            scheduleAutoHide();
          }}
          className="mt-1 w-full accent-sky-300"
          aria-label="AR horizontal field of view"
        />
      </label>

      <p className="mt-2 text-[9px] font-semibold leading-tight text-white/45">Tap outside to hide · auto-hides in 5s</p>
    </aside>
  );
}
