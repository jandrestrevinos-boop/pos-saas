"use client";

import { useEffect, useState } from "react";
import {
  EMPTY_BRANDING,
  FONT_KEYS,
  FONT_SCALES,
  FONTS,
  DEFAULT_COLORS,
  PRESETS,
  cssVarMap,
  fontPx,
  googleFontsHref,
  validateBrandColors,
  type Branding,
} from "@/lib/branding";
import { ImageUploader } from "@/components/image-uploader";

const FONT_LINK_ID = "branding-preview-fonts";

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 rounded border border-line bg-white p-0.5 cursor-pointer"
        />
        <span className="font-mono text-xs text-muted">{(value ?? fallback).toUpperCase()}</span>
      </div>
    </div>
  );
}

export function BrandingSection() {
  const [saved, setSaved] = useState<Branding | null>(null);
  const [form, setForm] = useState<Branding>(EMPTY_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d: { branding?: Branding; error?: string }) => {
        if (d.branding) {
          setSaved(d.branding);
          setForm(d.branding);
        } else {
          setError(d.error ?? "No se pudo cargar la personalización");
        }
      })
      .catch(() => setError("No se pudo cargar la personalización"))
      .finally(() => setLoading(false));
  }, []);

  // Vista previa en vivo: se aplica en esta pantalla antes de guardar; al salir se revierte a lo guardado.
  useEffect(() => {
    if (loading) return;
    const root = document.documentElement;
    const vars = cssVarMap(form, true);
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.fontSize = fontPx(form.fontScale) ?? "";

    const href = googleFontsHref(form);
    let link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;
    if (href) {
      if (!link) {
        link = document.createElement("link");
        link.id = FONT_LINK_ID;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      if (link.href !== href) link.href = href;
    }
  }, [form, loading]);

  useEffect(() => {
    return () => {
      const root = document.documentElement;
      Object.keys(cssVarMap(EMPTY_BRANDING, true)).forEach((k) => root.style.removeProperty(k));
      root.style.removeProperty("font-size");
    };
  }, []);

  const colorError = validateBrandColors(form);
  const dirty = saved ? JSON.stringify(saved) !== JSON.stringify(form) : false;

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar");
      window.location.reload(); // para que el menú lateral, el logo y todo tome la marca nueva
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
      setSaving(false);
    }
  }

  function resetLook() {
    setForm({
      ...form,
      primaryColor: null,
      accentColor: null,
      sidebarColor: null,
      fontBody: null,
      fontDisplay: null,
      fontScale: null,
    });
  }

  if (loading) {
    return (
      <div className="bg-white border border-line rounded-lg p-5 mb-4 text-sm text-muted">
        Cargando personalización...
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-lg p-5 mb-4">
      <h2 className="font-display text-lg font-semibold mb-1">Marca y apariencia</h2>
      <p className="text-muted text-sm mb-5">
        Personaliza tu plataforma con tu logo, tus colores y tu tipografía. Los cambios se ven al instante en esta
        pantalla; se aplican para todo tu equipo cuando das Guardar.
      </p>

      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-2">Logo</p>
          <ImageUploader kind="logo" value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} />
          <div className="mt-3">
            <label className="block text-xs font-medium text-muted mb-1">Nombre en el menú</label>
            <input
              className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm"
              placeholder="Mi Restaurante"
              maxLength={40}
              value={form.brandName ?? ""}
              onChange={(e) => setForm({ ...form, brandName: e.target.value || null })}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Colores</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setForm({ ...form, primaryColor: p.primary, accentColor: p.accent, sidebarColor: p.sidebar })}
                className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium"
              >
                <span className="flex">
                  <span className="h-4 w-4 rounded-l" style={{ background: p.sidebar }} />
                  <span className="h-4 w-4" style={{ background: p.primary }} />
                  <span className="h-4 w-4 rounded-r" style={{ background: p.accent }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-5">
            <ColorField
              label="Color principal (botones)"
              value={form.primaryColor}
              fallback={DEFAULT_COLORS.primary}
              onChange={(v) => setForm({ ...form, primaryColor: v })}
            />
            <ColorField
              label="Color de acento"
              value={form.accentColor}
              fallback={DEFAULT_COLORS.accent}
              onChange={(v) => setForm({ ...form, accentColor: v })}
            />
            <ColorField
              label="Color del menú lateral"
              value={form.sidebarColor}
              fallback={DEFAULT_COLORS.sidebar}
              onChange={(v) => setForm({ ...form, sidebarColor: v })}
            />
          </div>
          {colorError && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mt-3">{colorError}</p>}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Tipografía y tamaño</p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Texto general</label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                value={form.fontBody ?? ""}
                onChange={(e) => setForm({ ...form, fontBody: e.target.value || null })}
              >
                <option value="">Predeterminada (Inter)</option>
                {FONT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FONTS[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Títulos</label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                value={form.fontDisplay ?? ""}
                onChange={(e) => setForm({ ...form, fontDisplay: e.target.value || null })}
              >
                <option value="">Predeterminada (Fraunces)</option>
                {FONT_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {FONTS[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            {(Object.keys(FONT_SCALES) as (keyof typeof FONT_SCALES)[]).map((k) => {
              const active = (form.fontScale ?? "md") === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, fontScale: k === "md" ? null : k })}
                  className={`rounded-md border px-4 py-2 text-sm font-medium ${
                    active ? "bg-ember text-white border-ember" : "border-line"
                  }`}
                >
                  {FONT_SCALES[k].label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-1">Tamaño de letra de toda la plataforma.</p>
        </div>

        <div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.showProductImages}
              onChange={(e) => setForm({ ...form, showProductImages: e.target.checked })}
            />
            <span>
              <span className="font-medium">Usar fotos en los productos</span>
              <span className="block text-muted text-xs">
                Al activarlo, en Productos aparece la opción de subir la foto de cada uno y se muestran en el Punto de
                Venta.
              </span>
            </span>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-ember-dark bg-ember/10 rounded-md px-3 py-2 mt-4">{error}</p>}

      <div className="flex items-center gap-2 mt-5">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty || !!colorError}
          className="rounded-md bg-ember text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          onClick={resetLook}
          disabled={saving}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium"
        >
          Restablecer colores y letra
        </button>
      </div>
    </div>
  );
}
