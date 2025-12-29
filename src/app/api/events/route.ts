import { NextRequest, NextResponse } from "next/server";
import { getEvents } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const filters = {
    startDate: searchParams.get("start_date") || undefined,
    endDate: searchParams.get("end_date") || undefined,
    area: searchParams.get("area") || undefined,
    category: searchParams.get("category") || undefined,
    search: searchParams.get("search") || undefined,
    source: searchParams.get("source") || undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
  };

  try {
    const { events, total } = getEvents(filters);

    return NextResponse.json({
      events,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit!),
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
