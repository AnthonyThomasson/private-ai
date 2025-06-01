export async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 20,
): Promise<T> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log("❌ Error:", err);
      if (
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("500"))
      ) {
        console.warn(`Retrying after ${delay}ms due to error:`, err.message);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw err; // Non-retryable
      }
    }
  }
  throw new Error("Max retries exceeded.");
}
