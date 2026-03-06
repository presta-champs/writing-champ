import type { GenerationResult } from './types';

/**
 * Convert an async generator of text chunks into a ReadableStream
 * suitable for a Next.js streaming Response.
 *
 * The onComplete callback fires after the stream finishes with the final result.
 */
export function generatorToStream(
  generator: AsyncGenerator<string, GenerationResult>,
  onComplete?: (result: GenerationResult) => void,
  onError?: (error: Error) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        let result: IteratorResult<string, GenerationResult>;
        do {
          result = await generator.next();
          if (!result.done && result.value) {
            controller.enqueue(encoder.encode(result.value));
          }
        } while (!result.done);

        // result.value contains the GenerationResult when done
        if (result.value) {
          // Send cost metadata as a trailing marker the client can parse
          const costMarker = `\n<!--GENERATION_COST:${JSON.stringify({
            costUsd: result.value.costUsd,
            model: result.value.model,
            inputTokens: result.value.inputTokens,
            outputTokens: result.value.outputTokens,
          })}-->`;
          controller.enqueue(encoder.encode(costMarker));

          if (onComplete) {
            onComplete(result.value);
          }
        }

        controller.close();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        }
        controller.error(err);
      }
    },
  });
}

/**
 * Create a streaming Response from an async generator.
 * Used in Next.js API routes.
 */
export function streamResponse(
  generator: AsyncGenerator<string, GenerationResult>,
  onComplete?: (result: GenerationResult) => void
): Response {
  const stream = generatorToStream(generator, onComplete);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  });
}
