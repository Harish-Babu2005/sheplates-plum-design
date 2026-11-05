"use client";
import { useEffect } from "react";

/**
 * Presentational helper: copies each table column heading onto its cells as data-label, so the phone layout
 * (staff-kit.css) can show the heading above each value when a table turns into cards. Changes no data or behaviour.
 */
export function TableLabels() {
  useEffect(() => {
    let frame = 0;
    const label = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table[data-slot="table"]').forEach((table) => {
        const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent || "").trim());
        if (!heads.length) return;
        table.querySelectorAll("tbody tr").forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (heads[index] && cell.getAttribute("data-label") !== heads[index]) cell.setAttribute("data-label", heads[index]);
          });
        });
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(label); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return null;
}
