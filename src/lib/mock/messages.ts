import { SystemMessage } from "@/lib/types/home";

export const mockMessages: SystemMessage[] = [
  {
    id: "msg-1",
    title: "Ważne ogłoszenie",
    content: "Prosimy o zachowanie szczególnej ostrożności w strefie załadunku.",
    created_at: new Date().toISOString(),
    created_by: "Zarząd",
    visibility: "organization",
    pinned: true,
  },
  {
    id: "msg-2",
    title: "Nowy pracownik",
    content: "Witamy w zespole Annę Nowak!",
    created_at: new Date().toISOString(),
    created_by: "Jan Kowalski",
    visibility: "branch",
  },
  {
    id: "msg-3",
    title: "Prywatna notatka",
    content: "Pamiętaj o spotkaniu z dostawcą o 15:00.",
    created_at: new Date().toISOString(),
    created_by: "Anna Nowak",
    visibility: "user",
  },
];
