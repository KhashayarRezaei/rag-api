# Security and Access Control

Northwind Robotics stores application secrets in **HashiCorp Vault**. Secrets are
**rotated every 90 days**, and no plaintext credentials are allowed in source
control — a pre-commit hook and a CI scan both reject them.

Employee access to internal systems is gated by **single sign-on through Okta**,
and **multi-factor authentication is required** for every account. There are no
shared logins; each engineer authenticates as themselves so that access can be
audited.

Access follows the principle of **least privilege**: engineers are granted only
the permissions their role needs, and broad production access is time-boxed and
must be requested through a ticket. **Access reviews are conducted quarterly**,
during which managers confirm that each person still needs the access they hold.

All company laptops are encrypted with full-disk encryption (FileVault on macOS),
and a lost or stolen device can be remotely wiped. Production servers accept SSH
only over the company VPN, never from the public internet.
