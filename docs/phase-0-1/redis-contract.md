# Redis contract

PostgreSQL remains authoritative. Redis provides read-through caches, feature flags, UI preferences, counters, search cache, and distributed rate limits.

Rules: components never call Redis directly; keys are centralized; TTLs are explicit; Redis failure cannot corrupt authoritative state; invalidation follows successful database writes; PII is excluded from key names.
