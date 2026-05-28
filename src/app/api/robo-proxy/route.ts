import { NextResponse } from "next/server";
import { ANOMALY_CLASSES } from "@/lib/constants";

const ROBOFLOW_BASE = "https://api.roboflow.com/dataset";

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
  const project = formData.get("project") as string | null;
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const split = (formData.get("split") as string | null) || "train";
  const annotation = formData.get("annotation") as string | null;

  if (!apiKey || !project || !file || !name) {
    return NextResponse.json(
      { error: "Missing required fields: api_key, project, file, name" },
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
    const uploadUrl = `${ROBOFLOW_BASE}/${project}/upload?api_key=${apiKey}`;

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("name", name);
    uploadFormData.append("split", split);

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      body: uploadFormData,
    });

    const uploadData = await uploadResponse.json();

    if (!uploadResponse.ok) {
      return NextResponse.json(uploadData, { status: uploadResponse.status });
    }

    const imageId = uploadData.id;
    if (!imageId) {
      return NextResponse.json(
        { error: "Upload succeeded but no image ID returned", uploadData },
        { status: 500 }
      );
    }

    if (annotation) {
      const txtName = name.includes('.') ? name.replace(/\.[^/.]+$/, '.txt') : `${name}.txt`;
      const annotateUrl = `${ROBOFLOW_BASE}/${project}/annotate/${imageId}?api_key=${apiKey}&name=${encodeURIComponent(txtName)}`;

      const labelmap: Record<string, string> = {};
      ANOMALY_CLASSES.forEach((cls, idx) => {
        labelmap[String(idx)] = cls;
      });

      const annotatePayload = {
        annotationFile: annotation,
        labelmap,
      };

      const annotateResponse = await fetch(annotateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(annotatePayload),
      });

      if (!annotateResponse.ok) {
        const annotateError = await annotateResponse.text();
        return NextResponse.json(
          {
            error: "Image uploaded but annotation failed",
            imageId,
            annotateError,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      imageId,
      name,
      split,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to upload to Roboflow", message },
      { status: 500 }
    );
  }
}
