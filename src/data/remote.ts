import type { RemoteDb } from '../domain/cloud-sync';
import type { SyncTable } from '../domain/rows';
import { getSupabase } from './supabase';

export function remoteDb(): RemoteDb | null {
  const client = getSupabase();
  if (!client) return null;
  return {
    async upsert(table, row) {
      const { error } = await client.from(table).upsert(row);
      return error ? error.message : null;
    },
    async listProjects() {
      const { data, error } = await client.from('projects').select('*');
      if (error) return { rows: [], error: error.message };
      return { rows: data ?? [], error: null };
    },
    async selectProject(projectId) {
      const { data, error } = await client.from('projects').select('*').eq('id', projectId).maybeSingle();
      if (error) return { row: null, error: error.message };
      return { row: data, error: null };
    },
    async selectChildren(table: SyncTable, projectId: string) {
      const { data, error } = await client.from(table).select('*').eq('project_id', projectId);
      if (error) return { rows: [], error: error.message };
      return { rows: data ?? [], error: null };
    },
    async selectAudits(projectId) {
      const { data, error } = await client.from('audit_logs').select('*').eq('project_id', projectId);
      if (error) return { rows: [], error: error.message };
      return { rows: data ?? [], error: null };
    },
  };
}
