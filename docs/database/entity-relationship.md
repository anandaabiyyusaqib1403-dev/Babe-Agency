# Entity relationships

All entities below are a **proposed target**, except where called out in `database-overview.md`. They are logical entities; migration may preserve/rename existing tables instead of creating duplicates.

## ERD: workspace, client and creative spine

```mermaid
erDiagram
  AUTH_USERS ||--o| USER_PROFILES : extends
  WORKSPACES ||--o{ WORKSPACE_MEMBERSHIPS : contains
  USER_PROFILES ||--o{ WORKSPACE_MEMBERSHIPS : joins
  WORKSPACES ||--o{ WORKSPACE_ROLES : defines
  WORKSPACE_ROLES ||--o{ WORKSPACE_ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ WORKSPACE_ROLE_PERMISSIONS : catalog
  WORKSPACE_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLE_ASSIGNMENTS : assigned
  WORKSPACE_ROLES ||--o{ MEMBERSHIP_ROLE_ASSIGNMENTS : role
  WORKSPACES ||--o{ CLIENTS : owns
  CLIENTS ||--o{ CLIENT_BRAND_BRIEFS : briefs
  CLIENT_BRAND_BRIEFS ||--o{ CLIENT_BRAND_BRIEF_VERSIONS : versions
  CLIENTS ||--o{ BRAND_GUIDELINES : guidelines
  CLIENTS ||--o{ CLIENT_CONTENT_PILLARS : pillars
  CLIENTS ||--o{ CLIENT_PROJECTS : projects
  WORKSPACES ||--o{ PACKAGES : offers
  PACKAGES ||--o{ PACKAGE_QUOTA_DEFINITIONS : quotas
  CLIENTS ||--o{ CLIENT_PACKAGE_ASSIGNMENTS : assigned
  PACKAGES ||--o{ CLIENT_PACKAGE_ASSIGNMENTS : package
  CLIENT_PACKAGE_ASSIGNMENTS ||--o{ CLIENT_QUOTA_PERIODS : periods
  CLIENT_QUOTA_PERIODS ||--o{ CLIENT_QUOTA_LIMITS : limits
  PACKAGE_QUOTA_DEFINITIONS ||--o{ CLIENT_QUOTA_LIMITS : defines
  CLIENTS ||--o{ CONTENTS : owns
  CONTENTS ||--o{ CONTENT_TAG_LINKS : tagged
  CONTENT_TAGS ||--o{ CONTENT_TAG_LINKS : applied
  CONTENTS ||--o{ CONTENT_SCHEDULES : published_as
  CONTENTS ||--o{ CONTENT_PRODUCTION_EVENTS : production
  CONTENTS ||--o{ CONTENT_STORYBOARDS : storyboard
  CONTENT_STORYBOARDS ||--o{ CONTENT_STORYBOARD_ROWS : rows
  CONTENT_STORYBOARD_ROWS o|--o{ CONTENT_STORYBOARD_ROWS : parent
  CONTENTS ||--o{ CONTENT_REVISIONS : revisions
  CONTENTS ||--o{ CONTENT_ATTACHMENTS : attachments
  CONTENTS ||--o{ CONTENT_APPROVALS : approvals
  CONTENT_APPROVALS ||--o{ CONTENT_APPROVAL_EVENTS : history
  CONTENT_SCHEDULES ||--o{ PUBLICATION_PERFORMANCE_SNAPSHOTS : measured
  PUBLICATION_PERFORMANCE_SNAPSHOTS ||--o{ PUBLICATION_METRIC_VALUES : values
```

## ERD: reporting and resources

```mermaid
erDiagram
  CLIENTS ||--o{ MONTHLY_REPORTS : monthly_drafts
  MONTHLY_REPORTS ||--o{ MONTHLY_REPORT_VERSIONS : versions
  CLIENTS ||--o{ SOCIAL_REPORTS : social_drafts
  SOCIAL_REPORTS ||--o{ SOCIAL_REPORT_VERSIONS : versions
  MONTHLY_REPORTS o|--o{ REPORT_ITEMS : monthly_items
  SOCIAL_REPORTS o|--o{ REPORT_ITEMS : social_items
  CONTENT_SCHEDULES o|--o{ REPORT_ITEMS : publication
  PUBLICATION_PERFORMANCE_SNAPSHOTS o|--o{ REPORT_ITEMS : performance
  MONTHLY_REPORT_VERSIONS o|--o{ REPORT_VERSION_PERFORMANCE_REFS : monthly_refs
  SOCIAL_REPORT_VERSIONS o|--o{ REPORT_VERSION_PERFORMANCE_REFS : social_refs
  PUBLICATION_PERFORMANCE_SNAPSHOTS ||--o{ REPORT_VERSION_PERFORMANCE_REFS : pinned_source
  WORKSPACES ||--o{ DRIVE_FILES : indexes
  DRIVE_FILES ||--o{ ASSETS : catalogued
  ASSETS ||--o{ ASSET_VERSIONS : versions
  DRIVE_FILES ||--o{ DOCUMENTS : archived
  DOCUMENTS ||--o{ DOCUMENT_SOURCE_REFS : cites
  DOCUMENTS ||--o{ DOCUMENT_GENERATION_JOBS : generated_by
  DOCUMENT_GENERATION_JOBS ||--o{ DOCUMENT_GENERATION_ATTEMPTS : attempts
```

## ERD: finance and retained operations

```mermaid
erDiagram
  WORKSPACES ||--o{ FINANCE_PERIODS : closes
  WORKSPACES ||--o{ FINANCE_ACCOUNTS : owns
  WORKSPACES ||--o{ FINANCE_CATEGORIES : defines
  FINANCE_TRANSACTIONS ||--o{ FINANCE_JOURNAL_ENTRIES : source
  FINANCE_PERIODS ||--o{ FINANCE_JOURNAL_ENTRIES : period
  FINANCE_JOURNAL_ENTRIES ||--|{ FINANCE_JOURNAL_LINES : balances
  FINANCE_ACCOUNTS ||--o{ FINANCE_JOURNAL_LINES : account
  FINANCE_CATEGORIES ||--o{ FINANCE_JOURNAL_LINES : classifies
  FINANCE_JOURNAL_ENTRIES ||--o{ FINANCE_APPROVALS : approval
  FINANCE_ACCOUNTS ||--o{ FINANCE_RECONCILIATIONS : statement
  FINANCE_RECONCILIATIONS ||--o{ FINANCE_RECONCILIATION_ITEMS : matches
  FINANCE_JOURNAL_LINES ||--o{ FINANCE_RECONCILIATION_ITEMS : source_line
  FINANCE_JOURNAL_LINES ||--o{ FINANCE_ALLOCATIONS : attributed
  CLIENT_PROJECTS o|--o{ FINANCE_ALLOCATIONS : analytic_target
  FINANCE_TRANSACTIONS ||--o{ FINANCE_ATTACHMENTS : evidence
  FINANCE_PERIODS ||--o{ FINANCE_REPORT_SNAPSHOTS : reports
  WORKSPACES ||--o{ AUDIT_EVENTS : records
  WORKSPACES ||--o{ WORKSPACE_INTEGRATIONS : connects
  CONTENTS ||--o{ TASKS : task_context
  WORKSPACES ||--o{ TASKS : tracks
  TASKS ||--o{ TASK_ACTIVITY_LOGS : history
  TASKS ||--o{ TASK_REMINDER_EVENTS : reminders
  TASKS ||--o{ TASK_NOTIFICATION_PREFERENCES : preferences
  TASKS ||--o{ EMAIL_REMINDER_QUEUE : queued_reminder
  WORKSPACE_MEMBERSHIPS ||--o{ NOTIFICATIONS : receives
  WORKSPACE_MEMBERSHIPS ||--o{ TASK_NOTIFICATION_PREFERENCES : configures
  WORKSPACE_MEMBERSHIPS ||--o{ EMAIL_REMINDER_QUEUE : recipient
  WORKSPACES ||--o{ FINANCE_TRANSACTIONS : records
  CLIENTS o|--o{ FINANCE_TRANSACTIONS : attributed_client
  CLIENT_PROJECTS o|--o{ FINANCE_TRANSACTIONS : attributed_project
  WORKSPACES ||--o{ FINANCE_RECONCILIATIONS : reconciles
  WORKSPACES ||--o{ FINANCE_JOURNAL_ENTRIES : posts
  FINANCE_JOURNAL_ENTRIES ||--o{ FINANCE_APPROVALS : review_history
  WORKSPACES ||--o{ FINANCE_ATTACHMENTS : evidence
  FINANCE_TRANSACTIONS ||--o{ FINANCE_ATTACHMENTS : has_evidence
  FINANCE_JOURNAL_LINES ||--o{ FINANCE_ALLOCATIONS : allocated
```

## Cardinality and integrity notes

- One content record can have zero or many schedules. Schedule ID is the publication identity; performance and report references key to it, never only to content.
- Quotas count distinct content IDs in the assigned quota period. Schedules do not consume additional content quota unless a later approved rule explicitly says otherwise.
- Each report version has its own immutable snapshot. `report_items` references drafts; `report_version_performance_refs` pins the exact publication snapshot used for a finalized version.
- Storyboard rows are ordered by `(storyboard_id, position)` and may point to a parent row inside the same storyboard.
- Every cross-domain FK that includes client-owned data carries `(workspace_id, client_id, referenced_id)` or a corresponding composite unique key.
- A journal entry has at least two lines. Posting is an atomic server-side action that verifies equal debit/credit totals. Reversal is a new entry referencing its source; no posted line is edited.
- Allocation rows describe attribution of an existing journal line to a client/project and do not create another journal posting.

For field-level constraints and delete policies, see `table-specifications.md`.

The ERDs intentionally show the relationship spine rather than repeating every workspace FK as a line. All 68 proposed tables are listed in the table specification. The operations diagram includes task notification preferences and reminder queue; the resource diagram covers Drive metadata, asset versions, documents, source refs and render attempts.
