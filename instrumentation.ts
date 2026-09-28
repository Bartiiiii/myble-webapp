import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";

/** The logger is stashed on globalThis so route handlers can reach it without
 *  re-initialising the provider. Typed off `getLogger` rather than `any`. */
type PosthogGlobal = typeof globalThis & {
  __posthogLogger?: ReturnType<LoggerProvider["getLogger"]>;
};

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const exporter = new OTLPLogExporter({
      url: "https://eu.i.posthog.com/otlp/v1/logs",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN}`,
      },
    });

    const loggerProvider = new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "myble-webapp" }),
      processors: [new SimpleLogRecordProcessor(exporter)],
    });

    (globalThis as PosthogGlobal).__posthogLogger = loggerProvider.getLogger("myble-webapp");
  }
}
