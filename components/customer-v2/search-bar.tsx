"use client";

import React, { useState, useEffect, useRef, useCallback, useId } from "react";
import { Search, X, SlidersHorizontal, RefreshCcw, Store, Sparkles, MapPin, ArrowRight } from "@/components/icons";
import { searchMarketplace, type CustomerLocationProfile, type MarketplaceSearchResults, calculateFinalPrice } from "@/lib/marketplace-search";
import type { Product, Vendor } from "@/components/sheplates-v3";
import { categoryVisual } from "@/lib/sheplates-data";

export interface CustomerSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  onNavigateToSearch: (query: string) => void;
  onOpenProduct: (product: Product) => void;
  onOpenVendor: (vendorId: string) => void;
  onSelectCategory: (categoryName: string) => void;
  onToggleFilters: () => void;
  activeFilterCount?: number;
  products: Product[];
  vendors: Vendor[];
  profile?: CustomerLocationProfile | null;
  markups?: Record<string, number>;
  className?: string;
  simulateFailure?: boolean;
}

type DropdownItem =
  | { type: "product"; product: Product; key: string }
  | { type: "vendor"; vendor: Vendor; key: string }
  | { type: "category"; categoryName: string; key: string }
  | { type: "all"; query: string; key: string };

export function CustomerSearchBar({
  query,
  onQueryChange,
  onNavigateToSearch,
  onOpenProduct,
  onOpenVendor,
  onSelectCategory,
  onToggleFilters,
  activeFilterCount = 0,
  products,
  vendors,
  profile,
  markups = {},
  className = "",
  simulateFailure = false,
}: CustomerSearchBarProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MarketplaceSearchResults | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownId = useId();

  // Keep local query in sync if parent query changes externally
  useEffect(() => {
    setLocalQuery(query);
  }, [query]);

  // Execute search with error handling
  const runSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setResults(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchRes = await searchMarketplace(trimmed, products, vendors, profile, {
          markups,
          simulateFailure,
        });
        setResults(searchRes);
        setActiveIndex(-1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search request could not be completed.");
        setResults(null);
      } finally {
        setLoading(false);
      }
    },
    [products, vendors, profile, markups, simulateFailure]
  );

  // Debounce search by ~300ms
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!localQuery.trim()) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      void runSearch(localQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localQuery, runSearch]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Prepare flattened dropdown items for keyboard navigation:
  // 1. Products first
  // 2. Kitchens/vendors second
  // 3. Categories third
  // 4. "See all results" option
  const dropdownItems: DropdownItem[] = [];
  if (results && !loading && !error) {
    results.products.slice(0, 5).forEach((p) => {
      dropdownItems.push({ type: "product", product: p, key: `p-${p.id}` });
    });
    results.vendors.slice(0, 3).forEach((v) => {
      dropdownItems.push({ type: "vendor", vendor: v, key: `v-${v.id}` });
    });
    results.categories.slice(0, 3).forEach((c) => {
      dropdownItems.push({ type: "category", categoryName: c.name, key: `c-${c.name}` });
    });
    if (localQuery.trim()) {
      dropdownItems.push({ type: "all", query: localQuery.trim(), key: "see-all-results" });
    }
  }

  const handleSelectDropdownItem = (item: DropdownItem) => {
    setIsOpen(false);
    if (item.type === "product") {
      onOpenProduct(item.product);
    } else if (item.type === "vendor") {
      onOpenVendor(item.vendor.id);
    } else if (item.type === "category") {
      onSelectCategory(item.categoryName);
      onNavigateToSearch(localQuery);
    } else if (item.type === "all") {
      onNavigateToSearch(item.query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen && localQuery.trim()) {
        setIsOpen(true);
        return;
      }
      if (dropdownItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % dropdownItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (dropdownItems.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? dropdownItems.length - 1 : prev - 1));
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < dropdownItems.length) {
        handleSelectDropdownItem(dropdownItems[activeIndex]);
      } else {
        setIsOpen(false);
        onNavigateToSearch(localQuery);
      }
    }
  };

  const handleClear = () => {
    setLocalQuery("");
    onQueryChange("");
    setResults(null);
    setError(null);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalQuery(val);
    onQueryChange(val);
    if (!isOpen && val.trim().length > 0) {
      setIsOpen(true);
    }
  };

  const handleRetry = () => {
    void runSearch(localQuery);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${className}`}>
      {/* Top Search Bar */}
      <div
        data-tour="search"
        className="k-search flex items-center gap-2.5 h-12 px-4 rounded-full bg-stone-100/90 border border-stone-200/80 focus-within:border-[#155F65] focus-within:ring-2 focus-within:ring-[#155F65]/15 focus-within:bg-white transition-all duration-150"
      >
        <Search className="size-5 shrink-0 text-stone-500" aria-hidden="true" />

        <input
          ref={inputRef}
          type="text"
          value={localQuery}
          onChange={handleInputChange}
          onFocus={() => {
            if (localQuery.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search milk, meals, bakes, kitchens"
          aria-label="Search milk, meals, bakes, kitchens"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={dropdownId}
          aria-autocomplete="list"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#202827] placeholder:text-stone-400 outline-none"
        />

        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Filter Sliders Button */}
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            onToggleFilters();
          }}
          aria-label={`Open filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
          data-tour="filters"
          className="relative flex items-center justify-center p-1.5 rounded-full text-stone-600 hover:text-[#155F65] hover:bg-stone-200/60 transition"
        >
          <SlidersHorizontal className="size-5 shrink-0" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[#155F65] text-[10px] font-black text-white shadow-sm">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Matching Dropdown Results */}
      {isOpen && localQuery.trim().length > 0 && (
        <div
          id={dropdownId}
          role="listbox"
          className="k-search-dropdown absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl bg-white shadow-2xl border border-stone-200 max-h-[70vh] sm:max-h-[60vh] overflow-y-auto overscroll-contain animate-in fade-in-50 slide-in-from-top-1 duration-150"
        >
          {loading && (
            <div className="flex items-center gap-3 p-4 text-sm text-stone-500">
              <RefreshCcw className="size-4 animate-spin text-[#155F65]" />
              <span className="font-medium">Searching milk, meals, bakes, kitchens…</span>
            </div>
          )}

          {!loading && error && (
            <div className="p-5 text-center">
              <p className="text-sm font-semibold text-stone-700">{error}</p>
              <p className="mt-1 text-xs text-stone-500">Could not refresh results right now.</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#155F65] px-4 py-1.5 text-xs font-black text-white hover:bg-[#124d52] transition"
              >
                <RefreshCcw className="size-3" />
                Try again
              </button>
            </div>
          )}

          {!loading && !error && results && results.totalCount === 0 && (
            <div className="p-6 text-center text-sm text-stone-500">
              <p className="font-medium text-stone-700">No results for &ldquo;{localQuery}&rdquo;</p>
              <p className="mt-1 text-xs text-stone-400">
                Check spelling, try Tamil text, or search by a broader category like meals, bakes, or milk.
              </p>
            </div>
          )}

          {!loading && !error && results && results.totalCount > 0 && (
            <div className="divide-y divide-stone-100">
              {/* 1. Products first */}
              {results.products.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-400">
                    Products ({results.products.length})
                  </div>
                  <div className="space-y-1">
                    {results.products.slice(0, 5).map((product) => {
                      const itemIdx = dropdownItems.findIndex((it) => it.type === "product" && it.product.id === product.id);
                      const isSelected = activeIndex === itemIdx;
                      const vendor = vendors.find((v) => v.id === product.vendorId);
                      const price = calculateFinalPrice(product, markups);

                      return (
                        <div
                          key={product.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectDropdownItem({ type: "product", product, key: `p-${product.id}` });
                          }}
                          onMouseEnter={() => setActiveIndex(itemIdx)}
                          className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${isSelected ? "bg-[#EAF4F2] text-[#155F65]" : "hover:bg-stone-50"
                            }`}
                        >
                          <div
                            className="size-10 rounded-lg overflow-hidden grid place-items-center shrink-0 border border-stone-200/60"
                            style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-base">{product.emoji || "🍲"}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-sm text-[#202827]">{product.name}</div>
                            <div className="truncate text-xs text-stone-500">
                              {vendor?.businessName || "Verified kitchen"} · {product.baseUnit}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-black text-sm text-[#202827]">₹{price}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Kitchens/Vendors second */}
              {results.vendors.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-400">
                    Kitchens & Vendors ({results.vendors.length})
                  </div>
                  <div className="space-y-1">
                    {results.vendors.slice(0, 3).map((vendor) => {
                      const itemIdx = dropdownItems.findIndex((it) => it.type === "vendor" && it.vendor.id === vendor.id);
                      const isSelected = activeIndex === itemIdx;

                      return (
                        <div
                          key={vendor.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectDropdownItem({ type: "vendor", vendor, key: `v-${vendor.id}` });
                          }}
                          onMouseEnter={() => setActiveIndex(itemIdx)}
                          className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${isSelected ? "bg-[#EAF4F2] text-[#155F65]" : "hover:bg-stone-50"
                            }`}
                        >
                          <div className="size-10 rounded-full bg-stone-100 grid place-items-center shrink-0 text-[#155F65] border border-stone-200/60">
                            {vendor.logoUrl ? (
                              <img src={vendor.logoUrl} alt={vendor.businessName} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <Store className="size-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-sm text-[#202827]">{vendor.businessName}</div>
                            <div className="truncate text-xs text-stone-500">
                              {vendor.category} · {vendor.radiusKm} km delivery radius
                            </div>
                          </div>
                          <MapPin className="size-4 text-stone-400 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Categories third */}
              {results.categories.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-400">
                    Categories ({results.categories.length})
                  </div>
                  <div className="space-y-1">
                    {results.categories.slice(0, 3).map((cat) => {
                      const itemIdx = dropdownItems.findIndex((it) => it.type === "category" && it.categoryName === cat.name);
                      const isSelected = activeIndex === itemIdx;

                      return (
                        <div
                          key={cat.name}
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectDropdownItem({ type: "category", categoryName: cat.name, key: `c-${cat.name}` });
                          }}
                          onMouseEnter={() => setActiveIndex(itemIdx)}
                          className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition ${isSelected ? "bg-[#EAF4F2] text-[#155F65]" : "hover:bg-stone-50"
                            }`}
                        >
                          <span className="text-xl shrink-0">{cat.emoji}</span>
                          <div className="min-w-0 flex-1 font-bold text-sm text-[#202827]">{cat.name}</div>
                          <span className="text-xs text-stone-400">{cat.count} items</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. See all results row */}
              <div className="p-2 bg-stone-50/60">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                    onNavigateToSearch(localQuery);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-sm font-black transition ${activeIndex === dropdownItems.length - 1
                      ? "bg-[#155F65] text-white"
                      : "text-[#155F65] hover:bg-[#EAF4F2]"
                    }`}
                >
                  <span className="truncate">See all results for &ldquo;{localQuery}&rdquo;</span>
                  <ArrowRight className="size-4 shrink-0 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
