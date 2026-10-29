import sharp from "sharp";
import { configuration } from "../src/config.js";
import { openai } from "../src/ai.js";
// Synthetic non-food image: no personal photos leave this machine during this check.
const image = await sharp({
  create: { width: 128, height: 128, channels: 3, background: "#174a88" },
})
  .jpeg()
  .toBuffer();
try {
  const result = await openai(configuration()).analyze(
    image,
    AbortSignal.timeout(65_000),
  );
  console.log(
    JSON.stringify({
      provider: "OpenAI",
      status: result.status,
      foodCount: result.foods.length,
      structuredOutputValidated: true,
    }),
  );
  if (result.status === "food") process.exitCode = 1;
} catch (error: any) {
  console.error(
    JSON.stringify({
      status: "failed",
      type: error.constructor.name,
      httpStatus: error.status,
      code: error.code || null,
    }),
  );
  process.exitCode = 1;
}
