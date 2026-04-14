"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Camera,
  MessageSquare,
  ClipboardCheck,
  Share2,
  Users,
} from "lucide-react";
import Image from "next/image";

/**
 * Main Responsibility: Zig-zag feature showcase pairing large feature screenshots
 * with copy. Screenshots alternate left/right so they can be displayed at full
 * detail. Screenshots are loaded from /screenshots/ in public.
 *
 * Sensitive Dependencies:
 * - Screenshot images expected at /screenshots/feature-{slug}.png
 */

interface FeatureItem {
  slug: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const features: FeatureItem[] = [
  {
    slug: "widget",
    title: "One-Click Install",
    description:
      "Drop a single script tag into WordPress, Webflow, Shopify, React or any site. Your clients don't even need an account.",
    icon: Zap,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
  },
  {
    slug: "screenshot",
    title: "Point, Pin & Screenshot",
    description:
      "Clients pin feedback directly on any element. We auto-capture a screenshot plus browser, OS, and screen size metadata.",
    icon: Camera,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-500/10",
  },
  {
    slug: "chat",
    title: "Real-Time Chat",
    description:
      "Turn feedback into conversation. Chat contextually right on the page with instant sync.",
    icon: MessageSquare,
    iconColor: "text-green-600",
    iconBg: "bg-green-500/10",
  },
  {
    slug: "feedbacks",
    title: "Interactive Feedbacks Tab",
    description:
      "All stakeholders see ongoing discussions and participate from the widget — preventing duplicate requests.",
    icon: ClipboardCheck,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-500/10",
  },
  {
    slug: "dashboard",
    title: "Public Dashboard",
    description:
      "Share a dedicated project dashboard where stakeholders track all feedback and revisions at a glance.",
    icon: Share2,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
  },
  {
    slug: "team",
    title: "Team Collaboration",
    description:
      "Owners, members, and clients each see exactly what they need — with real-time notifications keeping everyone in the loop.",
    icon: Users,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-500/10",
  },
];

const FeatureScreenshot = ({ slug }: { slug: string }) => {
  return (
    <div className="relative w-full aspect-16/10 rounded-2xl overflow-hidden bg-linear-to-br from-gray-50 to-gray-100 shadow-lg ring-1 ring-gray-200/60">
      <Image
        src={`/screenshots/feature-${slug}.png`}
        alt={`${slug} feature screenshot`}
        fill
        sizes="(min-width: 1024px) 640px, 100vw"
        className="object-contain"
      />
    </div>
  );
};

export const BentoFeatures = () => {
  return (
    <section id="features" className="py-24 md:py-32 bg-gray-50 w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Built for agency velocity
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Stop deciphering &quot;make the logo bigger&quot; from cropped PDFs.
            Give your clients a visual, friction-free way to leave feedback
            exactly where it belongs.
          </p>
        </motion.div>

        <div className="flex flex-col gap-24 md:gap-32">
          {features.map((feature, index) => {
            const imageFirst = index % 2 === 0;
            const isLast = index === features.length - 1;
            const gridCols = isLast ? "lg:grid-cols-3" : "lg:grid-cols-2";
            const imageSpan = isLast ? "lg:col-span-2" : "";
            return (
              <motion.div
                key={feature.slug}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid ${gridCols} gap-10 lg:gap-16 items-center`}
              >
                <div
                  className={`${imageSpan} ${imageFirst ? "lg:order-1" : "lg:order-2"}`}
                >
                  <FeatureScreenshot slug={feature.slug} />
                </div>

                <div className={imageFirst ? "lg:order-2" : "lg:order-1"}>
                  <div
                    className={`inline-flex w-12 h-12 rounded-xl ${feature.iconBg} items-center justify-center ${feature.iconColor} mb-5`}
                  >
                    <feature.icon size={24} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-lg text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
