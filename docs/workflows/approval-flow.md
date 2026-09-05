# Approval Flow & Matrix

This document defines the rules, thresholds, and routing logic for the Hotel Kapila Inventory Management System's multi-stage approvals.

## 1. Approval Rules Matrix

Transactions are routed for approval based on transaction type, department boundaries, and monetary thresholds:

| Module | Condition / Threshold | Required Approval Role | Routing Behaviour |
|---|---|---|---|
| **Purchase Orders** | Amount <= ₹25,000 | Store Manager (`store_manager`) | Auto-routes to Store Manager for single-step approval. |
| **Purchase Orders** | Amount > ₹25,000 | Admin (`admin`) | Multi-stage: requires Store Manager review, then Admin final approval. |
| **Indents** | Routine Indent | Storekeeper (`store_keeper` / `store_manager`) | Auto-routes to Storekeeper for release. |
| **Indents** | Urgent/Ad-hoc Indent | Department Head & Store Manager | Must be acknowledged by Dept Head, then approved by Store Manager. |
| **Transfers** | Store to Department | Receiving Department Head | Stays in transit until receiving head confirms receipt. |
| **Reconciliations** | Discrepancy Value <= ₹5,000 | Store Manager (`store_manager`) | Approved and resolved instantly on manager action. |
| **Reconciliations** | Discrepancy Value > ₹5,000 | Admin (`admin`) | Stays in pending status until Admin accepts write-off. |

## 2. Database Entities

### `approval_rules`
Defines the rule thresholds.
- `module`: "purchase_orders" | "indents" | "transfers" | "reconciliations"
- `min_amount`: minimum amount threshold.
- `max_amount`: maximum amount threshold.
- `role_id`: role permitted to approve.

### `approval_requests`
Tracks instances of approvals.
- `module`: target table name.
- `resource_id`: FK to target record.
- `status`: "pending" | "approved" | "rejected"
- `current_sequence`: for multi-step routing.
