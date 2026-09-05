# Notification & Alert Triggers

This document describes how alerts and system notifications are triggered, stored, and displayed in the Hotel Kapila Inventory Management System.

## 1. Notification Types & Severities

| Type | Severity | Trigger Condition | Delivery |
|---|---|---|---|
| **low_stock** | Warning | A stock item's current `remaining` quantity falls below its configured `min_alert_qty` or 25% of initial quantity. | UI Bell notification, WhatsApp alert link generated on dashboard. |
| **expiry** | Critical | A batch of stock has an `expiry_date` less than 3 days from today. | Nightly Cron runs check; displays on dashboard Spoilage widget. |
| **anomaly** | Critical | Daily consumption ratio for an item spikes above its 7-day baseline times its dynamic threshold (20% - 60% depending on volatility). | UI Bell notification for Admin/Managers. |
| **approval_pending** | Info | A new Purchase Order or urgent Indent is submitted. | Sent to the specific users holding the role required in the Approval Matrix. |
| **approval_action** | Info | An approver approves or rejects a pending request. | Sent back to the creator of the request. |

## 2. Notification Model Schema

### `notifications`
- `id`: Unique incremental ID.
- `recipient_user_id`: Target user (optional, broadcasts use NULL).
- `recipient_role_id`: Target role (optional).
- `title`: Subject line.
- `message`: Description.
- `type`: Category of warning.
- `severity`: "info" | "warning" | "critical"
- `is_read`: Boolean read state.
- `metadata`: JSON payload linking to target screen (e.g. `{"indent_id": 14}`).
