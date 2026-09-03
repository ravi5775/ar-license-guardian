/**
 * Unified Storage Adapter Module.
 * Provides a single, configuration-driven object storage interface across both:
 *  - main (edge / Cloudflare R2 / $0)
 *  - self-hosted (private server / Docker / Cloudflare R2 or Supabase)
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageProvider = "r2" | "supabase";

function r2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "aether-ar-media",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || "",
  };
}

export function getStorageProvider(): StorageProvider {
  const customProvider = process.env.STORAGE_PROVIDER as StorageProvider | undefined;
  const { accountId, accessKeyId, secretAccessKey } = r2Config();
  if (customProvider) return customProvider;
  if (accountId && accessKeyId && secretAccessKey) return "r2";
  return "supabase";
}

export function isR2Configured(): boolean {
  const { accountId, accessKeyId, secretAccessKey } = r2Config();
  return Boolean(accountId && accessKeyId && secretAccessKey);
}

export function getR2Client(): S3Client {
  const { accountId, accessKeyId, secretAccessKey } = r2Config();
  if (!isR2Configured()) {
    throw new Error(
      "Cloudflare R2 is not fully configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Generates a presigned upload URL for Cloudflare R2 (or fallback for Supabase).
 */
export async function createPresignedUploadUrl(
  path: string,
  contentType?: string,
  expiresInSeconds = 900,
): Promise<{ signedUrl: string; token: string; path: string; provider: StorageProvider }> {
  const provider = getStorageProvider();
  const { bucket } = r2Config();

  if (provider === "r2") {
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      ContentType: contentType || "application/octet-stream",
    });
    const signedUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return { signedUrl, token: "", path, provider: "r2" };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: signed, error } = await supabaseAdmin.storage
    .from("ar-media")
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw new Error(error.message);
  return { ...signed, provider: "supabase" };
}

/**
 * Generates a presigned download URL for media retrieval.
 */
export async function createPresignedDownloadUrl(
  path: string,
  expiresInSeconds = 900,
): Promise<string | null> {
  const provider = getStorageProvider();
  const { bucket, publicBaseUrl } = r2Config();

  if (provider === "r2") {
    if (publicBaseUrl) {
      const cleanBase = publicBaseUrl.replace(/\/+$/, "");
      const cleanPath = path.replace(/^\/+/, "");
      return `${cleanBase}/${cleanPath}`;
    }
    const client = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("ar-media")
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

/**
 * Retrieves object size and content type metadata.
 */
export async function getStorageObjectMetadata(
  path: string,
): Promise<{ size: number; contentType?: string } | null> {
  const provider = getStorageProvider();
  const { bucket } = r2Config();

  if (provider === "r2") {
    try {
      const client = getR2Client();
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: path,
      });
      const res = await client.send(command);
      return {
        size: res.ContentLength ?? 0,
        contentType: res.ContentType,
      };
    } catch {
      return null;
    }
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  const { data: rows } = await supabaseAdmin.storage
    .from("ar-media")
    .list(folder, { search: name, limit: 1 });
  const size = (rows?.[0] as any)?.metadata?.size as number | undefined;
  return size != null ? { size } : null;
}

/**
 * Deletes an object from media storage.
 */
export async function deleteStorageObject(path: string): Promise<void> {
  const provider = getStorageProvider();
  const { bucket } = r2Config();

  if (provider === "r2") {
    const client = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: path,
    });
    await client.send(command);
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.storage.from("ar-media").remove([path]);
}
