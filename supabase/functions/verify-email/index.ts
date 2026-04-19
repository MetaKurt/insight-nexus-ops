// On-demand Hunter.io Email Verifier.
// Triggered from the UI by clicking the ✓ icon next to a contact's email.
// Calls Hunter's verifier endpoint, then writes the result back to the
// contacts row so the UI stays in sync.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  contact_id?: string;
  email?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("HUNTER_API_KEY") ?? "";
    if (!apiKey) {
      return json({ error: "HUNTER_API_KEY is not configured." }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as VerifyRequest;
    const contactId = body.contact_id?.trim();
    if (!contactId) {
      return json({ error: "contact_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Look up the contact's email if not provided.
    let email = body.email?.trim() ?? "";
    if (!email) {
      const { data, error } = await sb
        .from("contacts")
        .select("email")
        .eq("id", contactId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data?.email) return json({ error: "Contact has no email to verify" }, 400);
      email = data.email;
    }

    // Hunter Email Verifier
    const url = new URL("https://api.hunter.io/v2/email-verifier");
    url.searchParams.set("email", email);
    url.searchParams.set("api_key", apiKey);

    const r = await fetch(url.toString());
    const payload = await r.json().catch(() => ({}));
    if (!r.ok) {
      return json(
        { error: `Hunter API error ${r.status}`, details: payload },
        r.status,
      );
    }

    const data = payload?.data ?? {};
    const status = data?.status ?? data?.result ?? "unknown";
    const score = typeof data?.score === "number" ? data.score : null;

    // Write back so the UI updates next refetch.
    await sb
      .from("contacts")
      .update({
        email_verification_status: status,
        email_score: score,
        enriched_at: new Date().toISOString(),
        enrichment_provider: "hunter",
      })
      .eq("id", contactId);

    return json({
      ok: true,
      email,
      status,
      score,
      regexp: data?.regexp ?? null,
      gibberish: data?.gibberish ?? null,
      disposable: data?.disposable ?? null,
      webmail: data?.webmail ?? null,
      mx_records: data?.mx_records ?? null,
      smtp_server: data?.smtp_server ?? null,
      smtp_check: data?.smtp_check ?? null,
      accept_all: data?.accept_all ?? null,
      block: data?.block ?? null,
    });
  } catch (err) {
    console.error("verify-email error:", err);
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
