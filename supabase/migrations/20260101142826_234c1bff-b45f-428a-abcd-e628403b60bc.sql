-- Create role enum
create type public.app_role as enum ('tenant', 'property_manager');

-- Create application status enum
create type public.application_status as enum ('pending', 'under_review', 'approved', 'rejected');

-- Create lease status enum
create type public.lease_status as enum ('draft', 'pending_tenant_signature', 'pending_manager_signature', 'completed', 'expired');

-- Create property status enum
create type public.property_status as enum ('available', 'occupied', 'off_market');

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- User roles table (separate from profiles for security)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  role app_role not null,
  created_at timestamp with time zone default now() not null,
  unique (user_id, role)
);

-- Properties table
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references auth.users on delete cascade not null,
  address text not null,
  city text not null,
  state text not null,
  zip_code text not null,
  rent_amount numeric(10,2) not null,
  bedrooms integer not null default 1,
  bathrooms numeric(3,1) not null default 1,
  square_feet integer,
  description text,
  amenities text[],
  photos text[],
  status property_status not null default 'available',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Applications table
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties on delete cascade not null,
  applicant_id uuid references auth.users on delete cascade not null,
  status application_status not null default 'pending',
  personal_info jsonb not null default '{}',
  employment_info jsonb not null default '{}',
  background_check_consent boolean not null default false,
  rejection_reason text,
  reviewed_by uuid references auth.users,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Tenants table (links approved tenants to properties)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  property_id uuid references public.properties on delete cascade not null,
  rent_amount numeric(10,2) not null,
  lease_start_date date,
  lease_end_date date,
  is_active boolean not null default true,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique (user_id, property_id)
);

-- Leases table
create table public.leases (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties on delete cascade not null,
  tenant_id uuid references auth.users on delete cascade not null,
  manager_id uuid references auth.users on delete cascade not null,
  status lease_status not null default 'draft',
  lease_document_url text,
  signed_document_url text,
  start_date date not null,
  end_date date not null,
  monthly_rent numeric(10,2) not null,
  security_deposit numeric(10,2),
  terms text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Signatures table
create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid references public.leases on delete cascade not null,
  signer_id uuid references auth.users on delete cascade not null,
  signature_data text not null,
  signature_type text not null default 'draw',
  hash_id text not null,
  ip_address text,
  signed_at timestamp with time zone default now() not null
);

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade not null,
  property_id uuid references public.properties on delete set null,
  subject text,
  content text not null,
  is_read boolean not null default false,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

-- Documents table (stores metadata, files in storage)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  application_id uuid references public.applications on delete cascade,
  lease_id uuid references public.leases on delete cascade,
  document_type text not null,
  file_name text not null,
  file_url text not null,
  file_size integer,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.properties enable row level security;
alter table public.applications enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.signatures enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;

-- Security definer function to check user role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Function to get user's role
create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = _user_id
  limit 1
$$;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Property managers can view tenant profiles"
  on public.profiles for select
  using (
    public.has_role(auth.uid(), 'property_manager') and
    exists (
      select 1 from public.tenants t
      join public.properties p on t.property_id = p.id
      where t.user_id = profiles.id and p.manager_id = auth.uid()
    )
  );

-- User roles policies
create policy "Users can view their own role"
  on public.user_roles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own role"
  on public.user_roles for insert
  with check (auth.uid() = user_id);

-- Properties policies
create policy "Anyone can view available properties"
  on public.properties for select
  using (status = 'available');

create policy "Property managers can view all their properties"
  on public.properties for select
  using (manager_id = auth.uid());

create policy "Property managers can insert properties"
  on public.properties for insert
  with check (manager_id = auth.uid() and public.has_role(auth.uid(), 'property_manager'));

create policy "Property managers can update their properties"
  on public.properties for update
  using (manager_id = auth.uid());

create policy "Property managers can delete their properties"
  on public.properties for delete
  using (manager_id = auth.uid());

create policy "Tenants can view their assigned properties"
  on public.properties for select
  using (
    exists (
      select 1 from public.tenants
      where property_id = properties.id and user_id = auth.uid() and is_active = true
    )
  );

-- Applications policies
create policy "Tenants can view their own applications"
  on public.applications for select
  using (applicant_id = auth.uid());

create policy "Tenants can create applications"
  on public.applications for insert
  with check (applicant_id = auth.uid() and public.has_role(auth.uid(), 'tenant'));

create policy "Tenants can update their pending applications"
  on public.applications for update
  using (applicant_id = auth.uid() and status = 'pending');

create policy "Property managers can view applications for their properties"
  on public.applications for select
  using (
    exists (
      select 1 from public.properties
      where id = applications.property_id and manager_id = auth.uid()
    )
  );

create policy "Property managers can update applications for their properties"
  on public.applications for update
  using (
    exists (
      select 1 from public.properties
      where id = applications.property_id and manager_id = auth.uid()
    )
  );

-- Tenants policies
create policy "Tenants can view their own tenant record"
  on public.tenants for select
  using (user_id = auth.uid());

create policy "Property managers can view tenants for their properties"
  on public.tenants for select
  using (
    exists (
      select 1 from public.properties
      where id = tenants.property_id and manager_id = auth.uid()
    )
  );

create policy "Property managers can manage tenants"
  on public.tenants for all
  using (
    exists (
      select 1 from public.properties
      where id = tenants.property_id and manager_id = auth.uid()
    )
  );

-- Leases policies
create policy "Users can view leases they are part of"
  on public.leases for select
  using (tenant_id = auth.uid() or manager_id = auth.uid());

create policy "Property managers can create leases"
  on public.leases for insert
  with check (manager_id = auth.uid() and public.has_role(auth.uid(), 'property_manager'));

create policy "Property managers can update their leases"
  on public.leases for update
  using (manager_id = auth.uid());

create policy "Tenants can update lease status for signing"
  on public.leases for update
  using (tenant_id = auth.uid() and status = 'pending_tenant_signature');

-- Signatures policies
create policy "Users can view signatures on their leases"
  on public.signatures for select
  using (
    exists (
      select 1 from public.leases
      where id = signatures.lease_id
      and (tenant_id = auth.uid() or manager_id = auth.uid())
    )
  );

create policy "Users can create their own signatures"
  on public.signatures for insert
  with check (signer_id = auth.uid());

-- Messages policies
create policy "Users can view their messages"
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "Users can send messages"
  on public.messages for insert
  with check (sender_id = auth.uid());

create policy "Recipients can update message read status"
  on public.messages for update
  using (recipient_id = auth.uid());

-- Documents policies
create policy "Users can view their own documents"
  on public.documents for select
  using (owner_id = auth.uid());

create policy "Users can upload their own documents"
  on public.documents for insert
  with check (owner_id = auth.uid());

create policy "Property managers can view documents for their applications"
  on public.documents for select
  using (
    exists (
      select 1 from public.applications a
      join public.properties p on a.property_id = p.id
      where a.id = documents.application_id and p.manager_id = auth.uid()
    )
  );

create policy "Users can view documents for their leases"
  on public.documents for select
  using (
    exists (
      select 1 from public.leases
      where id = documents.lease_id
      and (tenant_id = auth.uid() or manager_id = auth.uid())
    )
  );

-- Update timestamp function
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

create trigger update_properties_updated_at before update on public.properties
  for each row execute function public.update_updated_at_column();

create trigger update_applications_updated_at before update on public.applications
  for each row execute function public.update_updated_at_column();

create trigger update_tenants_updated_at before update on public.tenants
  for each row execute function public.update_updated_at_column();

create trigger update_leases_updated_at before update on public.leases
  for each row execute function public.update_updated_at_column();

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create storage buckets for documents and property photos
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
insert into storage.buckets (id, name, public) values ('property-photos', 'property-photos', true);
insert into storage.buckets (id, name, public) values ('signatures', 'signatures', false);

-- Storage policies for documents bucket
create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Property managers can view applicant documents"
  on storage.objects for select
  using (
    bucket_id = 'documents' and
    public.has_role(auth.uid(), 'property_manager')
  );

-- Storage policies for property photos bucket
create policy "Anyone can view property photos"
  on storage.objects for select
  using (bucket_id = 'property-photos');

create policy "Property managers can upload property photos"
  on storage.objects for insert
  with check (bucket_id = 'property-photos' and public.has_role(auth.uid(), 'property_manager'));

create policy "Property managers can delete their property photos"
  on storage.objects for delete
  using (bucket_id = 'property-photos' and public.has_role(auth.uid(), 'property_manager'));

-- Storage policies for signatures bucket
create policy "Users can upload their signatures"
  on storage.objects for insert
  with check (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view their own signatures"
  on storage.objects for select
  using (bucket_id = 'signatures' and auth.uid()::text = (storage.foldername(name))[1]);