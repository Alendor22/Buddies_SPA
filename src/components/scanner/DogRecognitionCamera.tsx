'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CAMERA_SAMPLE_INTERVAL_MS,
  cameraErrorStatus,
  decideRecognition,
  shouldSampleFrame,
  type CameraRecognitionStatus,
  type RecognitionDecision,
} from '@/lib/doggy-recognition/camera';
import { recognizeDogImage } from '@/lib/doggy-recognition/client';

const FRAME_WIDTH = 768;
const JPEG_QUALITY = 0.82;

function statusCopy(status: CameraRecognitionStatus) {
  switch (status) {
    case 'requesting': return 'Opening rear camera…';
    case 'scanning': return 'Looking for a dog…';
    case 'processing': return 'Comparing visual identity…';
    case 'identified': return 'Dog recognized.';
    case 'confirm': return 'Possible match — confirmation recommended.';
    case 'unknown': return 'No confident Buddies match yet.';
    case 'denied': return 'Camera access is blocked. Allow camera access or upload a photo.';
    case 'unsupported': return 'Live camera is unavailable in this browser. Upload a dog photo instead.';
    case 'error': return 'Recognition is temporarily unavailable. You can retry or upload a photo.';
    default: return 'Point the camera at the dog to identify it.';
  }
}

async function videoFrameBlob(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) return null;
  const width = Math.min(FRAME_WIDTH, sourceWidth);
  const height = Math.round((sourceHeight / sourceWidth) * width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

export default function DogRecognitionCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastSampleRef = useRef(0);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<CameraRecognitionStatus>('idle');
  const [decision, setDecision] = useState<RecognitionDecision | null>(null);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    generationRef.current += 1;
    if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const recognizeBlob = useCallback(async (blob: Blob, generation: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('processing');
    try {
      const result = await recognizeDogImage(blob, controller.signal);
      if (generationRef.current !== generation) return;
      const next = decideRecognition(result.candidates);
      setDecision(next);
      setStatus(next.kind);
      setError('');
    } catch (cause) {
      if (controller.signal.aborted || generationRef.current !== generation) return;
      setError(cause instanceof Error ? cause.message : 'Recognition request failed.');
      setStatus('error');
    } finally {
      if (generationRef.current === generation) busyRef.current = false;
    }
  }, []);

  const beginLoop = useCallback((generation: number) => {
    const tick = async (now: number) => {
      if (generationRef.current !== generation) return;
      animationRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || !shouldSampleFrame({
        now,
        lastSampleAt: lastSampleRef.current,
        busy: busyRef.current,
        videoReady: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
        documentVisible: document.visibilityState === 'visible',
      })) return;
      lastSampleRef.current = now;
      const blob = await videoFrameBlob(video);
      if (!blob || generationRef.current !== generation) return;
      await recognizeBlob(blob, generation);
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [recognizeBlob]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const generation = generationRef.current;
    setDecision(null);
    setError('');
    setStatus('requesting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (generationRef.current !== generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (generationRef.current !== generation) return;
      setStatus('scanning');
      beginLoop(generation);
    } catch (cause) {
      if (generationRef.current === generation) {
        // A failed video.play() can happen after getUserMedia already opened the
        // camera. Release that stream before showing the fallback state.
        stopCamera();
        setStatus(cameraErrorStatus(cause));
      }
    }
  }, [beginLoop, stopCamera]);

  const uploadPhoto = useCallback(async (file: File | null) => {
    if (!file) return;
    stopCamera();
    const generation = generationRef.current;
    setDecision(null);
    setError('');
    await recognizeBlob(file, generation);
  }, [recognizeBlob, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const candidate = decision?.candidate;
  const confidence = candidate ? Math.round(candidate.confidence * 100) : null;

  return (
    <section className="grid gap-4" aria-labelledby="recognition-title">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Buddies Doggy Recognition</p>
        <h1 id="recognition-title" className="mt-1 text-3xl font-black tracking-tight text-slate-950">Identify a dog</h1>
        <p className="mt-2 text-slate-600">Point your camera at the dog. Visual identity is primary; tag scanning remains available as a secondary check.</p>
      </header>
      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-slate-950 shadow-sm sm:aspect-video">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-7"><div className="h-3/5 w-4/5 rounded-[2.5rem] border-2 border-white/80 shadow-[0_0_0_999px_rgba(2,6,23,0.18)]" /></div>
        <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-slate-950/75 p-4 text-white backdrop-blur">
          <div className="flex items-center justify-between gap-3"><p className="font-semibold">{statusCopy(status)}</p>{status === 'processing' ? <span className="animate-pulse text-sm">Analyzing</span> : null}</div>
          {candidate ? <div className="mt-2 flex items-center justify-between gap-3 text-sm"><span>{decision?.kind === 'identified' ? 'Match' : 'Candidate'}: {candidate.slug}</span><span>{confidence}%</span></div> : null}
        </div>
      </div>
      {candidate && decision?.kind === 'identified' ? <Link href={`/dogs/${encodeURIComponent(candidate.slug)}`} className="rounded-xl bg-slate-950 px-5 py-3 text-center font-bold text-white">View recognized dog</Link> : null}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <button type="button" onClick={() => void startCamera()} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">Start camera</button>
        <label className="cursor-pointer rounded-xl border bg-white px-5 py-3 text-center font-bold text-slate-800">Upload dog photo<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void uploadPhoto(event.target.files?.[0] ?? null)} /></label>
        <Link href="/scanner/tag" className="col-span-2 rounded-xl border bg-white px-5 py-3 text-center font-bold text-slate-700">Scan tag instead</Link>
      </div>
      <p className={`min-h-6 text-sm ${error ? 'font-semibold text-red-700' : 'text-slate-500'}`} aria-live="polite">{error || `Live recognition samples at a controlled interval (~${CAMERA_SAMPLE_INTERVAL_MS} ms) to keep the camera responsive.`}</p>
    </section>
  );
}
