import fs from "fs";
import path from "path";
import { logger } from "./logger";

/**
 * Uploads a base64 encoded image either to Supabase Storage (if configured)
 * or falls back to local VPS storage.
 * 
 * @param base64Data The full base64 data URL (e.g. data:image/png;base64,...)
 * @param originalName The original filename to extract the extension
 * @param tenantId The tenant ID for scoping the filename
 * @returns The public URL of the uploaded image
 */
export async function uploadProductImage(
  base64Data: string,
  originalName: string,
  tenantId: number
): Promise<string> {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image format");
  }

  const mimeType = matches[1];
  const fileBuffer = Buffer.from(matches[2], "base64");
  const extension = path.extname(originalName) || ".png";
  const fileName = `${tenantId}_${Date.now()}_${Math.floor(Math.random() * 1000)}${extension}`;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      logger.info({ fileName, tenantId }, "Attempting upload to Supabase Storage");
      
      const cleanUrl = supabaseUrl.replace(/\/$/, "");
      // Upload endpoint: POST /storage/v1/object/<bucket>/<path>
      const uploadUrl = `${cleanUrl}/storage/v1/object/products/${fileName}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": mimeType,
          "x-upsert": "true"
        },
        body: fileBuffer
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Public URL: /storage/v1/object/public/<bucket>/<path>
      const publicUrl = `${cleanUrl}/storage/v1/object/public/products/${fileName}`;
      logger.info({ publicUrl }, "Successfully uploaded image to Supabase Storage");
      return publicUrl;
    } catch (err: any) {
      logger.error(err, "Supabase Storage upload failed, falling back to local storage");
    }
  }

  // Fallback to local storage
  logger.info({ fileName, tenantId }, "Writing file to local disk storage (fallback)");
  const uploadDir = path.join(process.cwd(), "uploads");
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  await fs.promises.writeFile(filePath, fileBuffer);

  const imageUrl = `/api/uploads/${fileName}`;
  logger.info({ imageUrl }, "Successfully saved image to local fallback storage");
  return imageUrl;
}

export async function uploadAttendancePhoto(
  base64Data: string,
  employeeId: number,
  tenantId: number
): Promise<string> {
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image format");
  }

  const mimeType = matches[1];
  const fileBuffer = Buffer.from(matches[2], "base64");
  const extension = ".png";
  const fileName = `attendance_${tenantId}_${employeeId}_${Date.now()}_${Math.floor(Math.random() * 1000)}${extension}`;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      logger.info({ fileName, tenantId }, "Attempting upload to Supabase Storage");
      const cleanUrl = supabaseUrl.replace(/\/$/, "");
      const uploadUrl = `${cleanUrl}/storage/v1/object/products/${fileName}`;

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": mimeType,
          "x-upsert": "true"
        },
        body: fileBuffer
      });

      if (response.ok) {
        const publicUrl = `${cleanUrl}/storage/v1/object/public/products/${fileName}`;
        logger.info({ publicUrl }, "Successfully uploaded attendance photo to Supabase Storage");
        return publicUrl;
      }
    } catch (err) {
      logger.error(err, "Supabase Storage upload failed for attendance photo, falling back to local");
    }
  }

  logger.info({ fileName, tenantId }, "Writing attendance photo to local disk storage");
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  await fs.promises.writeFile(filePath, fileBuffer);

  const imageUrl = `/api/uploads/${fileName}`;
  logger.info({ imageUrl }, "Successfully saved attendance photo to local fallback storage");
  return imageUrl;
}

