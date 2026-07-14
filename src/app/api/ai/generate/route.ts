/**
 * POST /api/ai/generate — GLM-powered AI generation across 6 modules.
 *
 * Body: {
 *   module: "video_concept" | "video_script" | "video_visual" |
 *           "meeting_summary" | "bulletin_polish" | "quiz_generate",
 *   prompt: string,
 *   context?: Record<string, unknown>
 * }
 *
 * - Requires `ai_generate:read` permission (per PRD §3 RBAC).
 * - Rate-limited to 10 calls/min/user (rateLimit).
 * - Calls z-ai-web-dev-sdk GLM; logs to AiGenerationLog + AuditLog.
 * - On SDK error: returns 502, still logs with success=false.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ZAI from "z-ai-web-dev-sdk";
import { requirePermission, validateBody, audit, apiError } from "@/lib/api/helpers";
import { rateLimit } from "@/lib/security";
import { db } from "@/lib/db";

const SYSTEM_PROMPTS: Record<string, string> = {
  video_concept:
    "Anda adalah pengarah kreatif untuk video Kemerdekaan Malaysia. Berdasarkan tema, janakan 3 cadangan konsep kreatif dalam Bahasa Malaysia. Setiap konsep: tajuk, ringkasan (2-3 ayat), nada (tone), dan mood board huraian teks. Format sebagai senarai bernombor.",
  video_script:
    "Anda adalah penulis skrip video. Berdasarkan konsep/tema, janakan draf skrip naratif video pendek (60-90 saat) dalam Bahasa Malaysia. Sertakan tag [ADEGAN N] untuk setiap adegan dan baris narator. Maksimum 5 adegan.",
  video_visual:
    "Anda adalah pakar visual effects. Berdasarkan huraian adegan, janakan 'prompt' visual terperinci dalam Bahasa Inggeris yang sesuai untuk alat penjanaan imej/video AI. Sertakan: komposisi, pencahayaan, palet warna, gaya sinematik, resolusi. Maksimum 80 patah perkataan.",
  meeting_summary:
    "Anda adalah setiausaha mesyuarat. Berdasarkan nota mentah, janakan ringkasan berstruktur: Pengenalan, Isi Utama (3-5 perkara), Keputusan, Tindakan Susulan (dengan pemilik jika boleh dikesan). Bahasa Malaysia.",
  bulletin_polish:
    "Anda adalah editor pengumuman rasmi jabatan. Baiki gaya bahasa pengumuman ini menjadi lebih rasmi dan jelas tanpa mengubah maksud asal. Bahasa Malaysia. Kekalkan fakta.",
  quiz_generate:
    "Anda adalah jurulatih kursus dron. Berdasarkan kandungan pelajaran, janakan 3 soalan aneka pilihan (4 pilihan setiap soalan) dengan jawapan betul dan penjelasan ringkas. Format JSON: [{question, options:[4], correctIndex, explanation}].",
};

const schema = z.object({
  module: z.enum([
    "video_concept",
    "video_script",
    "video_visual",
    "meeting_summary",
    "bulletin_polish",
    "quiz_generate",
  ]),
  prompt: z.string().min(1).max(8000),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requirePermission("ai_generate", "read");
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const parsed = validateBody(schema, body);
  if (parsed instanceof NextResponse) return parsed;

  // Rate limit: 10 calls per minute per user
  const rateKey = `ai:${ctx.userId}`;
  if (!rateLimit(rateKey, 10, 10)) {
    return apiError(
      "Had kadar permintaan AI dicapai (10/min). Sila cuba sebentar lagi.",
      429
    );
  }

  const systemPrompt = SYSTEM_PROMPTS[parsed.module];

  // Build user message — append context hints if provided
  const ctxHints: string[] = [];
  if (parsed.context) {
    if (typeof parsed.context.theme === "string") {
      ctxHints.push(`Tema: ${parsed.context.theme}`);
    }
    if (typeof parsed.context.concept === "string") {
      ctxHints.push(`Konsep: ${parsed.context.concept}`);
    }
    if (typeof parsed.context.scene === "string") {
      ctxHints.push(`Adegan: ${parsed.context.scene}`);
    }
    if (typeof parsed.context.notes === "string") {
      ctxHints.push(`Nota: ${parsed.context.notes}`);
    }
    if (typeof parsed.context.lesson === "string") {
      ctxHints.push(`Pelajaran: ${parsed.context.lesson}`);
    }
  }
  const userMessage =
    ctxHints.length > 0
      ? `${ctxHints.join("\n")}\n\n${parsed.prompt}`
      : parsed.prompt;

  const models = ["glm-4.6", "glm-4.5"]; // try in order; SDK falls back if a model is unavailable
  let responseContent: string | null = null;
  let tokensUsed: number | null = null;
  let usedModel: string | null = null;
  let lastError: string | null = null;

  try {
    const zai = await ZAI.create();
    let lastResp: any = null;
    for (const model of models) {
      try {
        lastResp = await zai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        });
        usedModel = model;
        break;
      } catch (e: any) {
        lastError = e?.message ?? String(e);
        // try next model
      }
    }
    if (!lastResp) {
      throw new Error(lastError ?? "GLM API call failed for all models");
    }
    responseContent =
      lastResp?.choices?.[0]?.message?.content ??
      lastResp?.content ??
      null;
    tokensUsed =
      lastResp?.usage?.total_tokens ??
      lastResp?.usage?.completion_tokens ??
      null;
  } catch (err: any) {
    const errorMessage = err?.message ?? String(err);
    // Log failure
    await db.aiGenerationLog.create({
      data: {
        userId: ctx.userId,
        module: parsed.module,
        prompt: parsed.prompt,
        response: null,
        tokensUsed: null,
        model: usedModel ?? "glm-4.6",
        success: false,
        errorMessage,
      },
    });
    await audit(ctx, "ai.generate", "ai_generation_log", null, {
      module: parsed.module,
      success: false,
      error: errorMessage,
    });
    return apiError(`Penghasilan AI gagal: ${errorMessage}`, 502);
  }

  if (!responseContent) {
    const errorMessage = "Respons GLM kosong";
    await db.aiGenerationLog.create({
      data: {
        userId: ctx.userId,
        module: parsed.module,
        prompt: parsed.prompt,
        response: null,
        tokensUsed: null,
        model: usedModel ?? "glm-4.6",
        success: false,
        errorMessage,
      },
    });
    await audit(ctx, "ai.generate", "ai_generation_log", null, {
      module: parsed.module,
      success: false,
      error: errorMessage,
    });
    return apiError(errorMessage, 502);
  }

  // Log success
  await db.aiGenerationLog.create({
    data: {
      userId: ctx.userId,
      module: parsed.module,
      prompt: parsed.prompt,
      response: responseContent,
      tokensUsed: tokensUsed ?? null,
      model: usedModel ?? "glm-4.6",
      success: true,
      errorMessage: null,
    },
  });

  await audit(ctx, "ai.generate", "ai_generation_log", null, {
    module: parsed.module,
    success: true,
    tokensUsed,
    model: usedModel,
  });

  return NextResponse.json({
    content: responseContent,
    module: parsed.module,
    tokensUsed,
    model: usedModel,
  });
}
