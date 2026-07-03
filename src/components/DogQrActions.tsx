'use client';

import { useMemo, useState } from 'react';

type DogQrActionsProps = {
  dogName: string;
  publicUrl: string;
  svg: string;
};

function safeFileName(name: string, extension: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'dog';
  return `${base}-buddies-qr.${extension}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DogQrActions({ dogName, publicUrl, svg }: DogQrActionsProps) {
  const [message, setMessage] = useState('');
  const svgBlob = useMemo(() => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), [svg]);

  async function copyPublicUrl() {
    await navigator.clipboard.writeText(publicUrl);
    setMessage('Public URL copied.');
  }

  async function sharePublicUrl() {
    if (navigator.share) {
      await navigator.share({
        title: `${dogName} on Buddies`,
        text: `Open ${dogName}'s Buddies safety profile.`,
        url: publicUrl
      });
      return;
    }

    await copyPublicUrl();
  }

  function downloadSvg() {
    downloadBlob(svgBlob, safeFileName(dogName, 'svg'));
    setMessage('SVG download started.');
  }

  async function downloadPng() {
    const objectUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to render QR image.'));
      image.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      throw new Error('Canvas is not available.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);

    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage('PNG generation failed.');
        return;
      }

      downloadBlob(blob, safeFileName(dogName, 'png'));
      setMessage('PNG download started.');
    }, 'image/png');
  }

  function printQr() {
    window.print();
  }

  return (
    <div className="mt-6 grid gap-3 print:hidden">
      <a href={publicUrl} className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white">
        Open public page
      </a>
      <button type="button" onClick={sharePublicUrl} className="rounded-lg border px-4 py-3 text-center">
        Share profile
      </button>
      <button type="button" onClick={copyPublicUrl} className="rounded-lg border px-4 py-3 text-center">
        Copy public URL
      </button>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={downloadSvg} className="rounded-lg border px-4 py-3 text-center">
          Download SVG
        </button>
        <button type="button" onClick={downloadPng} className="rounded-lg border px-4 py-3 text-center">
          Download PNG
        </button>
        <button type="button" onClick={printQr} className="rounded-lg border px-4 py-3 text-center">
          Print
        </button>
      </div>
      {message ? <p className="text-center text-sm text-slate-500">{message}</p> : null}
    </div>
  );
}
