// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ArCameraPermissionHelp from '@/components/map/runtime/ArCameraPermissionHelp';

afterEach(cleanup);

describe('ArCameraPermissionHelp', () => {
  it('stays hidden while the camera is usable', () => {
    const { container } = render(<ArCameraPermissionHelp status="ready" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['denied', 'Camera access is blocked'],
    ['unavailable', 'requires a browser with getUserMedia support'],
    ['error', 'rear camera could not start']
  ] as const)('explains the %s state', (status, copy) => {
    render(<ArCameraPermissionHelp status={status} />);
    expect(screen.getByText(new RegExp(copy, 'i'))).toBeVisible();
  });
});
