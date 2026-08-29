'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveBuddiesScan } from '@/lib/scanner';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;
type NativeScannerBridge = {
  start?: () => void | Promise<void>;
  stop?: () => void | Promise<void>;
};
type ScannerWindow = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
  BuddiesNativeScanner?: NativeScannerBridge;
};
type NativeScanDetail = string | { rawValue?: string };
type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'unsupported' | 'denied' | 'error';

const DETECT_INTERVAL_MS = 180;

function statusMessage(status: ScannerStatus) {
  switch (status) {
    case 'requesting': return 'Requesting rear camera access…';
    case 'scanning': return 'Scanner active. Hold a Buddies dog tag inside the frame.';
    case 'unsupported': return 'Live QR detection is unavailable in this browser. Paste the Buddies QR URL below.';
    case 'denied': return 'Camera permission is blocked. Allow camera access for Buddies, then start the scanner again.';
    case 'error': return 'The scanner could not start. You can still paste a Buddies QR URL below.';
    default: return 'Start the scanner when you are ready.';
  }
}

export default function DogQrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const frameRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const detectionBusyRef = useRef(false);
  const lastDetectionRef = useRef(0);
  const nativeStartedRef = useRef(false);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [manualValue, setManualValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const stopScanner = useCallback(() => {
    generationRef.current += 1;
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    detectionBusyRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    const bridge = (window as ScannerWindow).BuddiesNativeScanner;
    if (nativeStartedRef.current && bridge?.stop) {
      void Promise.resolve(bridge.stop()).catch(() => undefined);
    }
    nativeStartedRef.current = false;
  }, []);

  const openScan = useCallback((rawValue: string) => {
    const target = resolveBuddiesScan(rawValue, window.location.origin);
    if (!target) {
      setErrorMessage('That code is not a recognized Buddies dog profile.');
      return false;
    }

    stopScanner();
    setErrorMessage('');
    router.push(target.path);
    return true;
  }, [router, stopScanner]);

  const beginFrameLoop = useCallback((generation: number) => {
    const tick = (time: number) => {
      if (generationRef.current !== generation) return;
      frameRef.current = requestAnimationFrame(tick);

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (detectionBusyRef.current || time - lastDetectionRef.current < DETECT_INTERVAL_MS) return;

      lastDetectionRef.current = time;
      detectionBusyRef.current = true;
      void detector.detect(video)
        .then((barcodes) => {
          if (generationRef.current !== generation) return;
          const rawValue = barcodes.find((barcode) => barcode.rawValue.trim())?.rawValue;
          if (rawValue) openScan(rawValue);
        })
        .catch(() => undefined)
        .finally(() => {
          if (generationRef.current === generation) detectionBusyRef.current = false;
        });
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [openScan]);

  const startScanner = useCallback(async () => {
    stopScanner();
    const generation = generationRef.current;
    setErrorMessage('');
    setStatus('requesting');

    const scannerWindow = window as ScannerWindow;
    const nativeBridge = scannerWindow.BuddiesNativeScanner;
    if (nativeBridge?.start) {
      nativeStartedRef.current = true;
      try {
        await nativeBridge.start();
        if (generationRef.current !== generation) {
          if (nativeBridge.stop) await nativeBridge.stop().catch(() => undefined);
          nativeStartedRef.current = false;
          return;
        }
        setStatus('scanning');
      } catch {
        nativeStartedRef.current = false;
        if (generationRef.current === generation) setStatus('error');
      }
      return;
    }

    const Detector = scannerWindow.BarcodeDetector;
    if (!Detector) {
      setStatus('unsupported');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }

    try {
      detectorRef.current = new Detector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setStatus('scanning');
      beginFrameLoop(generation);
    } catch (error) {
      if (generationRef.current !== generation) return;
      const denied = error instanceof DOMException
        && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setStatus(denied ? 'denied' : 'error');
    }
  }, [beginFrameLoop, stopScanner]);

  async function scanImage(file: File | null) {
    if (!file) return;
    const Detector = (window as ScannerWindow).BarcodeDetector;
    if (!Detector || typeof createImageBitmap !== 'function') {
      setErrorMessage('Image QR detection is unavailable in this browser.');
      return;
    }

    try {
      const detector = detectorRef.current ?? new Detector({ formats: ['qr_code'] });
      detectorRef.current = detector;
      const bitmap = await createImageBitmap(file);
      try {
        const result = await detector.detect(bitmap);
        const rawValue = result.find((barcode) => barcode.rawValue.trim())?.rawValue;
        if (!rawValue || !openScan(rawValue)) {
          setErrorMessage('No valid Buddies dog QR code was found in that image.');
        }
      } finally {
        bitmap.close();
      }
    } catch {
      setErrorMessage('The selected image could not be scanned.');
    }
  }

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!openScan(manualValue)) setErrorMessage('Enter a Buddies dog profile URL or dog slug.');
  }

  useEffect(() => {
    function handleNativeScan(event: Event) {
      const detail = (event as CustomEvent<NativeScanDetail>).detail;
      const rawValue = typeof detail === 'string' ? detail : detail?.rawValue;
      if (rawValue) openScan(rawValue);
    }

    window.addEventListener('buddies:native-scan', handleNativeScan);
    return () => {
      window.removeEventListener('buddies:native-scan', handleNativeScan);
      stopScanner();
    };
  }, [openScan, stopScanner]);

  return (
    <section className="grid gap-5" aria-labelledby="scanner-title">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Buddies identity scanner</p>
        <h1 id="scanner-title" className="mt-2 text-3xl font-black tracking-tight text-slate-950">Scan a dog tag</h1>
        <p className="mt-2 text-slate-600">Open a Buddies public dog profile from its QR identity. External QR destinations are rejected.</p>
      </div>

      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl border bg-slate-950 shadow-sm sm:aspect-video">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
          <div className="aspect-square w-full max-w-xs rounded-[2rem] border-4 border-white/90 shadow-[0_0_0_999px_rgba(2,6,23,0.32)]" />
        </div>
        {status !== 'scanning' ? (
          <div className="absolute inset-0 grid place-items-center bg-slate-950/75 p-6 text-center text-white">
            <p className="max-w-sm text-sm font-medium">{statusMessage(status)}</p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void startScanner()} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">
          {status === 'scanning' ? 'Restart scanner' : 'Start scanner'}
        </button>
        {status === 'scanning' ? (
          <button type="button" onClick={() => { stopScanner(); setStatus('idle'); }} className="rounded-xl border px-5 py-3 font-bold text-slate-800">
            Stop camera
          </button>
        ) : null}
        <label className="cursor-pointer rounded-xl border px-5 py-3 font-bold text-slate-800">
          Scan saved image
          <input type="file" accept="image/*" className="sr-only" onChange={(event) => void scanImage(event.target.files?.[0] ?? null)} />
        </label>
      </div>

      <form onSubmit={submitManual} className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm">
        <label htmlFor="manual-dog-code" className="text-sm font-bold text-slate-800">QR URL or dog slug</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="manual-dog-code"
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="https://buddies.vercel.app/dogs/..."
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3"
          />
          <button type="submit" className="rounded-xl border px-5 py-3 font-bold">Open profile</button>
        </div>
      </form>

      <p className={`min-h-6 text-sm ${errorMessage ? 'font-semibold text-red-700' : 'text-slate-500'}`} aria-live="polite">
        {errorMessage || statusMessage(status)}
      </p>
    </section>
  );
}
