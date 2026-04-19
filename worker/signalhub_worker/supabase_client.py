"""Singleton Supabase client using the service-role key (bypasses RLS).

Never expose this key to the dashboard / browser code. It must only ever live
on the worker machine.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from .config import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
