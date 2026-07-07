create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type public.workspace_role as enum ('owner', 'staff');

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  status text not null,
  raw_text text not null,
  customer_name text not null default '',
  phone text not null default '',
  order_items text not null default '',
  quantity text not null default '',
  purpose text not null default '',
  fulfillment_type text not null default '',
  desired_date_time text not null default '',
  pickup_time text not null default '',
  address text not null default '',
  allergy_note text not null default '',
  options text not null default '',
  customer_request_note text not null default '',
  owner_memo text not null default '',
  parsed_date jsonb,
  menu_matches jsonb not null default '[]'::jsonb,
  quantity_candidates jsonb not null default '[]'::jsonb,
  manually_edited_fields jsonb not null default '[]'::jsonb,
  reparse_differences jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  review_reasons jsonb not null default '[]'::jsonb,
  warning_level text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table public.order_change_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  note text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, workspace_id) references public.orders(id, workspace_id) on delete cascade,
  unique (workspace_id, order_id)
);

create table public.order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id uuid not null,
  label text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, workspace_id) references public.orders(id, workspace_id) on delete cascade
);

create index orders_workspace_updated_idx on public.orders (workspace_id, updated_at desc);
create index orders_workspace_desired_idx on public.orders (workspace_id, desired_date_time);
create index order_change_requests_order_idx on public.order_change_requests (order_id, updated_at desc);
create index order_checklist_items_order_idx on public.order_checklist_items (order_id, created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger workspace_settings_set_updated_at
before update on public.workspace_settings
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger order_change_requests_set_updated_at
before update on public.order_change_requests
for each row execute function public.set_updated_at();

create trigger order_checklist_items_set_updated_at
before update on public.order_checklist_items
for each row execute function public.set_updated_at();

create or replace function public.prevent_orders_workspace_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'orders.workspace_id cannot be changed after insert';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_order_child_boundary_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception '%.workspace_id cannot be changed after insert', TG_TABLE_NAME;
  end if;

  if new.order_id is distinct from old.order_id then
    raise exception '%.order_id cannot be changed after insert', TG_TABLE_NAME;
  end if;

  return new;
end;
$$;

create trigger orders_prevent_workspace_change
before update on public.orders
for each row execute function public.prevent_orders_workspace_change();

create trigger order_change_requests_prevent_boundary_change
before update on public.order_change_requests
for each row execute function public.prevent_order_child_boundary_change();

create trigger order_checklist_items_prevent_boundary_change
before update on public.order_checklist_items
for each row execute function public.prevent_order_child_boundary_change();

create or replace function public.prevent_last_workspace_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  should_check boolean := false;
begin
  if TG_OP = 'DELETE' then
    should_check := old.role = 'owner';
  else
    should_check := old.role = 'owner'
      and (
        new.role <> 'owner'
      or new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
    );
  end if;

  if should_check then
    lock table public.workspace_members in share row exclusive mode;
  end if;

  if should_check
    and exists (
      select 1
      from public.workspaces w
      where w.id = old.workspace_id
    )
    and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = old.workspace_id
        and wm.role = 'owner'
        and wm.user_id <> old.user_id
    )
  then
    raise exception 'workspace_members cannot remove or demote the last owner of a workspace';
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger workspace_members_prevent_last_owner_update
before update on public.workspace_members
for each row execute function public.prevent_last_workspace_owner_removal();

create trigger workspace_members_prevent_last_owner_delete
before delete on public.workspace_members
for each row execute function public.prevent_last_workspace_owner_removal();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_change_requests enable row level security;
alter table public.order_checklist_items enable row level security;

create policy "Users can read their profile"
on public.profiles
for select
using (id = auth.uid());

create policy "Users can update their profile"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members can read workspaces"
on public.workspaces
for select
using (public.is_workspace_member(id));

create policy "Owners can update workspaces"
on public.workspaces
for update
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

create policy "Members can read workspace members"
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

create policy "Owners can manage workspace members"
on public.workspace_members
for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "Members can read workspace settings"
on public.workspace_settings
for select
using (public.is_workspace_member(workspace_id));

create policy "Owners can manage workspace settings"
on public.workspace_settings
for all
using (public.is_workspace_owner(workspace_id))
with check (public.is_workspace_owner(workspace_id));

create policy "Members can read orders"
on public.orders
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can insert orders"
on public.orders
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can update orders"
on public.orders
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Owners can delete orders"
on public.orders
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = orders.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);

create policy "Members can read change requests"
on public.order_change_requests
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_change_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can insert change requests"
on public.order_change_requests
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_change_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can update change requests"
on public.order_change_requests
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_change_requests.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_change_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can delete change requests"
on public.order_change_requests
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_change_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can read checklist items"
on public.order_checklist_items
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_checklist_items.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can insert checklist items"
on public.order_checklist_items
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_checklist_items.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Members can update checklist items"
on public.order_checklist_items
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_checklist_items.workspace_id
      and wm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_checklist_items.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "Owners can delete checklist items"
on public.order_checklist_items
for delete
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = order_checklist_items.workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  )
);
