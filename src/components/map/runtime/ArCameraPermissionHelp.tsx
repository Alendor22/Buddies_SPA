'use client';

import type { ArCameraStatus } from './arTypes';

export default function ArCameraPermissionHelp({ status }: { status: ArCameraStatus }) {
  if (status !== 'denied' && status !== 'unavailable' && status !== 'error') return null;

  return (
    <div className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-40 mx-auto max-w-md rounded-2xl border border-red-300/40 bg-red-950/80 p-3 text-center text-xs font-semibold text-red-50 shadow-2xl backdrop-blur-xl">
      {status === 'denied'
        ? 'Camera access is blocked. Allow camera permission for Buddies in your browser/site settings, then tap AR again.'
        : status === 'unavailable'
          ? 'Camera AR requires a browser with getUserMedia support over HTTPS.'
          : 'The rear camera could not start. Close other camera apps and tap AR again.'}
    </div>
  );
}
