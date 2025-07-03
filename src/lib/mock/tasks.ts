import { Task } from "@/lib/types/home";

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Audyt w Magazynie Głównym",
    due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
    type: "audit",
  },
  {
    id: "task-2",
    title: "Przeniesienie Produktu A",
    due_date: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(),
    type: "relocation",
  },
  {
    id: "task-3",
    title: "Spotkanie zespołu magazynowego",
    due_date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(),
    type: "meeting",
  },
];
