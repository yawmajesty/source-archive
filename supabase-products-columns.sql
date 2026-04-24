-- Run this in Supabase SQL Editor to add missing columns to products table
-- These are required for image and document persistence

alter table public.products
  add column if not exists images jsonb default '[]'::jsonb,
  add column if not exists documents jsonb default '[]'::jsonb;
