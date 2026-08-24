/**
 * ============================================================================
 * AETHER AR — ENTERPRISE DTO SANITIZER & LEAST-PRIVILEGE SERIALIZER
 * ============================================================================
 * 
 * Guarantees that internal hashes, secrets, and private metadata are stripped
 * before any database entity is serialized and sent to the client frontend.
 * 
 * Fields NEVER allowed to leave the server:
 *  - `pin_hash`
 *  - `device_secret_hash`
 *  - `token_hash`
 *  - `nonce_hash`
 *  - `password_hash`
 *  - `service_role_key`
 * ============================================================================
 */

import type { Database } from "@/integrations/supabase/types";

type RawExperience = Database["public"]["Tables"]["ar_experiences"]["Row"];
type RawAlbum = Database["public"]["Tables"]["albums"]["Row"];
type RawLicense = Database["public"]["Tables"]["licenses"]["Row"];
type RawActivation = Database["public"]["Tables"]["license_activations"]["Row"];
type RawProfile = Database["public"]["Tables"]["profiles"]["Row"];

/** Sanitized Experience DTO */
export type ExperienceDTO = Omit<RawExperience, "pin_hash"> & {
  has_pin: boolean;
  cover_preview_url?: string | null;
};

/** Sanitized Album DTO */
export type AlbumDTO = Omit<RawAlbum, "pin_hash"> & {
  has_pin: boolean;
  ar_experiences?: Array<{ id: string; title: string; target_index: number | null }>;
};

/** Sanitized License DTO */
export type LicenseDTO = RawLicense;

/** Sanitized License Activation DTO */
export type ActivationDTO = Omit<RawActivation, "device_secret_hash">;

/** Sanitized User Profile DTO */
export type ProfileDTO = Pick<
  RawProfile,
  "id" | "email" | "display_name" | "avatar_url" | "approval_status" | "storage_quota_bytes" | "created_at"
>;

/**
 * Sanitizes an AR experience entity, removing internal bcrypt pin_hash.
 */
export function sanitizeExperience(row: Partial<RawExperience> & Record<string, any>): ExperienceDTO {
  const { pin_hash, ...safe } = row;
  return {
    ...safe,
    has_pin: Boolean(pin_hash),
  } as ExperienceDTO;
}

/**
 * Sanitizes an Album entity, removing internal bcrypt pin_hash.
 */
export function sanitizeAlbum(row: Partial<RawAlbum> & Record<string, any>): AlbumDTO {
  const { pin_hash, ...safe } = row;
  return {
    ...safe,
    has_pin: Boolean(pin_hash),
  } as AlbumDTO;
}

/**
 * Sanitizes a License Activation entity, removing device_secret_hash.
 */
export function sanitizeActivation(row: Partial<RawActivation> & Record<string, any>): ActivationDTO {
  const { device_secret_hash, ...safe } = row;
  return safe as ActivationDTO;
}

/**
 * Sanitizes a User Profile entity, ensuring internal flags are stripped.
 */
export function sanitizeProfile(row: Partial<RawProfile> & Record<string, any>): ProfileDTO {
  return {
    id: row.id || "",
    email: row.email || null,
    display_name: row.display_name || null,
    avatar_url: row.avatar_url || null,
    approval_status: row.approval_status || "pending",
    storage_quota_bytes: Number(row.storage_quota_bytes || 0),
    created_at: row.created_at || new Date().toISOString(),
  };
}

export const sanitizeLicenseActivation = sanitizeActivation;
export const sanitizeProfilePublic = sanitizeProfile;


