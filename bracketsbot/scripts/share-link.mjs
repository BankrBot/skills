import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_FRONTEND_BASE_URL = "https://brackets.bot";
const DEFAULT_PREDICTION_OUTPUT_FILE = "./out/model-walk-picks.json";

const loadPredictions = async (filePath) => {
  const raw = await readFile(filePath, "utf8");
  const json = JSON.parse(raw);

  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.predictions)) return json.predictions;

  throw new Error(
    "INVALID_PREDICTIONS: Expected an array of seeds or { predictions: number[] }.",
  );
};

const validatePredictions = (predictions) => {
  if (!Array.isArray(predictions)) {
    throw new Error(
      "INVALID_PREDICTIONS_LENGTH: predictions must be an array of 0..63 winner seeds.",
    );
  }

  if (predictions.length > 63) {
    throw new Error(
      "INVALID_PREDICTIONS_LENGTH: predictions cannot contain more than 63 games.",
    );
  }

  for (const value of predictions) {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 64
    ) {
      throw new Error(
        "INVALID_PREDICTION_VALUE: predictions must contain integer seeds between 1 and 64.",
      );
    }
  }
};

const main = async () => {
  const baseUrl = process.env.FRONTEND_BASE_URL || DEFAULT_FRONTEND_BASE_URL;
  const predictionFile =
    process.env.PREDICTION_OUTPUT_FILE || DEFAULT_PREDICTION_OUTPUT_FILE;

  try {
    const predictions = await loadPredictions(predictionFile);
    validatePredictions(predictions);
    if (predictions.length === 0) {
      throw new Error(
        "INVALID_PREDICTIONS: No picks to share (file empty or missing). Run walk-apply first or pass --predictions-file.",
      );
    }

    // Pad to 63 elements with 0s for the draft API
    const padded = new Array(63).fill(0);
    predictions.forEach((v, i) => {
      padded[i] = v;
    });

    // Create draft session via API
    const apiUrl = `${baseUrl}/api/draft`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: padded }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Draft API returned ${res.status}: ${text}`);
    }

    const { token } = await res.json();
    const shareUrl = `${baseUrl}/?draft=${token}`;
    const draftApiUrl = `${baseUrl}/api/draft/${token}`;

    // Merge draft token into the walk state file
    try {
      const raw = await readFile(predictionFile, "utf8");
      const walkState = JSON.parse(raw);
      walkState.draftToken = token;
      walkState.draftApiUrl = draftApiUrl;
      await writeFile(predictionFile, JSON.stringify(walkState, null, 2) + "\n", "utf8");
    } catch {
      // Best-effort — don't fail if we can't update the walk state
    }

    const output = {
      shareUrl,
      draftToken: token,
      frontendBaseUrl: baseUrl,
      predictionOutputFile: predictionFile,
    };

    process.stdout.write(JSON.stringify(output, null, 2));
  } catch (error) {
    let code = "COMMAND_FAILED";
    let message = error?.message ?? "Failed to generate share link.";
    if (
      error?.message?.startsWith("INVALID_PREDICTIONS") ||
      error?.message?.startsWith("INVALID_PREDICTION_VALUE")
    ) {
      code = "INVALID_PREDICTIONS";
    } else if (error?.code === "ENOENT") {
      code = "FILE_NOT_FOUND";
      message = `Picks file not found: ${predictionFile}. Run walk-apply first for in-progress brackets, or pass --predictions-file ./out/model-bracket-output.json for a full bracket.`;
    }

    process.stderr.write(`${code}: ${message}\n`);
    process.exitCode = 1;
  }
};

main().catch((error) => {
  const message = error?.message ?? "Unknown share-link failure.";
  process.stderr.write(`COMMAND_FAILED: ${message}\n`);
  process.exitCode = 1;
});
