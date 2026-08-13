import { supabase } from "../supabase";

const BUCKET = "stick-photos";

export async function uploadStickPhoto(
  photo: File
): Promise<string> {
  const compressedPhoto =
    await compressImage(photo);

  const filePath =
    `sticks/${crypto.randomUUID()}.jpg`;

  const { error } = await supabase.storage
    .from("stick-photos")
    .upload(
      filePath,
      compressedPhoto,
      {
        contentType: "image/jpeg",
      }
    );

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

export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<File> {
  const imageBitmap = await createImageBitmap(file);

  const ratio = Math.min(
    1,
    maxWidth / imageBitmap.width
  );

  const width = Math.round(
    imageBitmap.width * ratio
  );

  const height = Math.round(
    imageBitmap.height * ratio
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Impossible de créer le contexte canvas."
    );
  }

  ctx.drawImage(
    imageBitmap,
    0,
    0,
    width,
    height
  );

  const blob = await new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(
              new Error(
                "Erreur lors de la compression de l'image."
              )
            );
            return;
          }

          resolve(result);
        },
        "image/jpeg",
        quality
      );
    }
  );

  const compressedFile = new File(
    [blob],
    `${crypto.randomUUID()}.jpg`,
    {
      type: "image/jpeg",
    }
  );

  imageBitmap.close();

  return compressedFile;
}