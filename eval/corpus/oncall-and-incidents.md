# On-Call and Incident Response

Northwind Robotics runs a **weekly on-call rotation**. The handoff happens every
Monday at 10:00 a.m. Pacific, when the outgoing engineer briefs the incoming one
on open issues. Paging is handled through PagerDuty.

Incidents are classified by severity:

- **SEV1** — a customer-facing outage, such as a fulfillment center whose Draylin
  fleet has stopped moving inventory. The on-call engineer is paged within 5
  minutes and must acknowledge within a 15-minute SLA.
- **SEV2** — significant degradation that is not a full outage, for example
  elevated error rates or a single region affected. Response begins within 30
  minutes.
- **SEV3** — minor issues with a workaround available; these are handled during
  business hours.

Every SEV1 and SEV2 requires a **blameless postmortem**, published within 3
business days of the incident being resolved. The postmortem focuses on
contributing factors and follow-up actions, never on individual blame.

The on-call engineer is not expected to fix everything alone — escalation to the
owning team is encouraged, and a dedicated incident commander is assigned for any
SEV1 that runs longer than one hour.
