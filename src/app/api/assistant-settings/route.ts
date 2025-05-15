import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Error fetching user for assistant settings:", userError);
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    const auth_id = user.id;

    const { data: settings, error: fetchError } = await supabase
      .from("assistant_settings")
      .select("interaction_lessons")
      .eq("auth_id", auth_id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        // Row not found
        return NextResponse.json({ interaction_lessons: [] }); // No settings found, return empty lessons
      }
      console.error("Error fetching assistant_settings:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch assistant settings" },
        { status: 500 }
      );
    }

    let lessons: string[] = [];
    // Strict check: only accept if it's an array and all elements are strings.
    if (
      settings &&
      Array.isArray(settings.interaction_lessons) &&
      settings.interaction_lessons.every((lesson) => typeof lesson === "string")
    ) {
      lessons = settings.interaction_lessons as string[];
    } else if (settings && settings.interaction_lessons) {
      // If it exists but is not a clean string array, log a warning and treat as empty.
      console.warn(
        `Interaction lessons for auth_id ${auth_id} are not a valid string array:`,
        settings.interaction_lessons
      );
    }
    // If settings.interaction_lessons is null/undefined, lessons remains [] by default.

    return NextResponse.json({ interaction_lessons: lessons });
  } catch (error) {
    console.error("Error in assistant-settings route:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
