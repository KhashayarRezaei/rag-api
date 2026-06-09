# Telemetry Data Ingestion Pipeline

Every Draylin unit streams telemetry — battery level, position, motor
temperature, and error codes — back to the Platform group's ingestion pipeline.
The pipeline is built around a job queue named **Conveyor**.

Incoming telemetry batches are written as jobs onto Conveyor, and a pool of
worker processes consumes them. At peak, the pipeline handles roughly **12,000
events per second** across the global fleet.

Reliability is handled with retries. A job that fails is **retried up to 3
times** with exponential backoff between attempts. If it still fails after the
third attempt, it is moved to a **dead-letter queue** for manual inspection
rather than being silently dropped.

Processed telemetry is stored in **TimescaleDB**, a time-series extension of
Postgres, which lets the team run efficient time-bucketed queries over months of
fleet history. Raw payloads are kept for 90 days; downsampled rollups are kept
for two years.

Workers claim jobs using Postgres row locking so that multiple workers never
process the same job. This keeps the pipeline horizontally scalable: adding more
worker processes increases throughput without any coordination service.
