# SiteCore
Gold_Track e_Platform

## Changelog

- 2026-08-13: Unified `Request` workflow implemented — requests are now a central data object surfaced across role-specific dashboards (Site, Partner, Government, Processor, Admin).
- Added statuses: `Submitted` → `Under Review` → `Matched` → `In Progress` → `Completed`.
- Partner dashboard: filter by Region, Need, Priority, Status.
- Processor dashboard: surfaced Mercury-Free processing requests and added distance & commodity filters.
- Site UI: added priority selector for support requests.
 - 2026-08-13: Added onboarding flow: `Join SiteCore` entry, role selection, registration submission, and admin approvals for institutional accounts.
 - Introduced `users`, `organizations`, and `pendingApprovals` in local data for onboarding and verification.

## Supabase Integration

To enable remote sync with Supabase, follow these steps:

1. Create a Supabase project at https://app.supabase.com/ and note the `URL` and `anon` or `service_role` key.
2. In your Supabase SQL editor, create a simple table to store the full workspace payload:

```sql
create table sitecore_sync (
	id text primary key,
	payload jsonb,
	updated_at timestamptz default now()
);
```

3. Copy `js/supabase-config.example.js` to `js/supabase-config.js` and fill `window.SUPABASE_URL` and `window.SUPABASE_KEY`. Do NOT commit `js/supabase-config.js` to source control.

4. The app includes `js/supabase.js` which now supports per-entity push/pull helpers and authentication flows. Use the header buttons `Push to Supabase` and `Pull from Supabase` to sync data.

Per-entity sync

This project now supports syncing individual entities (tables) rather than a single JSON blob. Create tables in Supabase for each entity you want to sync. Example schemas:

```sql
create table sites (
	id text primary key,
	name text,
	region text,
	country text,
	payload jsonb,
	updated_at timestamptz default now()
);

create table supportRequests (
	id text primary key,
	siteId text,
	type text,
	label text,
	priority text,
	status text,
	payload jsonb,
	updated_at timestamptz default now()
);

create table users (
	id text primary key,
	email text,
	name text,
	role text,
	payload jsonb,
	updated_at timestamptz default now()
);

create table organizations (
	id text primary key,
	name text,
	verified boolean default false,
	payload jsonb,
	updated_at timestamptz default now()
);

-- Add other tables (communityReports, serviceProviders, developmentPartners, connections, notifications) with similar columns.
```

Usage notes:
- The client uses `upsert` to write records and relies on an `updated_at` timestamp for incremental pulls. Ensure `updated_at` is present and updated server-side (e.g., via triggers or default `now()` on update).
- For initial testing you can allow broad permissions; for production implement Row Level Security (RLS) and use the `service_role` key only on server-side.
- Authentication: `js/supabase.js` exposes helpers for email OTP sign-in and OAuth providers. After sign-in the app attempts to map the authenticated user to a `users` record and assign `state.role` accordingly.

### Authentication setup

1. Enable Email / OAuth provider(s) in your Supabase project (Authentication → Providers).
2. Create a `users` table (if you followed the earlier schema) and ensure it contains at least `id`, `email`, `role`, and `updated_at`.

Example `users` table SQL:

```sql
create table users (
	id text primary key,
	email text unique,
	name text,
	role text,
	payload jsonb,
	updated_at timestamptz default now()
);
```

3. The front-end uses Email OTP sign-in by prompting for an email and calling Supabase's `signInWithOtp`. After the user completes sign-in (via email link/OTP), the app's auth state listener pulls `users` from Supabase and maps the email to a local role.

Notes:
- For production, you should implement stronger onboarding and approval flows server-side and tie Supabase authentication to your user records securely. The current flow is intended for prototype / testing.
