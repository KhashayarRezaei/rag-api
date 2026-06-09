# Deployment and Release Process

Northwind Robotics ships backend services using a **blue-green deployment**
strategy. A new version is brought up alongside the running one, and traffic is
shifted only after health checks pass.

Before a full rollout, every release goes through a **canary** stage: 5 percent
of traffic is routed to the new version for 30 minutes while error rates and
latency are watched. If the canary is healthy, the rollout proceeds to 100
percent.

Regular releases happen on Tuesdays and Thursdays. There is a **change freeze on
Fridays** and the day before any public holiday, because Field Reliability wants
no risky changes going out right before reduced-staffing windows.

If a deployment goes wrong, engineers roll back with the `nwctl rollback`
command, which repoints traffic to the previous blue-green slot. A rollback is
expected to complete within 5 minutes.

Feature flags are managed through an internal service called **Beacon**. New
functionality is merged behind a Beacon flag that defaults to off, then enabled
gradually per region. Flags are removed within two weeks of a feature reaching
full rollout to avoid accumulating dead configuration.
