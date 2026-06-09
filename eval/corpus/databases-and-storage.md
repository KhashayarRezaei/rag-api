# Databases and Storage

The primary datastore at Northwind Robotics is **PostgreSQL 16**. Most services
share a single logical database with per-service schemas, and the team treats
Postgres as the default home for data unless there is a strong reason otherwise.

For similarity search over maintenance logs and support tickets, the Platform
group uses the **pgvector** extension rather than running a separate vector
database. Keeping vectors in Postgres means the same backups, access controls,
and operational tooling apply, which the team considers a deliberate
simplification.

Backups run nightly at **02:00 UTC** and are retained for **30 days**. A full
restore is rehearsed once per quarter so that the recovery procedure is never
untested.

The primary database has **two read replicas**, used for analytics and for
serving heavy read-only dashboards without affecting write traffic. Application
connections go through **PgBouncer** for connection pooling, which keeps the
number of direct Postgres connections low even with many service instances.
