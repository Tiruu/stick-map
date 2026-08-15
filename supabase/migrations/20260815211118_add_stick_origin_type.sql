alter table public.sticks
add column origin_type text
check (origin_type in ('seen', 'pasted'));