import { NextResponse } from "next/server";
import { getAreasAsync } from "@/lib/db";

export async function GET() {
  try {
    const areas = await getAreasAsync();
    return NextResponse.json({ areas });
  } catch (error) {
    console.error("Error fetching areas:", error);
    return NextResponse.json(
      { error: "Failed to fetch areas" },
      { status: 500 }
    );
  }
}
