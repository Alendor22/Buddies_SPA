// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DogRecognitionCamera from '@/components/scanner/DogRecognitionCamera';

vi.mock('@/lib/doggy-recognition/client', () => ({ recognizeDogImage: vi.fn() }));

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
});
