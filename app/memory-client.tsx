"use client";

import { useEffect } from "react";

const MEMORY_BRIDGE = "http://127.0.0.1:4317";

export default function MemoryClient() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let active = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!active || !url.endsWith("/api/chat") || init?.method?.toUpperCase() !== "POST") {
        return originalFetch(input, init);
      }

      try {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
        const query = body?.message;
        if (!query) return originalFetch(input, init);

        const memoryResponse = await originalFetch(`${MEMORY_BRIDGE}/search`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, limit: 8 }),
        });
        if (memoryResponse.ok) {
          const memory = await memoryResponse.json();
          body.memoryHits = Array.isArray(memory.results) ? memory.results : [];
          return originalFetch(input, { ...init, body: JSON.stringify(body) });
        }
      } catch {
        // Die Web-App bleibt auch ohne lokalen Dienst benutzbar.
      }
      return originalFetch(input, init);
    };

    return () => {
      active = false;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
