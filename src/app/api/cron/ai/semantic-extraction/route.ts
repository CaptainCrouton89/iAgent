import { extractSemanticMemories, decaySemanticMemories } from "@/actions/semantic-memory";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function GET() {
  const headersList = await headers();
  const authorization = headersList.get("authorization");

  // Verify the request is from cron
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    
    // First, decay old semantic memories
    await decaySemanticMemories();
    
    // Get all users who have memories
    const { data: users, error: usersError } = await supabase
      .from("memories")
      .select("auth_id")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order("created_at", { ascending: false });

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(users?.map(u => u.auth_id) || [])];
    
    const results = [];
    
    for (const userId of uniqueUserIds) {
      try {
        // Get recent episodic memories for this user
        const { data: recentMemories, error: memoriesError } = await supabase
          .from("memories")
          .select("id, created_at")
          .eq("auth_id", userId)
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .order("created_at", { ascending: false })
          .limit(20); // Process up to 20 recent memories
          
        if (memoriesError || !recentMemories?.length) {
          continue;
        }
        
        // Extract semantic memories from the recent episodic memories
        const extractedMemories = await extractSemanticMemories(
          recentMemories.map(m => m.id),
          userId
        );
        
        results.push({
          userId,
          processedCount: recentMemories.length,
          extractedCount: extractedMemories.length,
        });
        
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "Semantic memory extraction completed",
      results,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error("Error in semantic extraction cron:", error);
    return NextResponse.json(
      { error: "Failed to extract semantic memories" },
      { status: 500 }
    );
  }
}