---
name: Spec Change Proposal
about: Propose a change to the RIO Receipt Protocol specification
title: "[SPEC] "
labels: spec-change
assignees: ''
---

## Which Spec Document

- [ ] `spec/receipt-schema.json` — Receipt format and fields
- [ ] `spec/ledger-format.md` — Ledger entry structure and hash chain rules
- [ ] `spec/signing-rules.md` — Signing algorithms and verification procedures

## Proposed Change

Describe the change in detail. Include the current behavior and the proposed new behavior. If modifying a schema, show the before and after.

## Rationale

Why is this change necessary? What problem does it solve? What use case does it enable?

## Backward Compatibility

- [ ] This change is **fully backward compatible** — existing valid receipts and ledger entries remain valid
- [ ] This change **breaks backward compatibility** — explain why this is justified and what migration path exists

Describe the compatibility impact in detail. If this adds new fields, are they optional? If this changes existing fields, what happens to data produced under the current spec?

## Conformance Test Impact

Describe which conformance tests would need to be added, modified, or removed. New spec features must include conformance tests.

## Additional Context

Add any references, prior art, or related issues here.
