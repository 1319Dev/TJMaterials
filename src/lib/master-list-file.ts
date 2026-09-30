import { buildMasterListWorkbook } from '../domain/master-list';
import type { TrackerSheet } from '../domain/types';
import { downloadBytes } from './download';

export function downloadMasterList(tracker: TrackerSheet): void {
  downloadBytes(
    'Material-Handling-Tracking.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buildMasterListWorkbook(tracker),
  );
}
