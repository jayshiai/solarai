import { NextResponse } from "next/server";

const ROBOFLOW_UPLOAD_BASE = "https://api.roboflow.com/dataset";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const apiKey = formData.get("api_key") as string | null;
  const workspace = formData.get("workspace") as string | null;
  const project = formData.get("project") as string | null;
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const split = (formData.get("split") as string | null) || "train";
  const annotation = formData.get("annotation") as string | null;

  if (!apiKey || !workspace || !project || !file || !name) {
    return NextResponse.json(
      { error: "Missing required fields: api_key, workspace, project, file, name" },
      { status: 400 }
    );
  }

  if (!["train", "valid", "test"].includes(split)) {
    return NextResponse.json(
      { error: "Invalid split value. Must be 'train', 'valid', or 'test'" },
      { status: 400 }
    );
  }

  try {
    const roboflowUrl = `${ROBOFLOW_UPLOAD_BASE}/${workspace}/${project}/upload?api_key=${apiKey}`;

    const roboflowFormData = new FormData();
    roboflowFormData.append("file", file);
    roboflowFormData.append("name", name);
    roboflowFormData.append("split", split);

    if (annotation) {
      roboflowFormData.append("annotation", annotation);
    }

    const roboflowResponse = await fetch(roboflowUrl, {
      method: "POST",
      body: roboflowFormData,
    });

    if (roboflowResponse.status === 429) {
      const retryAfter = roboflowResponse.headers.get("Retry-After") || "60";
      return NextResponse.json(
        { error: "Rate limited by Roboflow" },
        {
          status: 429,
          headers: { "Retry-After": retryAfter },
        }
      );
    }

    if (roboflowResponse.status >= 500) {
      const retryResponse = await fetch(roboflowUrl, {
        method: "POST",
        body: roboflowFormData,
      });

      if (retryResponse.ok) {
        const data = await retryResponse.json();
        return NextResponse.json(data);
      }

      return NextResponse.json(
        { error: "Roboflow service unavailable" },
        { status: 502 }
      );
    }

    const data = await roboflowResponse.json();

    if (!roboflowResponse.ok) {
      return NextResponse.json(data, { status: roboflowResponse.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to upload to Roboflow" },
      { status: 500 }
    );
  }
}