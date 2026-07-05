import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getConnectedAccountEmail,
} from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

/**
 * OAuth2 callback. Google redirects here with `?code=...&state=userId`.
 * We exchange the code for tokens and upsert them into CalendarIntegration.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?calendar_error=${encodeURIComponent(error)}`, url.origin),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?calendar_error=missing_code_or_state", url.origin),
    );
  }

  const userId = state;

  try {
    const tokens = await exchangeCodeForTokens(code);

    await prisma.calendarIntegration.upsert({
      where: { userId },
      create: {
        userId,
        provider: "google",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiryDate: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    // Immediately fetch the connected account's email so the Settings UI can
    // show "Connected as: <email>" right away — catching a wrong-account
    // mistake instantly rather than discovering it after events are created.
    const connectedEmail = await getConnectedAccountEmail(userId);
    const params = new URLSearchParams({ calendar_connected: "1" });
    if (connectedEmail) {
      params.set("calendar_email", connectedEmail);
    }

    return NextResponse.redirect(
      new URL(`/settings?${params.toString()}`, url.origin),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/settings?calendar_error=${encodeURIComponent(message)}`, url.origin),
    );
  }
}
