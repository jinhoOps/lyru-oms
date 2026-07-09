import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrations = readdirSync('supabase/migrations')
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, 'utf8'))
  .join('\n');

describe('client-facing RPC migrations', () => {
  it('revokes default public execute privileges from security definer RPCs', () => {
    expect(migrations).toContain('revoke execute on function public.list_workspace_members(uuid) from public;');
    expect(migrations).toContain(
      'revoke execute on function public.upsert_workspace_member_by_email(uuid, text, public.workspace_role) from public;',
    );
    expect(migrations).toContain('revoke execute on function public.save_order_with_details(uuid, jsonb, jsonb) from public;');
    expect(migrations).toContain(
      'revoke execute on function public.list_latest_order_change_requests(uuid) from public;',
    );
  });
});
