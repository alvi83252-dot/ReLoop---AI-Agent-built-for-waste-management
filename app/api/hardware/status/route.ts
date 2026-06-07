import { NextResponse } from "next/server";
import { checkDgxHealth, checkZgxHealth, isHardwareMode } from "@/lib/config/hardware";

export async function GET() {
  const [zgx, dgx] = await Promise.all([checkZgxHealth(), checkDgxHealth()]);

  return NextResponse.json({
    hardwareMode: isHardwareMode(),
    zgx: {
      label: "HP ZGX Nano AI Station",
      configured: Boolean(zgx.url),
      online: zgx.online,
      url: zgx.url,
      detail: zgx.detail,
    },
    dgx: {
      label: "NVIDIA DGX Spark",
      configured: Boolean(dgx.url),
      online: dgx.online,
      url: dgx.url,
      detail: dgx.detail,
    },
    loop: "ZGX Nano → DGX Spark → ZGX Nano",
  });
}
