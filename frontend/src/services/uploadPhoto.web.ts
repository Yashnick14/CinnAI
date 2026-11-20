/** Read a captured image URI into the upload representation required by this platform. */
export async function uploadPhoto(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Unable to read the captured photo.");
  return response.blob();
}
