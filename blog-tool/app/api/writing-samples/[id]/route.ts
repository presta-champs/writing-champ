import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { deleteWritingSample } from "@/app/actions/writing-samples";

// ---------------------------------------------------------------------------
// DELETE /api/writing-samples/[id]
// Deletes a writing sample by ID (storage file + DB record)
// ---------------------------------------------------------------------------

const ParamsSchema = z.object({
    id: z.string().uuid("Sample ID must be a valid UUID"),
});

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        const { id } = await params;
        const validation = ParamsSchema.safeParse({ id });
        if (!validation.success) {
            const message = validation.error.issues.map((i) => i.message).join("; ");
            return Response.json({ error: message }, { status: 400 });
        }

        const result = await deleteWritingSample(validation.data.id);

        if (result.error) {
            const status = result.error.includes("Unauthorized") || result.error.includes("does not belong")
                ? 403
                : result.error.includes("not found")
                    ? 404
                    : 400;
            return Response.json({ error: result.error }, { status });
        }

        return Response.json({ success: true });
    } catch (err: unknown) {
        console.error("DELETE /api/writing-samples/[id] error:", err);
        return Response.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
