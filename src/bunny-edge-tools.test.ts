import { describe, expect, test, vi } from "vitest";
import { provisionBunnyEdgeUploadSigner } from "./bunny-edge-tools.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeOptions(fetch: typeof globalThis.fetch) {
  return {
    bunnyAccountApiKey: "account-key",
    storageZoneName: "storage-zone",
    storageAccessKey: "storage-key",
    region: "ny",
    signerHostname: "uploads.example.com",
    signerPath: "/sign",
    signerAccessKey: "edge-access-key",
    fetch,
  };
}

describe("provisionBunnyEdgeUploadSigner", () => {
  test("validates required setup-only config before calling Bunny", async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;

    const result = await provisionBunnyEdgeUploadSigner({
      bunnyAccountApiKey: "",
      storageZoneName: "zone",
      storageAccessKey: "storage-key",
      signerHostname: "uploads.example.com",
      fetch,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: "missing_config" },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("creates and configures a Bunny edge upload signer", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ Items: [] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            Id: 123,
            Name: "convex-fs upload signer uploads.example.com",
            LinkedPullZones: [{ Id: 456, PullZoneName: "uploads" }],
          },
          201,
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({ Id: 1, Name: "STORAGE_ACCESS_KEY" }),
      )
      .mockResolvedValueOnce(jsonResponse({ Id: 2, Name: "SIGNER_ACCESS_KEY" }))
      .mockResolvedValueOnce(jsonResponse({ Id: 3, Name: "STORAGE_ZONE_NAME" }))
      .mockResolvedValueOnce(jsonResponse({ Id: 4, Name: "STORAGE_REGION" }))
      .mockResolvedValueOnce(
        jsonResponse({ Id: 5, Name: "UPLOAD_TTL_SECONDS" }),
      )
      .mockResolvedValueOnce(jsonResponse({ Id: 6, Name: "MAX_UPLOAD_BYTES" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await provisionBunnyEdgeUploadSigner(makeOptions(fetch));

    expect(result).toEqual({
      ok: true,
      scriptId: 123,
      pullZoneId: 456,
      signUrl: "https://uploads.example.com/sign",
      accessKey: "edge-access-key",
      env: {
        BUNNY_EDGE_UPLOAD_SIGN_URL: "https://uploads.example.com/sign",
        BUNNY_EDGE_UPLOAD_ACCESS_KEY: "edge-access-key",
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.bunny.net/compute/script?type=1&page=1&perPage=1000&search=convex-fs%20upload%20signer%20uploads.example.com&includeLinkedPullzones=true",
      {
        method: "GET",
        headers: {
          AccessKey: "account-key",
          "Content-Type": "application/json",
        },
      },
    );

    const createBody = JSON.parse(
      (fetch.mock.calls[1][1]?.body as string | undefined) ?? "{}",
    );
    expect(createBody).toMatchObject({
      Name: "convex-fs upload signer uploads.example.com",
      ScriptType: 1,
      CreateLinkedPullZone: true,
      LinkedPullZoneName: "convex-fs-upload-uploads-example-com",
    });
    expect(createBody.Code).toContain('request.headers.get("AccessKey")');
    expect(createBody.Code).toContain("fileSizeInBytes");
    expect(createBody.Code).toContain("checksum");
    expect(createBody.Code).toContain(
      "https://esm.sh/@bunny.net/edgescript-sdk@0.11.2",
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://api.bunny.net/pullzone/456/addHostname",
      {
        method: "POST",
        headers: {
          AccessKey: "account-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ Hostname: "uploads.example.com" }),
      },
    );
  });

  test("returns explicit auth and route failures from Bunny", async () => {
    const authFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 401 }));

    await expect(
      provisionBunnyEdgeUploadSigner(makeOptions(authFetch)),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "auth_failed", status: 401 },
    });

    const routeFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ Items: [] }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            Id: 123,
            LinkedPullZones: [{ Id: 456 }],
          },
          201,
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ Id: 1, Name: "STORAGE_ACCESS_KEY" }))
      .mockResolvedValueOnce(jsonResponse({ Id: 2, Name: "SIGNER_ACCESS_KEY" }))
      .mockResolvedValueOnce(jsonResponse({ Id: 3, Name: "STORAGE_ZONE_NAME" }))
      .mockResolvedValueOnce(jsonResponse({ Id: 4, Name: "STORAGE_REGION" }))
      .mockResolvedValueOnce(
        jsonResponse({ Id: 5, Name: "UPLOAD_TTL_SECONDS" }),
      )
      .mockResolvedValueOnce(jsonResponse({ Id: 6, Name: "MAX_UPLOAD_BYTES" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({ Message: "Hostname already exists" }, 400),
      );

    await expect(
      provisionBunnyEdgeUploadSigner(makeOptions(routeFetch)),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "route_conflict", status: 400 },
    });
  });
});
