# Cardholder Data Security Checklist (PCI-Aligned)

**Northwind Pay, Inc. — Synthetic sample document for demonstration purposes only.**
Control owner: Head of Information Security. Version 2.1. Effective 15 February 2026.

## 1. Scope of Cardholder Data

This checklist governs the handling of cardholder data (CHD) across all systems
that store, process, or transmit payment card information. The cardholder data
environment (CDE) comprises those systems and any system connected to them. Reducing
the size of the CDE is the single most effective way to reduce risk and audit scope.

## 2. Do Not Store What You Do Not Need

Sensitive authentication data — the full magnetic-stripe contents, the card
verification value (CVV/CVC), and the PIN — must never be stored after a transaction
is authorized, even if encrypted. The primary account number (PAN) may be stored only
when there is a documented business need, and when stored it must be rendered
unreadable.

## 3. Render the PAN Unreadable

Wherever the PAN is stored, it must be rendered unreadable using strong cryptography,
one-way hashing of the full PAN, truncation, or tokenization. When the PAN is
displayed, it must be masked so that no more than the first six and last four digits
are visible, unless a specific role has a documented need to see the full PAN.

## 4. Encrypt Data in Transit

Cardholder data transmitted across open or public networks must be encrypted using
strong, current TLS. Legacy protocols (SSL and early TLS) are prohibited. Certificates
must be valid and trusted, and the receiving endpoint must be authenticated before
any cardholder data is sent.

## 5. Access Control

Access to cardholder data is restricted on a strict need-to-know basis and least
privilege. Every user has a unique ID; shared or generic accounts are prohibited in
the CDE. Access to systems in the CDE requires multi-factor authentication. Access
rights are reviewed at least every six months and revoked immediately on role change
or termination.

## 6. Logging and Monitoring

All access to cardholder data and all administrative actions in the CDE are logged.
Logs are protected from alteration, retained for at least one year with at least three
months immediately available, and reviewed regularly for anomalies. Time
synchronization is enforced across logging systems.

## 7. Vulnerability Management

Systems in the CDE are patched for critical vulnerabilities within one month of
release. Anti-malware controls are deployed where applicable and kept current.
Internal and external vulnerability scans are run at least quarterly and after any
significant change, and findings are remediated and rescanned until passing.

## 8. Penetration Testing

External and internal penetration tests are performed at least annually and after any
significant infrastructure or application change. Any exploitable findings are
remediated and the affected scope is retested. Segmentation controls that isolate the
CDE are tested to confirm they are effective.

## 9. Vendor and Service Provider Management

Service providers with access to cardholder data are subject to due diligence before
engagement and are monitored for ongoing compliance. Responsibilities for each PCI
control are documented in a written agreement so there is no ambiguity about which
party maintains which control.
