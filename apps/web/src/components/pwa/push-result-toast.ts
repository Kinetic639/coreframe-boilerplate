import { toast } from "react-toastify";
import type { EnableResult } from "@/lib/push/client";

type Translate = (key: string) => string;

/** Tells the user how "turn on notifications" went */
export function announcePushResult(result: EnableResult, t: Translate): void {
  if (result === "on") toast.success(t("result.on"));
  else if (result === "denied") toast.warning(t("result.denied"));
  else if (result === "unsupported") toast.info(t("result.unsupported"));
  else if (result === "unconfigured") toast.info(t("result.unconfigured"));
  else toast.error(t("result.failed"));
}
