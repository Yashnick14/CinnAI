import { File } from "expo-file-system";

// Load with the native bundle so Analyse does not need a Metro chunk request.
// SDK 57's fetch requires a Blob-compatible file, rather than a legacy URI object.
export async function uploadPhoto(uri: string): Promise<Blob> {
  return new File(uri);
}
