export type BuildProfile = "admin" | "client" | "selfhost";

const profile = (import.meta.env.VITE_BUILD_PROFILE ?? "admin") as BuildProfile;

export const features = Object.freeze({
  profile,
  ADMIN_ENABLED: profile === "admin" || profile === "selfhost",
  LICENSING_ENABLED: profile !== "client" || import.meta.env.VITE_LICENSING_ENABLED === "true",
  ANALYTICS_ENABLED: import.meta.env.VITE_ANALYTICS_ENABLED !== "false",
  ROOM_AR_ENABLED: import.meta.env.VITE_ROOM_AR_ENABLED !== "false",
});
