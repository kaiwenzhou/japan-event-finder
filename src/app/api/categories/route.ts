import { NextResponse } from "next/server";
import { getCategoriesAsync } from "@/lib/db";

export async function GET() {
  try {
    const categories = await getCategoriesAsync();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
