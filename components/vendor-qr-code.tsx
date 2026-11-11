"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { QrCode, Download, Copy, Check, Sparkles, BadgeCheck } from "@/components/icons";
import { toast } from "sonner";
import type { Vendor } from "@/components/sheplates-v3";

/** Helper to safely load an image for canvas drawing with cross-origin fallback */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback without crossOrigin for local/data/blob assets
      const fallback = new window.Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = () => resolve(null);
      fallback.src = src;
    };
    img.src = src;
  });
}

/** Helper to draw rounded rectangles on canvas */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill?: string,
  stroke?: string,
  lineWidth = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/** Helper to wrap text cleanly on canvas */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return lines.length * lineHeight;
}

/** Generates a high-resolution (1200x1600) promotional brochure PNG on canvas */
async function generateStoreBrochurePng({
  vendorName,
  vendorCategory,
  vendorAddress,
  vendorLogoUrl,
  qrDataUrl,
  shopUrl,
}: {
  vendorName: string;
  vendorCategory: string;
  vendorAddress: string;
  vendorLogoUrl?: string;
  qrDataUrl: string;
  shopUrl: string;
}): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  // 1. Clean, white light background (premium print-ready food brand aesthetic)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 1200, 1600);

  // Outer decorative border
  drawRoundedRect(ctx, 24, 24, 1152, 1552, 32, "#FFFFFF", "rgb(226, 236, 233)", 4);
  drawRoundedRect(ctx, 36, 36, 1128, 1528, 24, undefined, "rgb(240, 246, 245)", 2);

  // 2. Top Header - ShePlates Brand Bar
  drawRoundedRect(ctx, 48, 48, 1104, 130, 24, "#155F65");

  // Load ShePlates Logo/Wordmark
  const sheplatesWordmark = await loadImage("/brand/sheplates-wordmark-coral.png");
  if (sheplatesWordmark) {
    const logoH = 50;
    const logoW = Math.round(logoH * 3.304);
    ctx.drawImage(sheplatesWordmark, 80, 88, logoW, logoH);
  } else {
    ctx.fillStyle = "rgb(241, 91, 90)";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ShePlates", 80, 128);
  }

  // Tagline next to wordmark
  ctx.fillStyle = "rgb(189, 225, 227)";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("HYPERLOCAL FOOD & KITCHEN NETWORK", 270, 123);

  // Verified Partner Pill
  drawRoundedRect(ctx, 880, 85, 230, 48, 24, "rgb(14, 67, 71)", "rgb(29, 117, 124)", 1.5);
  ctx.fillStyle = "rgb(138, 196, 63)";
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("★ VERIFIED PARTNER", 880 + 115, 115);

  // 3. Vendor Hero Spotlight Card
  drawRoundedRect(ctx, 80, 205, 1040, 310, 28, "rgb(247, 250, 249)", "rgb(223, 237, 233)", 2);

  const avatarCenterX = 600;
  const avatarCenterY = 285;
  const avatarRadius = 56;

  // Outer rings for avatar
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 6, 0, Math.PI * 2);
  ctx.fillStyle = "#155F65";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 3, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  let vendorImg: HTMLImageElement | null = null;
  if (vendorLogoUrl) {
    vendorImg = await loadImage(vendorLogoUrl);
  }

  if (vendorImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      vendorImg,
      avatarCenterX - avatarRadius,
      avatarCenterY - avatarRadius,
      avatarRadius * 2,
      avatarRadius * 2
    );
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#EAF4F2";
    ctx.fill();
    ctx.fillStyle = "#155F65";
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((vendorName[0] || "S").toUpperCase(), avatarCenterX, avatarCenterY);
  }

  // Vendor Name
  ctx.fillStyle = "#202827";
  ctx.font = "900 38px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(vendorName, 600, 385);

  // Category & Locality
  ctx.fillStyle = "#155F65";
  ctx.font = "bold 20px sans-serif";
  const subtitle = [vendorCategory, vendorAddress].filter(Boolean).join(" · ");
  ctx.fillText(subtitle, 600, 422);

  // Service Highlights Badges
  const badgeY = 458;
  const badgeH = 36;
  const badges = [
    { label: "🍲 Cooked Fresh Daily", width: 220 },
    { label: "⚡ Instant Ordering", width: 200 },
    { label: "🛡️ 100% Certified", width: 190 },
  ];
  const totalBadgesWidth = badges.reduce((sum, b) => sum + b.width, 0) + 24;
  let startX = 600 - totalBadgesWidth / 2;
  for (const b of badges) {
    drawRoundedRect(ctx, startX, badgeY, b.width, badgeH, 18, "#EAF4F2", "rgb(205, 229, 225)", 1);
    ctx.fillStyle = "#155F65";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.label, startX + b.width / 2, badgeY + 23);
    startX += b.width + 12;
  }

  // 4. Promotional Dialogue Section
  drawRoundedRect(ctx, 80, 540, 1040, 140, 24, "rgb(255, 251, 245)", "rgb(247, 232, 214)", 2);

  ctx.fillStyle = "rgb(212, 107, 40)";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✦ FRESH FROM OUR KITCHEN TO YOUR TABLE ✦", 600, 574);

  ctx.fillStyle = "rgb(74, 59, 50)";
  ctx.font = "italic 20px sans-serif";
  const promoDialogue =
    "“Handcrafted with authentic flavours and fresh ingredients. Scan our QR code to explore today's live menu, daily food drops, and order freshly prepared meals delivered straight to your door!”";
  drawWrappedText(ctx, promoDialogue, 600, 610, 920, 28);

  // 5. QR Code Showcase Card (Center Stage)
  drawRoundedRect(ctx, 160, 705, 880, 650, 32, "#FFFFFF", "#155F65", 4);

  // Call to action banner inside QR card
  ctx.fillStyle = "#155F65";
  ctx.font = "900 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SCAN. EXPLORE. ORDER FRESH!", 600, 762);

  ctx.fillStyle = "#55656A";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("Point your phone camera to open our store directly", 600, 796);

  // Load and draw the QR code
  const qrImg = await loadImage(qrDataUrl);
  if (qrImg) {
    ctx.drawImage(qrImg, 380, 825, 440, 440);
  }

  // Direct URL bar inside QR card
  drawRoundedRect(ctx, 220, 1285, 760, 44, 22, "rgb(244, 248, 247)", "rgb(221, 236, 233)", 1.5);
  ctx.fillStyle = "#155F65";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  const displayUrl = shopUrl.length > 60 ? `${shopUrl.slice(0, 57)}…` : shopUrl;
  ctx.fillText(`Direct link: ${displayUrl}`, 600, 1313);

  // 6. Footer / Brand Tagline
  ctx.fillStyle = "#155F65";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ShePlates — Fresh Home Meals & Local Kitchens, Made Simple", 600, 1420);

  ctx.fillStyle = "#55656A";
  ctx.font = "17px sans-serif";
  ctx.fillText("Empowering authentic home chefs & independent kitchens in your neighbourhood", 600, 1455);

  ctx.fillStyle = "rgb(120, 144, 156)";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText("Available on Web, Android & iPhone · Share on WhatsApp · Print for Counter", 600, 1490);

  return canvas.toDataURL("image/png");
}

/** Scanning this opens Sheplates directly at this vendor's shop (see the
 * "?vendor=" query-param handling in sheplates-entry.tsx / sheplates-v3.tsx —
 * there's no path router in this app, so a query param is the deep link). A
 * signed-out scan is prompted to sign in first; an already signed-in
 * customer lands straight in Marketplace filtered to this vendor, ready to
 * Add to Cart or Schedule. */
export function VendorQrCode({
  vendorId,
  vendorName,
  vendor,
  vendorLogo,
  vendorCategory,
  vendorAddress,
  vendorBio,
}: {
  vendorId: string;
  vendorName: string;
  vendor?: Partial<Vendor>;
  vendorLogo?: string;
  vendorCategory?: string;
  vendorAddress?: string;
  vendorBio?: string;
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [brochureUrl, setBrochureUrl] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);

  const resolvedLogo = vendor?.logoUrl || vendorLogo || "";
  const resolvedCategory = vendor?.category || vendorCategory || "Fresh Kitchen";
  const resolvedAddress = vendor?.address || vendorAddress || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}?vendor=${vendorId}`;
    setShopUrl(url);

    let isMounted = true;
    setGenerating(true);

    QRCode.toDataURL(url, {
      width: 500,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#155F65", light: "#ffffff" },
    })
      .then(async (qrData) => {
        if (!isMounted) return;
        setDataUrl(qrData);

        // Dynamically compose the high-res promotional brochure PNG
        try {
          const brochure = await generateStoreBrochurePng({
            vendorName,
            vendorCategory: resolvedCategory,
            vendorAddress: resolvedAddress,
            vendorLogoUrl: resolvedLogo,
            qrDataUrl: qrData,
            shopUrl: url,
          });
          if (isMounted) {
            setBrochureUrl(brochure);
          }
        } catch (err) {
          console.error("Could not generate brochure canvas:", err);
          if (isMounted) setBrochureUrl(qrData);
        } finally {
          if (isMounted) setGenerating(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDataUrl("");
          setBrochureUrl("");
          setGenerating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId, vendorName, resolvedLogo, resolvedCategory, resolvedAddress]);

  const copyLink = useCallback(() => {
    if (!shopUrl) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shopUrl).then(() => {
        setCopied(true);
        toast.success("Store link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        toast.info(shopUrl);
      });
    } else {
      toast.info(shopUrl);
    }
  }, [shopUrl]);

  const fileSlug = vendorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return (
    <div className="surface-card rounded-[26px] p-4 sm:p-6" data-testid="vendor-qr-brochure-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#202827]">
            <QrCode className="size-5 text-[#155F65]" />
            <h3 className="text-lg font-black tracking-[-.02em]">Your shop QR code &amp; promotional brochure</h3>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Generate and download a print-ready, high-resolution promotional brochure. Customers scan the QR code to open your store directly.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#EAF4F2] px-3 py-1 text-xs font-bold text-[#155F65]">
          <Sparkles className="size-3.5" /> Ready for WhatsApp &amp; Print
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Left: Responsive Live Brochure Preview Card */}
        <div className="overflow-hidden rounded-3xl border-2 border-[#155F65]/20 bg-white shadow-md transition hover:shadow-lg">
          {/* Top Brand Banner */}
          <div className="bg-[#155F65] p-3 text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-black tracking-wider text-rose-500">ShePlates</span>
              <span className="rounded-full bg-[#0F4A4F] px-2 py-0.5 text-[9px] font-black uppercase text-emerald-400">
                ★ Verified Partner
              </span>
            </div>
          </div>

          <div className="p-4 text-center">
            {/* Vendor Avatar */}
            <div className="mx-auto mb-2.5 size-16 overflow-hidden rounded-2xl border-2 border-[#155F65] bg-[#EAF4F2] shadow-sm">
              {resolvedLogo ? (
                <img src={resolvedLogo} alt={vendorName} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xl font-black text-[#155F65]">
                  {vendorName[0] || "S"}
                </div>
              )}
            </div>

            <h4 className="text-base font-black text-stone-900">{vendorName}</h4>
            <p className="text-[11px] font-bold text-[#155F65]">{resolvedCategory}</p>

            {/* Promotional Dialogue */}
            <div className="my-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-2.5 text-center">
              <p className="text-[11px] italic leading-snug text-stone-700">
                “Handcrafted with authentic flavours. Scan our QR code to explore today&apos;s live menu, food drops &amp; order fresh!”
              </p>
            </div>

            {/* QR Code Container */}
            <div className="mx-auto my-2 grid size-44 place-items-center overflow-hidden rounded-2xl border-2 border-[#155F65] bg-white p-2 shadow-inner">
              {dataUrl ? (
                <Image
                  src={dataUrl}
                  alt={`QR code for ${vendorName}`}
                  width={160}
                  height={160}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-stone-400">Generating QR…</span>
              )}
            </div>

            <p className="mt-2 text-xs font-black tracking-wide text-[#155F65]">
              SCAN. EXPLORE. ORDER FRESH!
            </p>
            <p className="text-[10px] text-stone-500">Point your camera to order directly</p>

            <div className="mt-3 border-t border-stone-100 pt-2 text-[10px] font-semibold text-stone-400">
              ShePlates · Fresh Home Meals &amp; Local Kitchens
            </div>
          </div>
        </div>

        {/* Right: Actions & Sharing Options */}
        <div className="flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-black text-stone-800">Shareable Store Brochure &amp; Standee</h4>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                This brochure is created dynamically with your store branding, official verification badge, promotional dialogues, and a high-resolution QR code.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-600">Your Direct Store Link</label>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 overflow-hidden truncate rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                  {shopUrl || "Generating store link…"}
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copy store link"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-black text-stone-700 transition hover:border-[#155F65] hover:text-[#155F65]"
                >
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-[#EAF4F2]/60 p-3.5">
              <h5 className="flex items-center gap-1.5 text-xs font-black text-[#155F65]">
                <Sparkles className="size-3.5" /> Best Ways to Use Your Brochure
              </h5>
              <ul className="mt-1.5 space-y-1 text-xs text-stone-600">
                <li>• <b>WhatsApp Stories &amp; Chat:</b> Share the downloaded brochure with customers.</li>
                <li>• <b>Counter Standee:</b> Print on A5 or cardstock for your counter or register.</li>
                <li>• <b>Packaging Insert:</b> Slip a mini printout into every order bag for repeat orders.</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3">
            {/* Primary Download: Full High-Res Promotional Brochure */}
            {brochureUrl && (
              <a
                href={brochureUrl}
                download={`${fileSlug}-store-brochure.png`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155F65] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#0F4A4F]"
              >
                <Download className="size-4" />
                Download QR Brochure (PNG)
              </a>
            )}

            {/* Secondary Download: Standalone Square QR Code */}
            {dataUrl && (
              <a
                href={dataUrl}
                download={`${fileSlug}-qr.png`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-black text-stone-700 transition hover:border-[#155F65] hover:text-[#155F65]"
              >
                <QrCode className="size-4" />
                Download QR Code Only
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
