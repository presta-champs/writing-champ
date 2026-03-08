import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import {
    uploadWritingSample,
    getWritingSamples,
} from "@/app/actions/writing-samples";

// ---------------------------------------------------------------------------
// POST /api/writing-samples
// Accepts multipart form data with fields: personaId, file
// ---------------------------------------------------------------------------

const PostBodySchema = z.object({
    personaId: z.string().uuid("personaId must be a valid UUID"),
});

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse multipart form data
        const formData = await request.formData();
        const personaId = formData.get("personaId") as string | null;

        // Validate personaId
        const validation = PostBodySchema.safeParse({ personaId });
        if (!validation.success) {
            const message = validation.error.issues.map((i) => i.message).join("; ");
            return Response.json({ error: message }, { status: 400 });
        }

        const file = formData.get("file") as File | null;
        if (!file) {
            return Response.json({ error: "No file provided" }, { status: 400 });
        }

        // Build a new FormData to pass to the server action
        const actionFormData = new FormData();
        actionFormData.set("file", file);

        const result = await uploadWritingSample(validation.data.personaId, actionFormData);

        if (result.error) {
            // Determine appropriate status code
            const status = result.error.includes("Unauthorized") || result.error.includes("does not belong")
                ? 403
                : result.error.includes("not found")
                    ? 404
                    : 400;
            return Response.json({ error: result.error }, { status });
        }

        return Response.json({ data: result.data }, { status: 201 });
    } catch (err: unknown) {
        console.error("POST /api/writing-samples error:", err);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// ---------------------------------------------------------------------------
// GET /api/writing-samples?personaId=<uuid>
// Returns all writing samples for a persona
// ---------------------------------------------------------------------------

const GetQuerySchema = z.object({
    personaId: z.string().uuid("personaId must be a valid UUID"),
});

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const personaId = searchParams.get("personaId");

        const validation = GetQuerySchema.safeParse({ personaId });
        if (!validation.success) {
            const message = validation.error.issues.map((i) => i.message).join("; ");
            return Response.json({ error: message }, { status: 400 });
        }

        const result = await getWritingSamples(validation.data.personaId);

        if (result.error) {
            const status = result.error.includes("Unauthorized") || result.error.includes("does not belong")
                ? 403
                : result.error.includes("not found")
                    ? 404
                    : 400;
            return Response.json({ error: result.error }, { status });
        }

        return Response.json({ data: result.data });
    } catch (err: unknown) {
        console.error("GET /api/writing-samples error:", err);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
