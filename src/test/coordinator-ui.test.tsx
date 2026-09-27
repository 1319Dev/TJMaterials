import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import * as XLSX from 'xlsx';
import { emptySnapshot } from '../domain/empty';
import { workbookToMatrix } from '../lib/spreadsheet';
import { parseTrackerMatrix } from '../domain/tracker';
import { renderAt } from './render';

function named() {
  const snapshot = emptySnapshot();
  snapshot.project.name = 'Laydown Yard';
  snapshot.project.projectNumber = 'PN-1';
  return snapshot;
}

test('home opens on the field project and offers daily receive', () => {
  renderAt(emptySnapshot());
  expect(screen.getByRole('link', { name: 'DAILY MATERIALS RECEIVE' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+ RECEIVE MATERIAL' })).toBeInTheDocument();
  expect(screen.queryByText('Northline Spread A')).not.toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
});

test('daily receive stays on the empty project and opens the receive form', () => {
  renderAt(named(), '/daily');
  expect(screen.getByRole('heading', { name: 'Daily materials receive' })).toBeInTheDocument();
  expect(screen.getByText('No deliveries logged for today.')).toBeInTheDocument();
  expect(screen.queryByText('Northline Spread A')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: "Log today's delivery" })).toHaveAttribute('href', expect.stringContaining('from=daily'));
});

test('the daily receive form keeps the receipt in review', () => {
  renderAt(named(), '/receive?from=daily');
  expect(screen.getByText(/Daily materials receive/)).toBeInTheDocument();
  expect(screen.getByText(/This receipt stays REVIEW REQUIRED/)).toBeInTheDocument();
});

test('tracking sheet upload previews rows and saves them without MATCH', async () => {
  const matrix = [
    ['Construction Order No', 'CO-1001', 'Project Number', 'PN-44'],
    ['Item', 'QTY', 'Size (Inches)', 'Description', 'Wall/SDR', 'Steel Grade', 'Manufacturer', 'Model Number', 'Serial/Lot/Heat #', 'ANSI/Pressure Rating'],
    ['1', '10', '12', 'Line pipe', '0.375', 'X52', 'ACME', 'LP-12', 'H99881', 'ANSI 600'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Tracker');
  const bytes = new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  expect(parseTrackerMatrix(workbookToMatrix(bytes)).rows[0]?.description).toBe('Line pipe');

  renderAt(named(), '/tracker');
  const file = new File([bytes], 'materials.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const input = screen.getByLabelText(/Upload tracking sheet/);
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  fireEvent.change(input);
  expect(await screen.findByText(/CO-1001/)).toBeInTheDocument();
  expect(screen.getAllByText('Line pipe').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save tracker on this device' }));
  expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument();
  expect(screen.getByText('NOT VERIFIED')).toBeInTheDocument();
  expect(screen.queryByText('MATCH')).not.toBeInTheDocument();
  expect(screen.getByTestId('sync-status')).toHaveTextContent('OFFLINE — SAVED LOCALLY');
});
