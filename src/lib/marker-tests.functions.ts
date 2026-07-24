import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CALIBRATION_STEPS = [
  {
    key: "baseline",
    title: "1. Baseline",
    instruction:
      "Bright, even indoor light. Hold the phone parallel to the photo, ~30 cm away, photo filling most of the frame. Note how long until the video starts.",
    lighting: "bright",
    distance_cm: 30,
    angle_deg: 0,
  },
  {
    key: "distance_far",
    title: "2. Distance",
    instruction:
      "Same lighting, step back to ~80 cm so the photo fills about a third of the frame. Does it still lock on?",
    lighting: "bright",
    distance_cm: 80,
    angle_deg: 0,
  },
  {
    key: "angle",
    title: "3. Angle",
    instruction:
      "Back to ~30 cm, tilt the phone about 45° off-axis from the photo. Tracking should hold without jitter.",
    lighting: "bright",
    distance_cm: 30,
    angle_deg: 45,
  },
  {
    key: "low_light",
    title: "4. Low light",
    instruction:
      "Dim the room (evening / single lamp). Repeat the baseline pose. This is the most common real-world failure.",
    lighting: "dim",
    distance_cm: 30,
    angle_deg: 0,
  },
  {
    key: "glare",
    title: "5. Glare / reflection",
    instruction:
      "Point a lamp or window light at the glossy print so there is visible glare. Check whether detection survives.",
    lighting: "glare",
    distance_cm: 30,
    angle_deg: 15,
  },
  {
    key: "motion",
    title: "6. Motion & recovery",
    instruction:
      "While playing, sweep the camera away and back. The video should pause and resume within a second.",
    lighting: "bright",
    distance_cm: 30,
    angle_deg: 0,
  },
  {
    key: "print_size",
    title: "7. Small print",
    instruction:
      "Test the smallest print size you plan to sell (e.g. 4×6). Record whether it is reliable at that size.",
    lighting: "bright",
    distance_cm: 25,
    angle_deg: 0,
  },
] as const;

const TestInput = z.object({
  album_id: z.string().uuid().optional().nullable(),
  marker_label: z.string().min(1).max(160),
  step_key: z.string().min(1).max(40),
  lighting: z.string().min(1).max(40),
  distance_cm: z.number().int().min(1).max(1000).optional().nullable(),
  angle_deg: z.number().int().min(0).max(90).optional().nullable(),
  device: z.string().max(120).optional().nullable(),
  outcome: z.enum(["success", "partial", "fail"]),
  time_to_detect_ms: z.number().int().min(0).max(120000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const listMarkerTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("marker_tests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordMarkerTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => TestInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("marker_tests")
      .insert({ ...data, owner_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMarkerTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marker_tests")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
