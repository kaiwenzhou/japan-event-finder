import { NextResponse } from "next/server";
import { getAreas } from "@/lib/db";

export async function GET() {
  try {
    const areas = getAreas();
    return NextResponse.json({ areas });
  } catch (error) {
    console.error("Error fetching areas:", error);
    return NextResponse.json(
      { error: "Failed to fetch areas" },
      { status: 500 }
    );
  }
}
