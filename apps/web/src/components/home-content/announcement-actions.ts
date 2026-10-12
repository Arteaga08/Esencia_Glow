import type { AdminHomeAnnouncement } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { toPayload, type AnnouncementFormValue } from "./announcement-form-value";

/** Guarda el aviso (`PUT /admin/home/announcement`). Un 400/409 se lanza tal cual. */
async function saveAnnouncement(value: AnnouncementFormValue, version: number): Promise<AdminHomeAnnouncement> {
  const response = await apiRequest<AdminHomeAnnouncement>("/api/v1/admin/home/announcement", {
    method: "PUT",
    authenticated: true,
    body: toPayload(value, version),
  });
  return response.data;
}

export { saveAnnouncement };
