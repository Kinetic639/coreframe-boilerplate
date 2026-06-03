# Planning Module

## Purpose

Ambra's planning and work organization hub. Helps users organize and execute work across the organization.

Answers:

- What do I need to do?
- What tasks are assigned to me?
- What tasks are assigned to my team?
- What is currently in progress?
- What is completed?

## Routes

| Route                                | Description          |
| ------------------------------------ | -------------------- |
| `/dashboard/planning`                | Module overview      |
| `/dashboard/planning/tasks`          | Task list (DataView) |
| `/dashboard/planning/tasks/new`      | Create task          |
| `/dashboard/planning/tasks/[taskId]` | Task detail          |
| `/dashboard/planning/boards`         | Kanban board view    |

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

### `planning_task_comments`

Simple comment thread on a task. Org-scoped, soft-delete.

## Services

| File                        | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `planning-tasks.service.ts` | CRUD, list/filter, status transitions for tasks |

## Actions

| Action                       | Permission              |
| ---------------------------- | ----------------------- |
| `listTasksForDataViewAction` | `PLANNING_TASKS_READ`   |
| `getTaskDetailAction`        | `PLANNING_TASKS_READ`   |
| `createTaskAction`           | `PLANNING_TASKS_CREATE` |
| `updateTaskAction`           | `PLANNING_TASKS_UPDATE` |
| `changeTaskStatusAction`     | `PLANNING_TASKS_UPDATE` |
| `assignTaskAction`           | `PLANNING_TASKS_ASSIGN` |
| `deleteTaskAction`           | `PLANNING_TASKS_DELETE` |

## Theme

Color: `#0d9488` (Teal)

---

## Future Roadmap

### Phase 2 (Not yet implemented)

- Schedules
- Calendar view
- Recurring tasks

### Phase 3 (Not yet implemented)

- Workload planning
- Team planning views
- Capacity management

### Phase 4 (Not yet implemented)

- Planning templates
- Recurring schedules
- Task dependencies

### Phase 5 (Not yet implemented)

- Integration with Workshop (link tasks to repair orders)
- Integration with Warehouse (link tasks to inventory actions)
- Integration with Help Desk (convert tickets to tasks)
