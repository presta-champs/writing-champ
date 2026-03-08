"use server";

import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PersonaWritingSample } from "@/types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = [".txt", ".docx", ".pdf"] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getFileExtension(filename: string): string {
    return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

function validateFile(file: File): { valid: true } | { valid: false; error: string } {
    if (!file || file.size === 0) {
        return { valid: false, error: "No file provided" };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: "File exceeds maximum size of 5 MB" };
    }
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
        return {
            valid: false,
            error: `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        };
    }
    return { valid: true };
}

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

async function extractTextFromTxt(file: File): Promise<string> {
    return await file.text();
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
    // mammoth must be installed: npm install mammoth
    try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        return result.value;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
            throw new Error(
                "The mammoth package is required for .docx extraction. Run: npm install mammoth"
            );
        }
        throw new Error(`Failed to extract text from .docx file: ${message}`);
    }
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
    // pdf-parse must be installed: npm install pdf-parse
    try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(Buffer.from(buffer));
        return result.text;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
            throw new Error(
                "The pdf-parse package is required for .pdf extraction. Run: npm install pdf-parse"
            );
        }
        throw new Error(`Failed to extract text from .pdf file: ${message}`);
    }
}

async function extractText(file: File): Promise<string> {
    const ext = getFileExtension(file.name);
    switch (ext) {
        case ".txt":
            return extractTextFromTxt(file);
        case ".docx": {
            const buffer = await file.arrayBuffer();
            return extractTextFromDocx(buffer);
        }
        case ".pdf": {
            const buffer = await file.arrayBuffer();
            return extractTextFromPdf(buffer);
        }
        default:
            return "";
    }
}

// ---------------------------------------------------------------------------
// Org-ownership helpers
// ---------------------------------------------------------------------------

async function verifyPersonaOwnership(personaId: string) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();
    const { data: persona } = await supabase
        .from("personas")
        .select("id")
        .eq("id", personaId)
        .eq("organization_id", org.id)
        .single();

    if (!persona) throw new Error("Persona not found or does not belong to your organization");

    return { org, supabase };
}

async function verifySampleOwnership(sampleId: string) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const supabase = await createClient();

    // Join through personas to verify org ownership
    const { data: sample } = await supabase
        .from("persona_writing_samples")
        .select("id, persona_id, filename, storage_url, extracted_text, uploaded_at")
        .eq("id", sampleId)
        .single();

    if (!sample) throw new Error("Writing sample not found");

    // Verify the persona belongs to the user's org
    const { data: persona } = await supabase
        .from("personas")
        .select("id, organization_id")
        .eq("id", sample.persona_id)
        .eq("organization_id", org.id)
        .single();

    if (!persona) throw new Error("Writing sample does not belong to your organization");

    return { org, supabase, sample };
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Upload a writing sample file (.txt, .docx, .pdf) for a persona.
 * Extracts text content and stores both the file and extracted text.
 */
export async function uploadWritingSample(
    personaId: string,
    formData: FormData
): Promise<{ data: PersonaWritingSample | null; error: string | null }> {
    try {
        const { org, supabase } = await verifyPersonaOwnership(personaId);

        const file = formData.get("file") as File | null;
        if (!file) {
            return { data: null, error: "No file provided" };
        }

        const validation = validateFile(file);
        if (!validation.valid) {
            return { data: null, error: validation.error };
        }

        // Extract text before uploading -- fail fast if extraction fails
        let extractedText = "";
        try {
            extractedText = await extractText(file);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { data: null, error: message };
        }

        if (!extractedText || extractedText.trim().length === 0) {
            return { data: null, error: "Could not extract any text from the file. The file may be empty or corrupted." };
        }

        // Build storage path: {org_id}/{persona_id}/{timestamp}-{filename}
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${org.id}/${personaId}/${Date.now()}-${sanitizedFilename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("writing-samples")
            .upload(storagePath, file);

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return { data: null, error: "Failed to upload file to storage" };
        }

        const { data: urlData } = supabase.storage
            .from("writing-samples")
            .getPublicUrl(storagePath);

        // Insert record into persona_writing_samples
        const { data: record, error: insertError } = await supabase
            .from("persona_writing_samples")
            .insert({
                persona_id: personaId,
                filename: file.name,
                storage_url: urlData.publicUrl,
                extracted_text: extractedText.trim(),
            })
            .select()
            .single();

        if (insertError) {
            console.error("DB insert error:", insertError);
            // Clean up the uploaded file since the DB insert failed
            await supabase.storage.from("writing-samples").remove([storagePath]);
            return { data: null, error: "Failed to save writing sample record" };
        }

        revalidatePath(`/dashboard/personas/${personaId}`);
        return { data: record as PersonaWritingSample, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        return { data: null, error: message };
    }
}

/**
 * Delete a writing sample. Removes both the storage file and DB record.
 */
export async function deleteWritingSample(
    sampleId: string
): Promise<{ success: boolean; error: string | null }> {
    try {
        const idSchema = z.string().uuid();
        const parseResult = idSchema.safeParse(sampleId);
        if (!parseResult.success) {
            return { success: false, error: "Invalid sample ID" };
        }

        const { supabase, sample } = await verifySampleOwnership(sampleId);

        // Extract the storage path from the public URL
        // URL format: .../storage/v1/object/public/writing-samples/{path}
        const urlParts = sample.storage_url.split("/writing-samples/");
        const storagePath = urlParts.length > 1 ? urlParts[urlParts.length - 1] : null;

        if (storagePath) {
            const { error: storageError } = await supabase.storage
                .from("writing-samples")
                .remove([decodeURIComponent(storagePath)]);

            if (storageError) {
                console.error("Storage deletion error (non-fatal):", storageError);
                // Continue with DB deletion even if storage fails
            }
        }

        const { error: deleteError } = await supabase
            .from("persona_writing_samples")
            .delete()
            .eq("id", sampleId);

        if (deleteError) {
            console.error("DB delete error:", deleteError);
            return { success: false, error: "Failed to delete writing sample record" };
        }

        revalidatePath(`/dashboard/personas/${sample.persona_id}`);
        return { success: true, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        return { success: false, error: message };
    }
}

/**
 * Get all writing samples for a persona. Validates org ownership.
 */
export async function getWritingSamples(
    personaId: string
): Promise<{ data: PersonaWritingSample[]; error: string | null }> {
    try {
        const idSchema = z.string().uuid();
        const parseResult = idSchema.safeParse(personaId);
        if (!parseResult.success) {
            return { data: [], error: "Invalid persona ID" };
        }

        const { supabase } = await verifyPersonaOwnership(personaId);

        const { data: samples, error } = await supabase
            .from("persona_writing_samples")
            .select("id, persona_id, filename, storage_url, extracted_text, uploaded_at")
            .eq("persona_id", personaId)
            .order("uploaded_at", { ascending: false });

        if (error) {
            console.error("DB query error:", error);
            return { data: [], error: "Failed to fetch writing samples" };
        }

        return { data: (samples || []) as PersonaWritingSample[], error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        return { data: [], error: message };
    }
}
