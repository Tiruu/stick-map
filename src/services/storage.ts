import { supabase } from "../supabase";

const BUCKET = "stick-photos";

export async function uploadStickPhoto(
  photo: File
): Promise<string> {
  const extension = photo.name.split(".").pop();

  const filePath =
    `sticks/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, photo);

  if (error) {
    throw error;
  }

  return filePath;
}

export function getStickPhotoUrl(
  path: string
): string {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}