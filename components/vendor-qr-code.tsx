"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { QrCode, Download, Copy, Check, Sparkles, BadgeCheck, Store, MapPin } from "@/components/icons";
import { toast } from "sonner";
import type { Vendor } from "@/components/sheplates-v3";

/** Official approved tagline for ShePlates promotional materials */
export const SHEPLATES_BROCHURE_TAGLINE = "ShePlates — Fresh Home Meals & Local Kitchens, Made Simple";

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

/** Helper to draw 4 corner brackets around the QR code on canvas */
function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  armLength: number,
  lineWidth: number,
  strokeColor: string,
  radius = 12
) {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Top-Left ┌
  ctx.beginPath();
  ctx.moveTo(x, y + armLength);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(x + armLength, y);
  ctx.stroke();

  // Top-Right ┐
  ctx.beginPath();
  ctx.moveTo(x + width - armLength, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + armLength);
  ctx.stroke();

  // Bottom-Left └
  ctx.beginPath();
  ctx.moveTo(x, y + height - armLength);
  ctx.lineTo(x, y + height - radius);
  ctx.quadraticCurveTo(x, y + height, x + radius, y + height);
  ctx.lineTo(x + armLength, y + height);
  ctx.stroke();

  // Bottom-Right ┘
  ctx.beginPath();
  ctx.moveTo(x + width - armLength, y + height);
  ctx.lineTo(x + width - radius, y + height);
  ctx.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  ctx.lineTo(x + width, y + height - armLength);
  ctx.stroke();

  ctx.restore();
}

/** Helper to draw verified checkmark badge on canvas */
function drawVerifiedBadge(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  badgeColor = "#7CEB71"
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor;
  ctx.fill();

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(2.5, radius * 0.22);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(centerX - radius * 0.45, centerY);
  ctx.lineTo(centerX - radius * 0.1, centerY + radius * 0.35);
  ctx.lineTo(centerX + radius * 0.45, centerY - radius * 0.35);
  ctx.stroke();
  ctx.restore();
}

/** Helper to draw a pin icon on canvas */
function drawMapPinIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = "#7CEB71"
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -size * 0.6, size * 0.5, 0, Math.PI, true);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0A3833";
  ctx.beginPath();
  ctx.arc(0, -size * 0.6, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Helper to draw a storefront icon on canvas */
function drawStorefrontIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = "#FFFFFF"
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Awning top
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.15);
  ctx.lineTo(-size * 0.35, -size * 0.45);
  ctx.lineTo(size * 0.35, -size * 0.45);
  ctx.lineTo(size * 0.45, -size * 0.15);
  ctx.closePath();
  ctx.stroke();

  // Awning bottom line
  ctx.beginPath();
  ctx.moveTo(-size * 0.45, -size * 0.15);
  ctx.lineTo(size * 0.45, -size * 0.15);
  ctx.stroke();

  // Body walls & door
  ctx.strokeRect(-size * 0.38, -size * 0.15, size * 0.76, size * 0.6);
  ctx.fillRect(-size * 0.14, size * 0.05, size * 0.28, size * 0.4);
  ctx.restore();
}

/** Helper to draw leaf icon on canvas */
function drawLeafIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color = "#7CEB71"
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.bezierCurveTo(size * 0.1, size * 0.4, size * 0.4, 0, size, 0);
  ctx.bezierCurveTo(size, size * 0.6, size * 0.6, size * 0.9, 0, size);
  ctx.fill();

  ctx.strokeStyle = "#08332E";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, size);
  ctx.quadraticCurveTo(size * 0.4, size * 0.5, size * 0.8, size * 0.2);
  ctx.stroke();
  ctx.restore();
}

/** Generates a high-resolution (1200x1600) promotional brochure PNG matching the approved design */
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

  // 1. Deep Emerald Base Background & Organic Waves
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 1600);
  bgGrad.addColorStop(0, "#08332E");
  bgGrad.addColorStop(0.45, "#0A3B35");
  bgGrad.addColorStop(1, "#052622");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 1600);

  // Top-Right Flowing Waves
  ctx.save();
  ctx.fillStyle = "rgba(18, 92, 83, 0.42)";
  ctx.beginPath();
  ctx.moveTo(1200, 0);
  ctx.lineTo(420, 0);
  ctx.bezierCurveTo(760, 140, 960, 360, 1200, 490);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(23, 115, 104, 0.26)";
  ctx.beginPath();
  ctx.moveTo(1200, 0);
  ctx.lineTo(660, 0);
  ctx.bezierCurveTo(910, 110, 1060, 250, 1200, 360);
  ctx.closePath();
  ctx.fill();

  // Bottom-Left Flowing Waves
  ctx.fillStyle = "rgba(18, 92, 83, 0.42)";
  ctx.beginPath();
  ctx.moveTo(0, 1600);
  ctx.lineTo(0, 1200);
  ctx.bezierCurveTo(220, 1260, 480, 1410, 640, 1600);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(23, 115, 104, 0.26)";
  ctx.beginPath();
  ctx.moveTo(0, 1600);
  ctx.lineTo(0, 1370);
  ctx.bezierCurveTo(160, 1420, 330, 1500, 460, 1600);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Top Header - ShePlates Script Wordmark + Divider + Tagline
  const sheplatesWordmark = await loadImage("/brand/sheplates-wordmark-coral.png");
  const logoH = 54;
  const logoW = Math.round(logoH * 3.304); // ~178px
  const headerTotalW = logoW + 32 + 2 + 32 + 380;
  const headerStartX = Math.round((1200 - headerTotalW) / 2);
  const headerY = 82;

  if (sheplatesWordmark) {
    ctx.drawImage(sheplatesWordmark, headerStartX, headerY - 6, logoW, logoH);
  } else {
    ctx.fillStyle = "#FF6551";
    ctx.font = "italic bold 44px cursive, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ShePlates", headerStartX, headerY + 36);
  }

  // Vertical Divider |
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillRect(headerStartX + logoW + 28, headerY - 2, 2, 50);

  // Tagline Lines
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.font = "900 17px sans-serif";
  ctx.fillText("HYPERLOCAL", headerStartX + logoW + 58, headerY + 18);
  ctx.fillText("FOOD & KITCHEN NETWORK", headerStartX + logoW + 58, headerY + 42);

  // 3. Vendor Section: Circular Photo/Logo with Lime Green Border
  const avatarCenterX = 600;
  const avatarCenterY = 280;
  const avatarRadius = 96;
  const borderThickness = 12;

  // Outer vibrant lime green ring
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + borderThickness, 0, Math.PI * 2);
  ctx.fillStyle = "#7CEB71";
  ctx.fill();

  // Inner clean white background
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  // Vendor photo or initial
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
    ctx.fillStyle = "#0A3833";
    ctx.font = "900 84px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((vendorName[0] || "S").toUpperCase(), avatarCenterX, avatarCenterY);
  }

  // Reset baseline
  ctx.textBaseline = "alphabetic";

  // Vendor Name + Verified Badge
  ctx.font = "900 46px sans-serif";
  const nameMetrics = ctx.measureText(vendorName);
  const badgeGap = 16;
  const badgeRadius = 16;
  const combinedNameWidth = nameMetrics.width + badgeGap + badgeRadius * 2;
  const nameStartX = 600 - combinedNameWidth / 2;

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(vendorName, nameStartX, 442);

  // Draw verified checkmark badge right after the name
  drawVerifiedBadge(ctx, nameStartX + nameMetrics.width + badgeGap + badgeRadius, 428, badgeRadius, "#7CEB71");

  // Category and Address Row
  const rawAddressText = [vendorCategory, vendorAddress].filter(Boolean).join(" · ");
  let displayAddress = rawAddressText;
  ctx.font = "500 19px sans-serif";
  const maxAddressWidth = 920;
  if (ctx.measureText(displayAddress).width > maxAddressWidth) {
    while (displayAddress.length > 10 && ctx.measureText(displayAddress + "…").width > maxAddressWidth) {
      displayAddress = displayAddress.slice(0, -1);
    }
    displayAddress += "…";
  }

  const pinSize = 16;
  const addrMetrics = ctx.measureText(displayAddress);
  const addrTotalW = pinSize + 10 + addrMetrics.width;
  const addrStartX = 600 - addrTotalW / 2;

  drawMapPinIcon(ctx, addrStartX + 6, 486, pinSize, "#7CEB71");
  ctx.fillStyle = "#C7E8DC";
  ctx.textAlign = "left";
  ctx.fillText(displayAddress, addrStartX + pinSize + 10, 488);

  // 4. Promotional Dialogue Section (Clean & Minimal)
  // Line 1: "Your favourite local kitchen"
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 42px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Your favourite local kitchen", 600, 565);

  // Line 2: "is just a " (white) + "scan away." (light green)
  const part1 = "is just a ";
  const part2 = "scan away.";
  const wPart1 = ctx.measureText(part1).width;
  const wPart2 = ctx.measureText(part2).width;
  const line2TotalW = wPart1 + wPart2;
  const line2StartX = 600 - line2TotalW / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(part1, line2StartX, 620);
  ctx.fillStyle = "#7CEB71";
  ctx.fillText(part2, line2StartX + wPart1, 620);

  // 5. QR Code Card Section (Big White Rounded Card)
  const cardX = 90;
  const cardY = 700;
  const cardW = 1020;
  const cardH = 580;
  const cardRadius = 38;

  // Drop shadow for card
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius, "#FFFFFF");
  ctx.restore();

  // Left Column: QR Code + 4 Dark Green Corner Brackets
  const qrSize = 340;
  const qrX = cardX + 75;
  const qrY = cardY + Math.round((cardH - qrSize) / 2);

  // Corner brackets around the QR code
  const bracketPad = 22;
  drawCornerBrackets(
    ctx,
    qrX - bracketPad,
    qrY - bracketPad,
    qrSize + bracketPad * 2,
    qrSize + bracketPad * 2,
    48,
    6,
    "#0A3833",
    12
  );

  // Load and draw the sharp QR code
  const qrImg = await loadImage(qrDataUrl);
  if (qrImg) {
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  }

  // Right Column: Heading, Guidance & "Visit Store Now →" Button
  const rightX = cardX + 475;

  ctx.fillStyle = "#0A3833";
  ctx.font = "900 46px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Scan. Explore.", rightX, cardY + 160);
  ctx.fillText("Order Fresh!", rightX, cardY + 220);

  ctx.fillStyle = "#4B605B";
  ctx.font = "500 22px sans-serif";
  ctx.fillText("Point your phone camera to", rightX, cardY + 280);
  ctx.fillText("open this store directly.", rightX, cardY + 312);

  // "Visit Store Now →" Pill Button
  const btnX = rightX;
  const btnY = cardY + 360;
  const btnW = 380;
  const btnH = 68;
  const btnRadius = 34;
  drawRoundedRect(ctx, btnX, btnY, btnW, btnH, btnRadius, "#0A3833");

  // Storefront icon inside button
  drawStorefrontIcon(ctx, btnX + 46, btnY + 34, 26, "#FFFFFF");

  // Button text
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 23px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Visit Store Now →", btnX + 78, btnY + 43);

  // 6. Bottom Footer - Tagline & Local Community Support
  const footerY = 1480;

  // Left tagline
  ctx.font = "900 20px sans-serif";
  const brandW = ctx.measureText("ShePlates").width;
  ctx.font = "600 18px sans-serif";
  const tagW = ctx.measureText(" — Fresh Home Meals & Local Kitchens, Made Simple").width;
  const footerLeftW = brandW + tagW;

  ctx.font = "600 18px sans-serif";
  const supp1 = "Support Local Kitchens";
  const supp2 = "in Your Neighbourhood";
  const suppW = Math.max(ctx.measureText(supp1).width, ctx.measureText(supp2).width) + 36;

  const footerTotalW = footerLeftW + 40 + 2 + 40 + suppW;
  const footerStartX = Math.round((1200 - footerTotalW) / 2);

  // Draw ShePlates in light green
  ctx.textAlign = "left";
  ctx.fillStyle = "#7CEB71";
  ctx.font = "900 20px sans-serif";
  ctx.fillText("ShePlates", footerStartX, footerY);

  // Draw the rest in white
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 18px sans-serif";
  ctx.fillText(" — Fresh Home Meals & Local Kitchens, Made Simple", footerStartX + brandW, footerY);

  // Vertical divider |
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillRect(footerStartX + footerLeftW + 30, footerY - 26, 2, 38);

  // Right: Leaf icon + Support local text
  const leafX = footerStartX + footerLeftW + 56;
  drawLeafIcon(ctx, leafX, footerY - 22, 26, "#7CEB71");

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 16px sans-serif";
  ctx.fillText(supp1, leafX + 38, footerY - 10);
  ctx.fillText(supp2, leafX + 38, footerY + 12);

  return canvas.toDataURL("image/png");
}

/** Scanning this QR code or clicking "Visit Store Now →" opens ShePlates
 * directly at this vendor's shop (via "?vendor=VENDOR_ID" query param).
 * The brochure preview and downloaded PNG match the approved ShePlates
 * premium brand standard. */
export function VendorQrCode({
  vendorId,
  vendorName,
  vendor,
  vendorLogo,
  vendorCategory,
  vendorAddress,
  vendorBio,
  onOpenStore,
}: {
  vendorId: string;
  vendorName: string;
  vendor?: Partial<Vendor>;
  vendorLogo?: string;
  vendorCategory?: string;
  vendorAddress?: string;
  vendorBio?: string;
  onOpenStore?: ((vendorId: string) => void) | (() => void);
}) {
  const [dataUrl, setDataUrl] = useState("");
  const [brochureUrl, setBrochureUrl] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);

  const resolvedLogo = vendor?.logoUrl || vendorLogo || "";
  const resolvedCategory = vendor?.category || vendorCategory || "Bakery";
  const resolvedAddress = vendor?.address || vendorAddress || "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}?vendor=${vendorId}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the link needs window.location, which only exists in the browser
    setShopUrl(url);

    let isMounted = true;
    setGenerating(true);

    QRCode.toDataURL(url, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#0A3833", light: "#ffffff" },
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

  const handleVisitStore = useCallback(() => {
    if (onOpenStore) {
      (onOpenStore as (id: string) => void)(vendorId);
    } else if (shopUrl) {
      window.location.href = shopUrl;
    }
  }, [onOpenStore, vendorId, shopUrl]);

  const fileSlug = vendorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return (
    <div className="surface-card rounded-[26px] p-4 sm:p-6" data-testid="vendor-qr-brochure-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/70 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[#202827]">
            <QrCode className="size-5 text-[#155F65]" />
            <h3 className="text-lg font-black tracking-[-.02em]">Store QR code</h3>
          </div>
          <p className="mt-1 text-xs text-stone-500 sm:text-sm">
            Point your phone camera to open this store directly. Customers can scan this QR code or use the direct link.
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#EAF4F2] px-3 py-1 text-xs font-bold text-[#155F65]">
          <Sparkles className="size-3.5" /> Direct Store Access
        </div>
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Simple QR Code Display */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex size-48 items-center justify-center rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            {/* Simple corner accents */}
            <div className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 rounded-tl border-l-2 border-t-2 border-[#155F65]" />
            <div className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 rounded-tr border-r-2 border-t-2 border-[#155F65]" />
            <div className="pointer-events-none absolute bottom-2 left-2 h-3.5 w-3.5 rounded-bl border-b-2 border-l-2 border-[#155F65]" />
            <div className="pointer-events-none absolute bottom-2 right-2 h-3.5 w-3.5 rounded-br border-b-2 border-r-2 border-[#155F65]" />

            {dataUrl ? (
              <Image
                src={dataUrl}
                alt={`QR code for ${vendorName}`}
                width={160}
                height={160}
                unoptimized
                className="size-full object-contain"
              />
            ) : (
              <span className="text-xs text-stone-400">Generating QR…</span>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-stone-500">Scan to visit store</p>
        </div>

        {/* Link, Guidance & Download Buttons */}
        <div className="flex-1 w-full space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-600">Direct Store Link</label>
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

          <div className="rounded-2xl border border-stone-200/70 bg-stone-50/70 p-3.5 text-xs text-stone-600 space-y-1">
            <p className="font-bold text-stone-700">How customers use your QR code:</p>
            <p>Scanning this QR code with a phone camera automatically opens your live store profile with all products, tabs, and cart.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Primary Action: Download QR Code Only */}
            {dataUrl && (
              <a
                href={dataUrl}
                download={`${fileSlug}-qr.png`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#155F65] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#0F4A4F]"
              >
                <Download className="size-3.5" />
                Download QR Code Only
              </a>
            )}

            {/* Optional Promotional Brochure PNG Download */}
            {brochureUrl && (
              <a
                href={brochureUrl}
                download={`${fileSlug}-store-brochure.png`}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-black text-stone-700 transition hover:border-[#155F65] hover:text-[#155F65]"
              >
                <Download className="size-3.5" />
                Download QR Brochure (PNG)
              </a>
            )}

            {/* Visit Store Button */}
            <button
              type="button"
              onClick={handleVisitStore}
              data-testid="brochure-visit-store-btn"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#155F65]/30 bg-[#EAF4F2] px-4 py-2.5 text-xs font-black text-[#155F65] transition hover:bg-[#d6ece8]"
            >
              <Store className="size-3.5" />
              <span>Visit Store Now →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
