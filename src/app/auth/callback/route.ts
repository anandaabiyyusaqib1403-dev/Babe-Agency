import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

export async function GET(request: NextRequest) {
  const flow = request.nextUrl.searchParams.get("flow") === "invite" ? "invite" : "recovery";
  const destination = new URL("/auth/update-password", request.url);
  destination.searchParams.set("flow", flow);

  const code = request.nextUrl.searchParams.get("code");
  if (!code || !isSupabaseConfigured()) {
    destination.searchParams.set("link", "invalid");
    return NextResponse.redirect(destination);
  }

  const cookieStore = await cookies();
  const env = getPublicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) destination.searchParams.set("link", "invalid");
  return NextResponse.redirect(destination);
}
