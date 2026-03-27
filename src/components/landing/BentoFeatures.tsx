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
  FolderOpen,
} from "lucide-react";
import Image from "next/image";

/**
 * Main Responsibility: Bento grid feature showcase that pairs feature copy with
 * large screenshot placeholders. Screenshots are loaded from /screenshots/ in public.
 *
 * Sensitive Dependencies:
 * - Screenshot images expected at /screenshots/feature-{slug}.png
 * - Falls back to a styled placeholder when images are missing.
 */

interface BentoItem {
  slug: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  span: "normal" | "wide" | "tall";
}

const features: BentoItem[] = [
  {
    slug: "widget",
    title: "One-Click Install",
    description:
      "Drop a single script tag into WordPress, Webflow, Shopify, React or any site. Your clients don't even need an account.",
    icon: Zap,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    span: "wide",
  },
  {
    slug: "screenshot",
    title: "Point, Pin & Screenshot",
    description:
      "Clients pin feedback directly on any element. We auto-capture a screenshot plus browser, OS, and screen size metadata.",
    icon: Camera,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-500/10",
    span: "normal",
  },
  {
    slug: "chat",
    title: "Real-Time Chat",
    description:
      "Turn feedback into conversation. Chat contextually right on the page with instant sync.",
    icon: MessageSquare,
    iconColor: "text-green-600",
    iconBg: "bg-green-500/10",
    span: "normal",
  },
  {
    slug: "feedbacks",
    title: "Interactive Feedbacks Tab",
    description:
      "All stakeholders see ongoing discussions and participate from the widget — preventing duplicate requests.",
    icon: ClipboardCheck,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-500/10",
    span: "normal",
  },
  {
    slug: "dashboard",
    title: "Public Dashboard",
    description:
      "Share a dedicated project dashboard where stakeholders track all feedback and revisions at a glance.",
    icon: Share2,
    iconColor: "text-secondary",
    iconBg: "bg-secondary/10",
    span: "normal",
  },
  {
    slug: "team",
    title: "Team Collaboration",
    description:
      "Owners, members, and clients each see exactly what they need — with real-time notifications keeping everyone in the loop.",
    icon: Users,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-500/10",
    span: "wide",
  },
  {
    slug: "projects",
    title: "Unlimited Projects",
    description:
      "Manage 5 or 50 client sites under one flat fee. No per-project pricing walls.",
    icon: FolderOpen,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-500/10",
    span: "normal",
  },
];

const ScreenshotPlaceholder = ({ slug }: { slug: string }) => {
  const [hasImage, setHasImage] = React.useState(true);

  if (!hasImage) {
    return (
      <div className="w-full h-full min-h-[160px] bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl flex items-center justify-center">
        <p className="text-xs text-gray-300 font-medium">
          Screenshot coming soon
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[160px] rounded-2xl overflow-hidden bg-gray-100">
      <Image
        src={`/screenshots/feature-${slug}.png`}
        alt={`${slug} feature screenshot`}
        fill
        className="object-cover object-top"
        onError={() => setHasImage(false)}
      />
    </div>
  );
};

const getSpanClass = (span: BentoItem["span"]) => {
  switch (span) {
    case "wide":
      return "md:col-span-2";
    case "tall":
      return "md:row-span-2";
    default:
      return "";
  }
};

export const BentoFeatures = () => {
  return (
    <section id="features" className="py-24 md:py-32 bg-gray-50 w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <motion.div
              key={feature.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.07 }}
              className={`group bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col ${getSpanClass(feature.span)}`}
            >
              {/* Screenshot area */}
              <div className="p-4 pb-0">
                <ScreenshotPlaceholder slug={feature.slug} />
              </div>

              {/* Copy */}
              <div className="p-6 pt-5 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-xl ${feature.iconBg} flex items-center justify-center ${feature.iconColor}`}
                  >
                    <feature.icon size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed flex-1">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
