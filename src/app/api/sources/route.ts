import { NextResponse } from "next/server";
import { getSourcesAsync } from "@/lib/db";

export async function GET() {
  try {
    const sources = await getSourcesAsync();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}
