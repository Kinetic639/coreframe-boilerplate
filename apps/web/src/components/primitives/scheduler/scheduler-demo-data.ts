import { addDays, subDays, startOfDay, addHours, addMinutes } from "date-fns";
import {
  CalendarEvent,
  BackgroundEvent,
  UnscheduledTask,
  SchedulerSettings,
} from "./scheduler-types";
import { SchedulerResource } from "./scheduler-resource-types";

const today = startOfDay(new Date());

export const INITIAL_SETTINGS: SchedulerSettings = {
  showWeekends: true,
  showBackgroundEvents: true,
  showTaskPool: true,
  showWeekNumbers: true,
  showCurrentTimeIndicator: true,
  theme: "system",
  locale: "pl",
  timezone: "Europe/Warsaw",
  timeFormat: "24h",
  dayStartHour: 0,
  dayEndHour: 24,
  autoTimeScale: false,
  visibleCategories: {
    meeting: true,
    task: true,
    workshop: true,
    warehouse: true,
    reminder: true,
    personal: true,
  },
};

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "ev-tl-1",
    title: "Chassis Upgrade and Alignment",
    description: "Standard diagnostic service and alignment overhaul.",
    start: addHours(today, 8),
    end: addHours(today, 11),
    category: "workshop",
    priority: "high",
    status: "confirmed",
    location: "Workshop Section L",
    resourceId: "mech-a",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-2",
    title: "Brake Fluid Flushing & Check",
    description: "Urgent overlap safety diagnostic review.",
    start: addHours(today, 10),
    end: addHours(today, 12),
    category: "workshop",
    priority: "medium",
    status: "tentative",
    location: "Workshop Section L",
    resourceId: "mech-a",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-3",
    title: "Engine Diagnostics Intake",
    description: "Performance review and emission test scans.",
    start: addMinutes(addHours(today, 13), 30),
    end: addHours(today, 16),
    category: "workshop",
    priority: "high",
    status: "confirmed",
    location: "Workshop Diagnostic bay",
    resourceId: "mech-a",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-4",
    title: "Quarterly Safety Equipment Check",
    description: "Ensure safety harness and battery levels comply with OSHA.",
    start: addHours(today, 8),
    end: addHours(today, 10),
    category: "warehouse",
    priority: "medium",
    status: "confirmed",
    resourceId: "forklift-1",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-5",
    title: "Heavy Duty Suspension Install",
    description: "Equipping the heavy forklift with reinforced hydraulic springs.",
    start: addHours(today, 9),
    end: addHours(today, 14),
    category: "workshop",
    priority: "high",
    status: "confirmed",
    resourceId: "bay-1",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-6",
    title: "Rapid Laser Wheel Alignment",
    description: "Perform visual digital test scans for customer.",
    start: addHours(today, 14),
    end: addHours(today, 17),
    category: "workshop",
    priority: "medium",
    status: "confirmed",
    resourceId: "bay-2",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-tl-7",
    title: "Weekly Supplier Unloading",
    description: "High priority inventory ingestion and quality assurance check.",
    start: addHours(today, 6),
    end: addHours(today, 10),
    category: "warehouse",
    priority: "high",
    status: "confirmed",
    resourceId: "dock-a",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-1",
    title: "Weekly Sync & Planning",
    description:
      "Alignment meeting with the product and engineering team to map out upcoming milestone deadlines.",
    start: addMinutes(addHours(today, 9), 30), // June 8, 09:30
    end: addHours(today, 11), // June 8, 11:00
    category: "meeting",
    priority: "high",
    status: "confirmed",
    location: "Conference Room Alpha",
    attendees: ["Juliet S.", "Mark T.", "Ariadne V."],
    resourceId: "room-a",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-2",
    title: "Customer Workshop Intake",
    description: "Direct feedback session regarding the new CRM layout onboarding experience.",
    start: addHours(today, 13), // June 8, 13:00
    end: addMinutes(addHours(today, 14), 30), // June 8, 14:30
    category: "workshop",
    priority: "high",
    status: "confirmed",
    location: "Design Lab 4",
    attendees: ["Caleb P.", "Sophia B."],
    resourceId: "room-b",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-3",
    title: "Warehouse Inventory Audit",
    description: "Bi-weekly scanning of physical incoming stock and discrepancy check.",
    start: addDays(addHours(today, 10), 1), // June 9, 10:00
    end: addDays(addHours(today, 12), 1), // June 9, 12:00
    category: "warehouse",
    priority: "medium",
    status: "tentative",
    location: "Bay 3 & Cold Storage",
    attendees: ["Gunter H.", "Hans M."],
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-4",
    title: "Code Review & Merge",
    description: "Clean up technical debt and merge the calendar dragging feature pull request.",
    start: addDays(addHours(today, 15), 1), // June 9, 15:00
    end: addDays(addHours(today, 16), 1), // June 9, 16:00
    category: "task",
    priority: "low",
    status: "confirmed",
    location: "Local Workstation",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-5",
    title: "Renew Cloud Hosting Subscription",
    description: "Pay annual developer license with corporate credit card.",
    start: addDays(addHours(today, 8), 2), // June 10, 08:00
    end: addDays(addHours(today, 8), 2), // June 10, 08:00 (All-day or direct focal milestone)
    allDay: true,
    category: "reminder",
    priority: "medium",
    status: "confirmed",
    isDraggable: true,
    isResizable: false,
  },
  {
    id: "ev-6",
    title: "Doctor Appointment",
    description: "Routine annual general checkup.",
    start: addDays(addHours(today, 16), 2), // June 10, 16:00
    end: addDays(addMinutes(addHours(today, 17), 15), 2), // June 10, 17:15
    category: "personal",
    priority: "low",
    status: "confirmed",
    location: "St. Mary Health Center",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-7",
    title: "Overlapping Strategy Discussion",
    description: "Interactive session exploring long-term infrastructure scaling plans.",
    start: addDays(addHours(today, 14), 3), // June 11, 14:00
    end: addDays(addHours(today, 15), 3), // June 11, 15:00
    category: "meeting",
    priority: "medium",
    status: "tentative",
    location: "Virtual Huddle room",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-8",
    title: "Parallel Tech Demo Session",
    description: "Overlap slot showcasing the new canvas vector graphics system.",
    start: addDays(addMinutes(addHours(today, 14), 30), 3), // June 11, 14:30
    end: addDays(addHours(today, 16), 3), // June 11, 16:00 (overlaps ev-7)
    category: "workshop",
    priority: "medium",
    status: "confirmed",
    location: "Main Presentation Theater",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-9",
    title: "Logistics Core Integration",
    description: "Sync with fulfillment providers on supply chains.",
    start: addDays(addHours(today, 9), 4), // June 12, 09:00
    end: addDays(addHours(today, 11), 4), // June 12, 11:00
    category: "warehouse",
    priority: "high",
    status: "confirmed",
    location: "Fulfillment HQ",
    isDraggable: true,
    isResizable: true,
  },
  {
    id: "ev-10",
    title: "Gym & Cardio Routine",
    description: "Interval running and light weights.",
    start: addDays(addHours(today, 18), 4), // June 12, 18:00
    end: addDays(addHours(today, 19), 4), // June 12, 19:00
    category: "personal",
    priority: "low",
    status: "confirmed",
    isDraggable: true,
    isResizable: true,
  },
];

export const INITIAL_BACKGROUND_EVENTS: BackgroundEvent[] = [
  {
    id: "bg-lunch-daily",
    title: "Lunch Break & Focus Rest",
    start: addHours(today, 12), // June 8, 12:00
    end: addHours(today, 13), // June 8, 13:00
    color: "emerald",
    opacity: 0.12,
    type: "break",
  },
  {
    id: "bg-lunch-tue",
    title: "Lunch Break & Focus Rest",
    start: addDays(addHours(today, 12), 1), // June 9, 12:00
    end: addDays(addHours(today, 13), 1), // June 9, 13:00
    color: "emerald",
    opacity: 0.12,
    type: "break",
  },
  {
    id: "bg-lunch-wed",
    title: "Lunch Break & Focus Rest",
    start: addDays(addHours(today, 12), 2), // June 10, 12:00
    end: addDays(addHours(today, 13), 2), // June 10, 13:00
    color: "emerald",
    opacity: 0.12,
    type: "break",
  },
  {
    id: "bg-lunch-thu",
    title: "Lunch Break & Focus Rest",
    start: addDays(addHours(today, 12), 3), // June 11, 12:00
    end: addDays(addHours(today, 13), 3), // June 11, 13:00
    color: "emerald",
    opacity: 0.12,
    type: "break",
  },
  {
    id: "bg-lunch-fri",
    title: "Lunch Break & Focus Rest",
    start: addDays(addHours(today, 12), 4), // June 12, 12:00
    end: addDays(addHours(today, 13), 4), // June 12, 13:00
    color: "emerald",
    opacity: 0.12,
    type: "break",
  },
  {
    id: "bg-weekend-closed",
    title: "Branch Saturday Closed",
    start: addDays(today, 5), // June 13 00:00
    end: addDays(addHours(today, 24), 5), // June 13 24:00
    color: "rose",
    opacity: 0.08,
    type: "closed",
  },
  {
    id: "bg-weekend-closed-sun",
    title: "Branch Sunday Closed",
    start: addDays(today, 6), // June 14 00:00
    end: addDays(addHours(today, 24), 6), // June 14 24:00
    color: "rose",
    type: "closed",
  },
  {
    id: "bg-focus-blocks",
    title: "Focus Rest Block",
    start: addDays(addHours(today, 16), 1), // June 9, 16:00
    end: addDays(addHours(today, 18), 1), // June 9, 18:00
    color: "indigo",
    opacity: 0.08,
    type: "focus",
  },
];

export const INITIAL_UNSCHEDULED_TASKS: UnscheduledTask[] = [
  {
    id: "ut-1",
    title: "Quarterly Financial Recap",
    description:
      "Summarize sheet calculations, outstanding customer invoices, and project profit margins.",
    estimatedDurationMinutes: 120,
    priority: "high",
    category: "task",
    color: "emerald",
  },
  {
    id: "ut-2",
    title: "Security Compliance Form",
    description:
      "Fill out and sign standard AWS security checklist and pass credentials rotation audit.",
    estimatedDurationMinutes: 45,
    priority: "medium",
    category: "warehouse",
    color: "cyan",
  },
  {
    id: "ut-3",
    title: "Product Launch Retro",
    description: "Write down pain-points of shipping the dynamic slider visual element on time.",
    estimatedDurationMinutes: 60,
    priority: "low",
    category: "meeting",
    color: "indigo",
  },
  {
    id: "ut-4",
    title: "Inspect Core Forklift Battery",
    description: "Maintenance inspection of Warehouse charging docks.",
    estimatedDurationMinutes: 30,
    priority: "medium",
    category: "warehouse",
    color: "cyan",
  },
  {
    id: "ut-5",
    title: "Order Fresh Espresso Beans",
    description: "Keep local community workspace fuel supply high.",
    estimatedDurationMinutes: 15,
    priority: "low",
    category: "personal",
    color: "fuchsia",
  },
];

export const INITIAL_RESOURCES: SchedulerResource[] = [
  // Workshop branch
  { id: "workshop", name: "Workshop Floor", description: "Central workshop & mechanics floor" },
  { id: "mechanics", name: "Mechanics Team", parentId: "workshop", expanded: true },
  {
    id: "mech-a",
    name: "Mechanic A (Senior)",
    description: "Senior Diagnostic tech",
    color: "#4f46e5",
    parentId: "mechanics",
  },
  {
    id: "mech-b",
    name: "Mechanic B (Junior)",
    description: "Service & brakes expert",
    color: "#10b981",
    parentId: "mechanics",
  },
  {
    id: "mech-c",
    name: "Mechanic C",
    description: "Apprentice support assistant",
    color: "#06b6d4",
    parentId: "mechanics",
  },

  { id: "bays", name: "Repair Bays", parentId: "workshop", expanded: true },
  {
    id: "bay-1",
    name: "Bay 1 (Heavy Lift)",
    description: "Tire & chassis service lift",
    color: "#f97316",
    parentId: "bays",
  },
  {
    id: "bay-2",
    name: "Bay 2 (Alignment)",
    description: "Laser wheel alignment hub",
    color: "#f59e0b",
    parentId: "bays",
  },
  {
    id: "bay-3",
    name: "Bay 3 (Diagnostics)",
    description: "Standard engine diagnostics",
    color: "#d946ef",
    parentId: "bays",
  },

  // Warehouse branch
  { id: "warehouse", name: "Warehouse Logistics", description: "Storage zones & cargo bays" },
  { id: "forklifts", name: "Forklifts / Vehicles", parentId: "warehouse", expanded: false },
  {
    id: "forklift-1",
    name: "Forklift #1 (Toyota)",
    description: "High lift 2.5T mechanical lift",
    color: "#14b8a6",
    parentId: "forklifts",
  },
  {
    id: "forklift-2",
    name: "Forklift #2 (Yale)",
    description: "Electric narrow aisle driver",
    color: "#0ea5e9",
    parentId: "forklifts",
  },

  { id: "docks", name: "Loading Docks", parentId: "warehouse", expanded: true },
  {
    id: "dock-a",
    name: "Dock A (Receiving)",
    description: "Incoming material ingest dock",
    color: "#f43f5e",
    parentId: "docks",
  },
  {
    id: "dock-b",
    name: "Dock B (Shipping)",
    description: "Outgoing dispatch dock",
    color: "#8b5cf6",
    parentId: "docks",
  },

  // Meeting rooms
  { id: "office", name: "Office & Meeting Rooms", description: "Co-working and sync spaces" },
  {
    id: "room-a",
    name: "Room A (Boardroom)",
    description: "AV projection screen, seats 12",
    color: "#3b82f6",
    parentId: "office",
  },
  {
    id: "room-b",
    name: "Room B (Huddle)",
    description: "Interactive whiteboard, seats 4",
    color: "#a855f7",
    parentId: "office",
  },
];
