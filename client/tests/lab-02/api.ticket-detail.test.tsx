import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiResponseError,
  downloadAttachment,
  getTicketDetail,
  removeAttachment,
  uploadAttachment,
} from "../../src/api.js";

describe("Ticket Detail and attachment API client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests owned detail with the supplied abort signal", async () => {
    const controller = new AbortController();
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 145, attachments: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await getTicketDetail(requesterTransport, 145, controller.signal);
    expect(requesterTransport).toHaveBeenCalledWith("/api/tickets/145", {
      signal: controller.signal,
    });
  });

  it("uploads exactly one file using FormData without overriding its boundary", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 51 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const file = new File(["png"], "proof.png", { type: "image/png" });

    await uploadAttachment(requesterTransport, 145, file);

    const [path, init] = requesterTransport.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/tickets/145/attachments");
    expect(init.method).toBe("POST");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBe(file);
    expect(Array.from((init.body as FormData).keys())).toEqual(["file"]);
  });

  it("downloads protected bytes and decodes the safe UTF-8 filename", async () => {
    const bytes = new Blob(["pdf"], { type: "application/pdf" });
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": "attachment; filename=\"report.pdf\"; filename*=UTF-8''report%20final.pdf",
        },
      }),
    );

    const result = await downloadAttachment(requesterTransport, 145, 51);
    expect(requesterTransport).toHaveBeenCalledWith(
      "/api/tickets/145/attachments/51/download",
    );
    expect(result.fileName).toBe("report final.pdf");
    expect(result.blob).toBeTruthy();
  });

  it("sends the trimmed removal reason contract as JSON", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 51, isRemoved: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await removeAttachment(requesterTransport, 145, 51, "Uploaded a clearer report.");
    expect(requesterTransport).toHaveBeenCalledWith(
      "/api/tickets/145/attachments/51/remove",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "Uploaded a clearer report." }),
      },
    );
  });

  it("preserves the documented safe attachment error", async () => {
    const requesterTransport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "ATTACHMENT_NOT_AVAILABLE",
          message: "Attachment is not available.",
        },
      }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(downloadAttachment(requesterTransport, 145, 51)).rejects.toEqual(
      new ApiResponseError(404, "ATTACHMENT_NOT_AVAILABLE", "Attachment is not available."),
    );
  });
});
