import { fireEvent, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { GRADE_MISMATCH_MESSAGE } from '../domain/grades';
import { renderAt } from './render';

const demo = buildDemoData('2026-09-26');

test('pipe tally shows footage totals and adds a joint', () => {
  renderAt(demo, '/tally');
  expect(screen.getByRole('heading', { name: 'Pipe tally' })).toBeInTheDocument();
  expect(screen.getByTestId('tally-joint-count')).toHaveTextContent('4');
  expect(screen.getByTestId('tally-total-footage')).toHaveTextContent('159.625 ft');
  expect(screen.getByTestId('tally-average-length')).toHaveTextContent('39.906 ft');
  expect(screen.getByTestId('tally-expected-footage')).toHaveTextContent('200.000 ft');
  expect(screen.getByTestId('tally-footage-difference')).toHaveTextContent('-40.375 ft');
  expect(screen.getByRole('heading', { name: 'Footage by heat' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export Excel' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Joint number'), { target: { value: 'J-2000' } });
  fireEvent.change(screen.getByLabelText('Heat'), { target: { value: 'H52-18440' } });
  fireEvent.change(screen.getByLabelText(/^Length ft/), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add joint' }));
  expect(screen.getByText('J-2000 added. REVIEW REQUIRED.')).toBeInTheDocument();
  expect(screen.getByTestId('tally-joint-count')).toHaveTextContent('5');
  expect(screen.getByTestId('tally-total-footage')).toHaveTextContent('199.625 ft');
});

test('fitting form flags WPHY 52 against WPHY 70 and clears when they match', () => {
  const fitting = demo.fittings.find((item) => item.materialCode === 'PMI-FIT-000004');
  renderAt(demo, `/fittings/${fitting?.id}`);
  expect(screen.getByTestId('grade-mismatch')).toHaveTextContent(GRADE_MISMATCH_MESSAGE);
  expect(screen.getByText('REVIEW REQUIRED')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Received grade/), { target: { value: 'WPHY 52' } });
  expect(screen.queryByTestId('grade-mismatch')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^Received grade/), { target: { value: 'WPHY 70' } });
  expect(screen.getByTestId('grade-mismatch')).toHaveTextContent(GRADE_MISMATCH_MESSAGE);
  fireEvent.click(screen.getByRole('button', { name: 'Save fitting' }));
  expect(screen.getByText('Saved on this device. REVIEW REQUIRED.')).toBeInTheDocument();
  expect(screen.getByTestId('grade-mismatch')).toBeInTheDocument();
});

test('flange form lists classes 150 through 1500', () => {
  renderAt(demo, '/flanges/new');
  const labels = screen.getAllByRole('option').map((option) => option.textContent);
  for (const rating of ['Class 150', 'Class 300', 'Class 400', 'Class 600', 'Class 900', 'Class 1500']) {
    expect(labels).toContain(rating);
  }
});

test('valve form shows the linked actuator', () => {
  const valve = demo.valves.find((item) => item.materialCode === 'PMI-VLV-000001');
  renderAt(demo, `/valves/${valve?.id}`);
  expect(screen.getByLabelText('Actuator serial')).toHaveValue('ACT-88321');
  expect(screen.getByText('Actuator linked')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save valve' })).toBeInTheDocument();
});
