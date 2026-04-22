"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Star, MapPin, Phone, Mail, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Factory, Product } from "@/lib/mock-data";

interface Props {
  factories: Factory[];
  products: Product[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          strokeWidth={1.5}
          className={i < rating ? "fill-[var(--sa-gold)] text-[var(--sa-gold)]" : "text-[var(--sa-border-strong)]"}
        />
      ))}
    </div>
  );
}

function FactoryCard({
  factory,
  activeProductCount,
}: {
  factory: Factory;
  activeProductCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] p-5 hover:border-[var(--sa-border-strong)] hover:shadow-sm transition-all cursor-default"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--sa-text-primary)] truncate">
            {factory.name}
          </h3>
          <div className="flex items-center gap-1 text-[12px] text-[var(--sa-text-tertiary)]">
            <MapPin size={10} strokeWidth={1.8} />
            <span>{factory.city}, {factory.country}</span>
          </div>
        </div>
        <StarRating rating={factory.rating} />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-1.5">
        {factory.categories.map((cat) => (
          <span
            key={cat}
            className="rounded-full bg-[var(--sa-hover)] border border-[var(--sa-border)] px-2 py-0.5 text-[10px] text-[var(--sa-text-secondary)]"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Specialities */}
      {factory.specialities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {factory.specialities.map((s) => (
            <span key={s} className="rounded-md bg-[var(--sa-accent)]/10 px-1.5 py-0.5 text-[10px] text-[var(--sa-accent)] font-medium">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Min order value</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">${factory.min_order_value.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">MOQ (units)</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.moq_units.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Sample lead time</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.sample_lead_time_days}d</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Production lead time</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.lead_time_days}d</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Capacity / month</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.capacity_per_month.toLocaleString()} units</p>
        </div>
        <div className="rounded-lg bg-[var(--sa-bg)] p-2.5">
          <p className="text-[9px] uppercase tracking-wide text-[var(--sa-text-tertiary)]">Est.</p>
          <p className="mt-0.5 font-mono text-[12px] font-semibold text-[var(--sa-text-primary)]">{factory.established_year}</p>
        </div>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-[var(--sa-text-primary)]">{factory.contact_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mail size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} />
          <span className="truncate">{factory.contact_email}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Phone size={10} className="text-[var(--sa-text-tertiary)]" strokeWidth={1.8} />
          <span>{factory.contact_phone}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--sa-border)]">
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--sa-text-secondary)]">
          <Package size={11} className="text-[var(--sa-text-tertiary)]" />
          <span>
            {activeProductCount > 0
              ? `${activeProductCount} product${activeProductCount > 1 ? "s" : ""} in production`
              : "No active orders"}
          </span>
        </div>
      </div>

      {/* Notes */}
      {factory.notes && (
        <p className="text-[11px] text-[var(--sa-text-tertiary)] italic leading-relaxed border-t border-[var(--sa-border)] pt-3">
          {factory.notes}
        </p>
      )}
    </motion.div>
  );
}

export function FactoriesPageClient({ factories, products }: Props) {
  const activeStages = new Set(["production", "qc"]);

  function getActiveCount(factoryId: string) {
    return products.filter(
      (p) => p.factory_id === factoryId && activeStages.has(p.stage)
    ).length;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 panel-border-b bg-[var(--sa-window)]">
        <div>
          <h1 className="text-[15px] font-semibold text-[var(--sa-text-primary)]">Factories</h1>
          <p className="text-[12px] text-[var(--sa-text-tertiary)]">{factories.length} suppliers in your network</p>
        </div>
        <button className="flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 transition-opacity">
          <Plus size={13} strokeWidth={2.5} /> Add Factory
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {factories.map((factory) => (
            <FactoryCard
              key={factory.id}
              factory={factory}
              activeProductCount={getActiveCount(factory.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
