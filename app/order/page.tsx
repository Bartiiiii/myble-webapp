"use client";

import Link from "next/link";
import React from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { useSession } from "next-auth/react";

type PreviewPlank = {
  id: string;
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  color: string;
};

const previewPlanks: PreviewPlank[] = [
  {
    id: "top",
    width: 2.2,
    height: 0.12,
    depth: 0.4,
    x: 0,
    y: 1.1,
    z: 0,
    color: "#8b5e3c",
  },
  {
    id: "bottom",
    width: 2.2,
    height: 0.12,
    depth: 0.4,
    x: 0,
    y: 0.05,
    z: 0,
    color: "#8b5e3c",
  },
  {
    id: "left",
    width: 0.12,
    height: 1.2,
    depth: 0.4,
    x: -1.04,
    y: 0.58,
    z: 0,
    color: "#6b4a2f",
  },
  {
    id: "right",
    width: 0.12,
    height: 1.2,
    depth: 0.4,
    x: 1.04,
    y: 0.58,
    z: 0,
    color: "#6b4a2f",
  },
  {
    id: "middle",
    width: 1.95,
    height: 0.1,
    depth: 0.35,
    x: 0,
    y: 0.6,
    z: 0,
    color: "#a06b45",
  },
];

function CheckoutPreviewScene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 4]} intensity={1.4} castShadow />
      <Environment preset="city" />

      <Grid
        position={[0, -0.01, 0]}
        args={[10, 10]}
        cellSize={0.25}
        cellThickness={0.5}
        cellColor="#d4d4d8"
        sectionSize={1}
        sectionThickness={1}
        sectionColor="#a1a1aa"
        fadeDistance={18}
        fadeStrength={1}
        infiniteGrid
      />

      {previewPlanks.map((plank) => (
        <mesh
          key={plank.id}
          position={[plank.x, plank.y, plank.z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[plank.width, plank.height, plank.depth]} />
          <meshStandardMaterial color={plank.color} />
        </mesh>
      ))}

      <OrbitControls enablePan={false} enableZoom enableRotate autoRotate autoRotateSpeed={1.1} />
    </>
  );
}

export default function OrderPage() {
  const { status } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/order/login?callbackUrl=%2Forder");
    }
  }, [router, status]);

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <p className="text-sm font-medium text-zinc-600">Loading checkout...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        {/* Brand row */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-600/20">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-700" fill="currentColor">
                <path d="M3 12c3-6 8-9 14-9 2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2zm0 8.8C6 14.8 11 12 17 12c2 0 4 .4 6 1.2-3 6-8 9-14 9-2 0-4-.4-6-1.2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight">Myble</span>
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm font-medium text-indigo-600">Checkout</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Review and place your order
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600">
            Complete your contact and delivery details below. Your furniture kit will be
            produced based on the design you created and prepared for easy assembly at home.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left column */}
          <div className="space-y-6">
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <h2 className="text-xl font-semibold tracking-tight">Contact info</h2>
              <p className="mt-1 text-sm text-zinc-600">
                We’ll use these details for order updates and delivery communication.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input placeholder="John" />
                </Field>
                <Field label="Last name">
                  <Input placeholder="Smith" />
                </Field>
                <Field label="Email address" className="sm:col-span-2">
                  <Input type="email" placeholder="you@example.com" />
                </Field>
                <Field label="Phone number" className="sm:col-span-2">
                  <Input type="tel" placeholder="+420 123 456 789" />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <h2 className="text-xl font-semibold tracking-tight">Address</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Where should we ship your custom flat-pack furniture kit?
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Street address" className="sm:col-span-2">
                  <Input placeholder="Národní 12" />
                </Field>
                <Field label="Apartment / unit (optional)" className="sm:col-span-2">
                  <Input placeholder="Flat 5B" />
                </Field>
                <Field label="City">
                  <Input placeholder="Prague" />
                </Field>
                <Field label="Postal code">
                  <Input placeholder="110 00" />
                </Field>
                <Field label="Country" className="sm:col-span-2">
                  <Select
                    options={[
                      "Czech Republic",
                      "Poland",
                      "Germany",
                      "Austria",
                      "Slovakia",
                    ]}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <h2 className="text-xl font-semibold tracking-tight">Delivery & notes</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Add anything useful for production, delivery, or access to your address.
              </p>

              <div className="mt-6 space-y-4">
                <Field label="Delivery option">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <OptionCard
                      title="Standard delivery"
                      subtitle="5–8 business days"
                      price="Included"
                      active
                    />
                    <OptionCard
                      title="Priority delivery"
                      subtitle="2–4 business days"
                      price="+ 390 CZK"
                    />
                  </div>
                </Field>

                <Field label="Order notes">
                  <TextArea placeholder="Add delivery instructions, access notes, or any special requests…" />
                </Field>

                <label className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                  <input type="checkbox" className="mt-1 rounded border-zinc-300" />
                  <span className="text-sm text-zinc-600">
                    I’d like to receive order updates and future product news from Myble.
                  </span>
                </label>
              </div>
            </section>
          </div>

          {/* Right column */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Your design</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    Rotatable preview of the selected furniture.
                  </p>
                </div>
                <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-600/20">
                  Live
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
                <div className="h-[280px] w-full sm:h-[320px]">
                  <Canvas shadows camera={{ position: [3.5, 2.5, 4], fov: 45 }}>
                    <CheckoutPreviewScene />
                  </Canvas>
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Order summary</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                    3 490 CZK
                  </h2>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                  VAT incl.
                </span>
              </div>

              <div className="mt-5 space-y-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <SummaryRow label="Custom furniture kit" value="2 690 CZK" />
                <SummaryRow label="Production prep" value="400 CZK" />
                <SummaryRow label="Delivery" value="Included" />
                <SummaryRow label="Estimated assembly guide" value="Included" />
                <div className="border-t border-zinc-200 pt-3">
                  <SummaryRow
                    label="Total"
                    value="3 490 CZK"
                    strong
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <p className="text-sm font-semibold text-zinc-800">What’s included</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-600">
                  <li>• Cut wooden parts</li>
                  <li>• Drilling and machining</li>
                  <li>• Surface finishing / laminating</li>
                  <li>• Required fittings and connectors</li>
                  <li>• Step-by-step assembly instructions</li>
                  <li>• Delivery to your address</li>
                </ul>
              </div>

              <Link
                href="/order/confirmation"
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-zinc-800"
              >
                Place order
              </Link>

              <p className="mt-3 text-center text-xs text-zinc-500">
                By placing the order, you confirm your custom production request.
              </p>
            </section>

            <section className="rounded-3xl bg-zinc-100 p-5 shadow-sm ring-1 ring-zinc-200">
              <p className="text-sm font-semibold text-zinc-800">Need to go back?</p>
              <p className="mt-1 text-sm text-zinc-600">
                You can still return to the configurator and adjust the design before ordering.
              </p>

              <Link
                href="/design"
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-300 transition hover:bg-zinc-50"
              >
                Back to design
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Input({
  type = "text",
  placeholder,
}: {
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
    />
  );
}

function TextArea({
  placeholder,
}: {
  placeholder?: string;
}) {
  return (
    <textarea
      placeholder={placeholder}
      rows={5}
      className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500"
    />
  );
}

function Select({
  options,
}: {
  options: string[];
}) {
  return (
    <select className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "text-sm font-semibold text-zinc-900" : "text-sm text-zinc-600"}>
        {label}
      </span>
      <span className={strong ? "text-sm font-semibold text-zinc-900" : "text-sm text-zinc-800"}>
        {value}
      </span>
    </div>
  );
}

function OptionCard({
  title,
  subtitle,
  price,
  active = false,
}: {
  title: string;
  subtitle: string;
  price: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-indigo-500 bg-indigo-50"
          : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
        </div>
        <span className="text-sm font-semibold text-zinc-900">{price}</span>
      </div>
    </button>
  );
}