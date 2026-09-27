import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { emptySnapshot } from '../domain/empty';
import { localIsoDate } from '../domain/dates';
import { requestCameraStub, requestGpsStub } from '../domain/permissions';
import { renderAt } from './render';

const demo = buildDemoData(localIsoDate());

test('home shows the project, queue state, and receive action', () => {
  renderAt(demo);
  expect(screen.getByRole('heading', { name: 'Northline Spread A' })).toBeInTheDocument();
  expect(screen.getByText('Northline Spread A')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /TODAY'S DELIVERIES/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /MATERIAL ON HOLD/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /MISSING MTRs/ })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'RECENT INSPECTIONS' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+ RECEIVE MATERIAL' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add to Home Screen' })).toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
});

test('receiving assigns the next pipe id and leaves the line in review', () => {
  renderAt(demo, '/receive');
  fireEvent.change(screen.getByLabelText('BOL #'), { target: { value: 'BOL-UI-1' } });
  fireEvent.change(screen.getByLabelText('Material Description'), {
    target: { value: '36" API 5L X52 PSL2 line pipe' },
  });
  fireEvent.change(screen.getByLabelText('Heat Number'), { target: { value: 'H52-20001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save delivery' }));
  expect(screen.getByText('PMI-PIPE-000006')).toBeInTheDocument();
  expect(screen.getByText('REVIEW REQUIRED')).toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
});

test('MTR request uses the spreadsheet labels and stays a local draft', () => {
  renderAt(demo, '/mtr-request');
  for (const label of [
    'Inspector Name',
    'Vendor',
    'Atmos Project #',
    'Sales Order# / Customer PO #',
    'Shipment # (MRC)',
    'Material Description',
    'Diameter',
    'Wall Thickness',
    'Grade',
    'Heat Number',
    'Manufacturer',
  ]) {
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save request on this device' }));
  expect(screen.getByText('Saved on this device. Not submitted.')).toBeInTheDocument();
});

test('search from the search tab finds a joint', () => {
  renderAt(demo, '/search');
  fireEvent.change(screen.getByLabelText(/Heat, joint, serial, PO, BOL, manufacturer, or Material ID/), {
    target: { value: 'J-1041' },
  });
  expect(screen.getByText('PMI-PIPE-000001')).toBeInTheDocument();
});

test('more page explains the Safari website install', () => {
  renderAt(demo, '/more');
  expect(screen.getByRole('heading', { name: 'Use it in the browser' })).toBeInTheDocument();
  expect(screen.getByText(/On iPhone, open/)).toBeInTheDocument();
  expect(screen.getByText(/no App Store listing/)).toBeInTheDocument();
  expect(screen.getByText(/GitHub Pages hosts this website/)).toBeInTheDocument();
});

test('outdoor theme is an explicit choice', () => {
  renderAt(demo, '/more');
  fireEvent.click(screen.getByRole('button', { name: 'Outdoor high-contrast' }));
  expect(document.documentElement.dataset.theme).toBe('outdoor');
});

test('a new project opens on the field home with no material', () => {
  renderAt(emptySnapshot());
  expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  expect(screen.getByText('No material received yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+ RECEIVE MATERIAL' })).toBeInTheDocument();
  expect(screen.queryByText('Northline Spread A')).not.toBeInTheDocument();
  expect(screen.queryByText('PMI-PIPE-000001')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Work on this device' })).not.toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
});

test('sample project is optional from More and returns to the field project', () => {
  renderAt(emptySnapshot(), '/');
  expect(screen.queryByText(/guest|demo materials|work on this device/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'More' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load sample project' }));
  expect(screen.getByText('Sample project.')).toBeInTheDocument();
  expect(screen.queryByText(/guest|demo materials|work on this device/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(screen.getByRole('heading', { name: 'Northline Spread A' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'More' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to my project' }));
  fireEvent.click(screen.getByRole('link', { name: 'Home' }));
  expect(screen.getByRole('heading', { name: 'Project' })).toBeInTheDocument();
  expect(screen.queryByText('Northline Spread A')).not.toBeInTheDocument();
  expect(screen.queryByText('PMI-PIPE-000001')).not.toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
});

test('camera and GPS stubs do not invent a capture when the device API is missing', async () => {
  const camera = await requestCameraStub(new Date('2026-09-26T18:00:00.000Z'));
  const gps = await requestGpsStub(new Date('2026-09-26T18:00:00.000Z'));
  expect(camera.status).toBe('unavailable');
  expect(camera.message).toMatch(/No photo was stored/);
  expect(gps.status).toBe('unavailable');
  expect(gps.latitude).toBeNull();
  expect(gps.longitude).toBeNull();
});
