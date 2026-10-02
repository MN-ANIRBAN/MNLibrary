import { supabase } from "./config";
import { validateImageFile } from "../utils/fileValidator";
import { getUserFacingError } from "../utils/errorHandler";

const BUCKET_NAME = "avatar";

/**
 * Uploads a profile picture to Supabase storage.
 * Validates file type, magic bytes, and size before uploading.
 * @param {string} userId - The ID of the user.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} - The public URL of the uploaded image.
 */
export const uploadProfilePicture = async (userId, file) => {
  if (!file) throw new Error("No file provided");

  // Validate file before uploading
  const validation = await validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const fileNameStr = file.name || 'avatar.jpg';
  const fileExt = fileNameStr.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  // Convert File/Blob to ArrayBuffer to avoid any FormData serialization issues
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, arrayBuffer, { 
      upsert: true, 
      contentType: file.type || 'image/jpeg' 
    });

  if (uploadError) {
    console.error("RAW SUPABASE UPLOAD ERROR:", uploadError);
    if (uploadError.message?.includes('security policy') || uploadError.statusCode === '403') {
      throw new Error("Supabase RLS Policy violation on 'avatar' bucket. Please update your storage policies in the Supabase Dashboard.");
    }
    throw new Error(getUserFacingError(uploadError, 'uploadProfilePicture'));
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Updates the user's profile picture URL in the users table.
 * If done by an admin, RLS policies must allow it.
 * @param {string} userId - The ID of the user.
 * @param {string} publicUrl - The new profile picture URL.
 */
export const updateProfilePictureUrl = async (userId, publicUrl) => {
  // 1. Always update auth user metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: { avatar_url: publicUrl }
  });

  if (authError) {
    console.warn("Failed to update auth metadata avatar_url", authError);
  }

  // 2. Try to update public.users table (might fail if column doesn't exist)
  const { data, error: dbError } = await supabase
    .from("users")
    .update({ profile_picture_url: publicUrl })
    .eq("id", userId)
    .select();

  if (dbError) {
    console.warn("Could not update profile_picture_url in users table. Column might be missing:", dbError);
    // We don't throw here so the upload still succeeds using auth metadata
  }

  return data?.[0] || { profile_picture_url: publicUrl };
};

/**
 * Convenience function to upload and update a profile picture in one step.
 * @param {string} userId - The ID of the user.
 * @param {File} file - The image file to upload.
 */
export const addOrModifyProfilePicture = async (userId, file) => {
  const publicUrl = await uploadProfilePicture(userId, file);
  return await updateProfilePictureUrl(userId, publicUrl);
};

/**
 * Uploads a cover picture to Supabase storage.
 * Validates file type, magic bytes, and size before uploading.
 * @param {string} userId - The ID of the user.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} - The public URL of the uploaded image.
 */
export const uploadCoverPicture = async (userId, file) => {
  if (!file) throw new Error("No file provided");

  // Validate file before uploading
  const validation = await validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  const fileNameStr = file.name || 'cover.jpg';
  const fileExt = fileNameStr.split('.').pop();
  const fileName = `cover-${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  // Convert File/Blob to ArrayBuffer to avoid any FormData serialization issues
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, arrayBuffer, { 
      upsert: true,
      contentType: file.type || 'image/jpeg' 
    });

  if (uploadError) {
    console.error("RAW SUPABASE UPLOAD ERROR:", uploadError);
    if (uploadError.message?.includes('security policy') || uploadError.statusCode === '403') {
      throw new Error("Supabase RLS Policy violation on 'avatar' bucket. Please update your storage policies in the Supabase Dashboard.");
    }
    throw new Error(getUserFacingError(uploadError, 'uploadCoverPicture'));
  }

  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return data.publicUrl;
};

/**
 * Updates the user's cover picture URL in the metadata.
 * @param {string} userId - The ID of the user.
 * @param {string} publicUrl - The new cover picture URL.
 */
export const updateCoverPictureUrl = async (userId, publicUrl) => {
  // 1. Update auth user metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: { cover_url: publicUrl }
  });

  if (authError) {
    console.warn("Failed to update auth metadata cover_url", authError);
  }

  // 2. Try to update public.users table (might fail if column doesn't exist)
  const { data, error: dbError } = await supabase
    .from("users")
    .update({ cover_picture_url: publicUrl })
    .eq("id", userId)
    .select();

  if (dbError) {
    console.warn("Could not update cover_picture_url in users table. Column might be missing:", dbError);
  }

  return data?.[0] || { cover_picture_url: publicUrl };
};

/**
 * Convenience function to upload and update a cover picture in one step.
 * @param {string} userId - The ID of the user.
 * @param {File} file - The image file to upload.
 */
export const addOrModifyCoverPicture = async (userId, file) => {
  const publicUrl = await uploadCoverPicture(userId, file);
  return await updateCoverPictureUrl(userId, publicUrl);
};
