"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, MonitorPlay } from "lucide-react";

/**
 * Main Responsibility: Hero product demo section — video embed with fallback placeholder,
 * plus a grid of screenshot placeholders the founder will fill in.
 *
 * Sensitive Dependencies:
 * - Video URL is optional; renders a polished placeholder when absent.
 * - Screenshot images are loaded from /screenshots/ in public folder.
 */

interface ProductDemoProps {
  videoUrl?: string; // YouTube or Loom embed URL
}

export const ProductDemo = ({ videoUrl }: ProductDemoProps) => {
  return (
    <section className="py-24 w-full flex flex-col items-center bg-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            See it in action
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Watch how agencies collect, manage, and resolve client feedback in
            minutes — not days.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative w-full aspect-video rounded-3xl overflow-hidden border border-gray-200 shadow-2xl bg-gray-900"
        >
          {videoUrl ? (
            <iframe
              src={videoUrl}
              title="VibeVaults product demo"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            /* Polished placeholder until the founder records the video */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative group cursor-pointer">
              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              {/* Glow behind play button */}
              <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700" />

              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative z-10 w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl"
              >
                <Play
                  size={36}
                  className="text-white ml-1"
                  fill="currentColor"
                />
              </motion.div>

              <div className="relative z-10 mt-6 flex items-center gap-2 text-white/60">
                <MonitorPlay size={16} />
                <span className="text-sm font-medium">
                  Product demo coming soon
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};
