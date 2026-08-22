# Source License Agreement — Aether AR (Hardened Commercial Edition)

> **IMPORTANT NOTICE:**
> This document specifies the binding commercial and technical terms under which the Aether AR source code is licensed for deployment.

---

## 1. Grant of License
Licensor ("Vendor") grants Licensee ("Client") a **non-exclusive, non-transferable, single-tenant, single-domain** license to install, operate, and customize the Aether AR client application on infrastructure controlled by the Client, strictly subject to the technical and operational terms herein.

## 2. Technical Scope & Infrastructure Boundaries
1. **Registered Domain**: The software may only be hosted on the single production domain specified in the Order Schedule (e.g. `ar.clientstudio.com`). All requests originating from unauthorized domains or reverse proxies are denied media access.
2. **Device Slots**: Standard licensing permits simultaneous activation on up to **one (1) mobile device** and **one (1) desktop workstation**. Devices may be self-released with a mandatory **12-hour cooldown period**.
3. **Private Media Gating**: Client agrees that all AR photo and video assets must be stored in private, non-public Cloudflare R2 storage and accessed exclusively via temporary server-signed presigned URLs validated by the licensing gate.

## 3. Cryptographic Build Attestation & Integrity
1. **Release Attestation**: Client builds are bound to an Ed25519-signed release manifest and unique `CUSTOMER_ID` UUID.
2. **Offline Grace Window**: The software provides a maximum **24-hour offline grace window** calculated from the server-signed token claims for live event continuity. Offline tokens exceeding this window are purged automatically.
3. **Remote Kill-Switch**: In the event of confirmed piracy, source code leakage, or material breach, Vendor reserves the right to register the compromised `BUILD_ID` in the revocation authority, collapsing the offline grace window to zero (0).

## 4. Bandwidth Quotas & Fair Use
1. Each project deployment is allocated a standard monthly egress bandwidth quota of **100 GB**.
2. Automated warning alerts are dispatched at **80% capacity**.
3. At **100% capacity**, presigned URL generation is paused (`QUOTA_EXCEEDED`) until the start of the next calendar month or payment of supplemental bandwidth fees.

## 5. Anti-Tampering, Watermarks & Redistribution Prohibitions
Client shall NOT:
1. Sublicense, resell, rent, lease, open-source, or distribute the source code or any derivative work to third parties.
2. Remove, obfuscate, or bypass the client watermark (`--aether-cid`, Unicode selectors) or server-embedded `.mind` binary provenance headers.
3. Reverse engineer the vendor licensing authority or deploy private forks of the issuer adapter.

## 6. Liquidated Damages & Audit Rights
1. **Liquidated Damages**: Client agrees that any unauthorized redistribution, resale, or multi-tenant hosting constitutes wilful copyright infringement and breach of contract, incurring liquidated damages equal to **five (5) times the total license fee** per unauthorized deployment.
2. **Forensic Verification**: Vendor may use the signed `DELIVERY_MANIFEST.json` and forensic tracer (`scripts/trace-build.mjs`) to establish attribution in dispute proceedings.

---

**Authorized Signatures**

**Licensor (Vendor):** ________________________  **Date:** ______________

**Licensee (Client):** ________________________  **Date:** ______________
