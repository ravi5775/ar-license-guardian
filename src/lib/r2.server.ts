/**
 * Legacy wrapper module re-exporting unified storage functions from storage.server.ts.
 */
export {
  isR2Configured,
  getR2Client,
  createPresignedUploadUrl as createR2PresignedUploadUrl,
  createPresignedDownloadUrl as createR2PresignedDownloadUrl,
  getStorageObjectMetadata as getR2ObjectMetadata,
  deleteStorageObject as deleteR2Object,
} from "./storage.server";
