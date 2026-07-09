import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrations = readdirSync('supabase/migrations')
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readFileSync(`supabase/migrations/${fileName}`, 'utf8'))
  .join('\n');

describe('workspace admin RPC migration', () => {
  it('revokes default public execute privileges from account management RPCs', () => {
    expect(migrations).toContain('revoke execute on function public.list_workspace_members(uuid) from public;');
    expect(migrations).toContain(
      'revoke execute on function public.upsert_workspace_member_by_email(uuid, text, public.workspace_role) from public;',
    );
  });
});
