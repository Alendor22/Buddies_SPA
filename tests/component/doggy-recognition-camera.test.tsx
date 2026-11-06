// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DogRecognitionCamera from '@/components/scanner/DogRecognitionCamera';

vi.mock('@/lib/doggy-recognition/client', () => ({ recognizeDogImage: vi.fn() }));

afterEach(cleanup);

describe('DogRecognitionCamera', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });

  it('presents visual identification as the primary action', () => {
    render(<DogRecognitionCamera />);
    expect(screen.getByRole('heading', { name: /identify a dog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start camera/i })).toBeInTheDocument();
    expect(screen.getByText(/upload dog photo/i)).toBeInTheDocument();
  });

  it('keeps tag scanning secondary', () => {
    render(<DogRecognitionCamera />);
    const tag = screen.getByRole('link', { name: /scan tag instead/i });
    expect(tag).toHaveAttribute('href', '/scanner/tag');
  });

  it('falls back to photo upload when live camera APIs are unavailable', () => {
    render(<DogRecognitionCamera />);
    fireEvent.click(screen.getByRole('button', { name: /start camera/i }));
    expect(screen.getByText(/live camera is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/upload dog photo/i)).toBeInTheDocument();
  });

  it('releases the camera stream when video playback fails', async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException('Playback denied', 'NotAllowedError')),
    });

    render(<DogRecognitionCamera />);
    fireEvent.click(screen.getByRole('button', { name: /start camera/i }));

    await waitFor(() => expect(screen.getByText(/camera access is blocked/i)).toBeInTheDocument());
    expect(stop).toHaveBeenCalledOnce();
  });
});
