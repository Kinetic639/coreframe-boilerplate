# Planning Module

## Purpose

Ambra's planning and work organization hub. Helps users organize and execute work across the organization.

Answers:

- What do I need to do?
- What tasks are assigned to me?
- What tasks are assigned to my team?
- What is currently in progress?
- What is completed?

## Implementation Status

| Feature                                              | Status  |
| ---------------------------------------------------- | ------- |
| Module base (routes, permissions, sidebar, i18n)     | Done    |
| Task list (DataView with SSR initial data)           | Done    |
| Create task dialog                                   | Done    |
| Task detail panel (open from DataView)               | Done    |
| Task activity/audit trail                            | Done    |
| Status transitions (start, complete, reopen, cancel) | Done    |
| Assign/unassign tasks                                | Done    |
| Soft-delete (archive) tasks                          | Done    |
| Kanban board                                         | Not yet |
| Task comments                                        | Not yet |
| Task labels/checklists                               | Not yet |
| Recurring tasks                                      | Not yet |
| Calendar/schedule view                               | Not yet |
| Reminders/notifications                              | Not yet |
| Cross-module task creation                           | Not yet |

## Routes

| Route                        | Description                     |
| ---------------------------- | ------------------------------- |
| `/dashboard/planning`        | Module overview                 |
| `/dashboard/planning/tasks`  | Task list (DataView)            |
| `/dashboard/planning/boards` | Kanban board view (placeholder) |

## Permissions

| Constant                 | Slug                     | Description                 |
| ------------------------ | ------------------------ | --------------------------- |
| `MODULE_PLANNING_ACCESS` | `module.planning.access` | Enter the Planning module   |
| `PLANNING_READ`          | `planning.read`          | View module shell           |
| `PLANNING_TASKS_READ`    | `planning.tasks.read`    | List and view tasks         |
| `PLANNING_TASKS_CREATE`  | `planning.tasks.create`  | Create new tasks            |
| `PLANNING_TASKS_UPDATE`  | `planning.tasks.update`  | Edit tasks, change status   |
| `PLANNING_TASKS_DELETE`  | `planning.tasks.delete`  | Soft-delete tasks           |
| `PLANNING_TASKS_ASSIGN`  | `planning.tasks.assign`  | Assign tasks to org members |

## Role Assignments

| Role         | Permissions                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `org_owner`  | `planning.*` (wildcard — all)                                                                                      |
| `org_member` | `planning.read`, `planning.tasks.read`, `planning.tasks.create`, `planning.tasks.update`, `module.planning.access` |

## Tables

### `planning_tasks`

Core task entity. Org-scoped, soft-delete, with optional branch scoping.

Fields: `id`, `organization_id`, `branch_id`, `task_number` (PT-000001 format), `title`, `description_plain`, `description_rich`, `status` (open/in_progress/completed/cancelled), `priority` (low/normal/high/urgent), `assigned_to`, `created_by`, `updated_by`, `started_at`, `completed_at`, `cancelled_at`, `due_at`, `created_at`, `updated_at`, `deleted_at`

### `planning_task_activity`

Append-only audit log. RLS: no UPDATE or DELETE for normal users.

Activity types: `task_created`, `title_changed`, `description_changed`, `assigned`, `unassigned`, `status_changed`, `priority_changed`, `due_date_changed`, `completed`, `reopened`, `cancelled`, `archived`

## Services

| File                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| `planning-tasks.service.ts` | Full CRUD + activity writes for tasks |

## Actions

| Action                       | Permission              |
| ---------------------------- | ----------------------- |
| `listTasksForDataViewAction` | `PLANNING_TASKS_READ`   |
| `getTaskDetailAction`        | `PLANNING_TASKS_READ`   |
| `createTaskAction`           | `PLANNING_TASKS_CREATE` |
| `updateTaskAction`           | `PLANNING_TASKS_UPDATE` |
| `startTaskAction`            | `PLANNING_TASKS_UPDATE` |
| `completeTaskAction`         | `PLANNING_TASKS_UPDATE` |
| `reopenTaskAction`           | `PLANNING_TASKS_UPDATE` |
| `cancelTaskAction`           | `PLANNING_TASKS_UPDATE` |
| `assignTaskAction`           | `PLANNING_TASKS_ASSIGN` |
| `deleteTaskAction`           | `PLANNING_TASKS_DELETE` |

## Components

| File                                                       | Purpose                 |
| ---------------------------------------------------------- | ----------------------- |
| `src/components/planning/planning-task-status-badge.tsx`   | Status badge            |
| `src/components/planning/planning-task-priority-badge.tsx` | Priority badge          |
| `src/components/planning/planning-task-activity-list.tsx`  | Activity timeline       |
| `tasks/_components/planning-task-create-dialog.tsx`        | Create task dialog      |
| `tasks/_components/planning-task-detail-panel.tsx`         | Detail panel (DataView) |
| `tasks/_components/tasks-client.tsx`                       | DataView client wrapper |

## Migrations

| File                                            | Purpose                                               |
| ----------------------------------------------- | ----------------------------------------------------- |
| `20260601200000_planning_module.sql`            | Initial tables, permissions, RLS                      |
| `20260603120000_planning_tasks_v2_activity.sql` | task_number, cancelled status, planning_task_activity |

## Theme

Color: `#0d9488` (Teal)

---

## Future Roadmap

### Phase 2 (Not yet implemented)

- Task comments
- Labels/tags
- Kanban board view

### Phase 3 (Not yet implemented)

- Calendar view
- Recurring tasks
- Reminders/notifications
- Workload planning

### Phase 4 (Not yet implemented)

- Planning templates
- Task dependencies
- Cross-module task creation (from Help Desk, Workshop, etc.)
