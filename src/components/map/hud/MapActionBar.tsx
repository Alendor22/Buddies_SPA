'use client';

import { useMapRuntimeStore, type MapCameraMode } from '@/stores/useMapRuntimeStore';

function dispatch(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

type DeviceOrientationConstructorWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent === 'undefined') return 'unavailable';
  const orientation = DeviceOrientationEvent as DeviceOrientationConstructorWithPermission;
  if (typeof orientation.requestPermission !== 'function') return 'granted';

  try {
    return await orientation.requestPermission();
  } catch {
    return 'denied';
  }
}

export default function MapActionBar() {
  const cameraMode = useMapRuntimeStore((state) => state.cameraMode);
  const setCameraMode = useMapRuntimeStore((state) => state.setCameraMode);

  function camera(mode: MapCameraMode) {
    setCameraMode(mode);
    window.dispatchEvent(new CustomEvent('buddies:map-camera-mode', { detail: mode }));
  }

  async function toggleAr() {
    if (cameraMode === 'ar') {
      window.dispatchEvent(new CustomEvent('buddies:ar-camera-stop'));
      camera('follow');
      return;
    }

    camera('ar');
    // Dispatch synchronously from the tap so iOS/Safari can associate the
    // getUserMedia request with a direct user gesture.
    window.dispatchEvent(new CustomEvent('buddies:ar-camera-request'));
    const permission = await requestOrientationPermission();
    window.dispatchEvent(new CustomEvent('buddies:ar-orientation-permission', { detail: permission }));
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 sm:inset-x-5">
      <div className="pointer-events-auto mx-auto flex max-w-xl items-center justify-between gap-2 rounded-3xl border border-white/30 bg-slate-950/60 p-2 text-white shadow-2xl backdrop-blur-2xl">
        <button type="button" onClick={() => dispatch('buddies:open-buddies')} className="grid min-h-12 min-w-12 place-items-center rounded-2xl px-2 text-xs font-bold active:bg-white/15" aria-label="Nearby Buddies"><span className="text-xl" aria-hidden="true">🐾</span><span>Buddy</span></button>
        <button type="button" onClick={() => dispatch('buddies:open-report')} className="grid min-h-12 min-w-12 place-items-center rounded-2xl px-2 text-xs font-bold active:bg-white/15" aria-label="Report dog-centric place or hazard"><span className="text-xl" aria-hidden="true">＋</span><span>Report</span></button>
        <button type="button" onClick={() => camera(cameraMode === 'follow' ? 'explore' : 'follow')} className="grid min-h-14 min-w-14 place-items-center rounded-full border border-white/30 bg-white/15 px-2 text-xs font-black active:scale-95" aria-label={cameraMode === 'follow' ? 'Explore map' : 'Recenter and follow'}><span className="text-2xl" aria-hidden="true">◎</span><span>{cameraMode === 'follow' ? 'Explore' : 'Follow'}</span></button>
        <button type="button" onClick={() => void toggleAr()} className={`grid min-h-12 min-w-12 place-items-center rounded-2xl px-2 text-xs font-bold active:bg-white/15 ${cameraMode === 'ar' ? 'bg-sky-400/25 ring-1 ring-sky-300/60' : ''}`} aria-pressed={cameraMode === 'ar'} aria-label="Toggle live camera augmented-reality map"><span className="text-xl" aria-hidden="true">◈</span><span>{cameraMode === 'ar' ? 'AR On' : 'AR'}</span></button>
        <button type="button" onClick={() => dispatch('buddies:open-dogid')} className="grid min-h-12 min-w-12 place-items-center rounded-2xl px-2 text-xs font-bold active:bg-white/15" aria-label="Open Buddies DogID badge"><span className="text-xl" aria-hidden="true">▣</span><span>DogID</span></button>
      </div>
    </div>
  );
}
