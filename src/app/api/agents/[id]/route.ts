import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Get a specific agent by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Get the agent
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .eq("owner", userId)
      .single();

    if (error) {
      console.error("Error fetching agent:", error);
      return NextResponse.json(
        { error: "Failed to fetch agent" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Update an agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Get request body
    const updatedAgent = await request.json();

    // Check if the agent exists and belongs to the user
    const { data: existingAgent, error: fetchError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", id)
      .eq("owner", userId)
      .single();

    if (fetchError || !existingAgent) {
      return NextResponse.json(
        { error: "Agent not found or you do not have permission to update it" },
        { status: 404 }
      );
    }

    // Update the agent
    const { data, error } = await supabase
      .from("agents")
      .update({
        title: updatedAgent.title,
        goal: updatedAgent.goal,
        agent_type: updatedAgent.agent_type,
        background: updatedAgent.background,
        is_active: updatedAgent.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating agent:", error);
      return NextResponse.json(
        { error: "Failed to update agent" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// Delete an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from session
    const userId = session.user.id;

    // Check if the agent exists and belongs to the user
    const { data: existingAgent, error: fetchError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", id)
      .eq("owner", userId)
      .single();

    if (fetchError || !existingAgent) {
      return NextResponse.json(
        { error: "Agent not found or you do not have permission to delete it" },
        { status: 404 }
      );
    }

    // Delete the agent
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id)
      .eq("owner", userId);

    if (error) {
      console.error("Error deleting agent:", error);
      return NextResponse.json(
        { error: "Failed to delete agent" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
