import { NextResponse } from "next/server";
import { getSources } from "@/lib/db";

export async function GET() {
  try {
    const sources = getSources();
    return NextResponse.json({ sources });
  } catch (error) {
    console.error("Error fetching sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    );
  }
}
