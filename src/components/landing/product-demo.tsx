"use client";

import React from "react";
import { motion } from "framer-motion";

/**
 * Main Responsibility: Hero product demo section — embedded video player.
 *
 * Sensitive Dependencies:
 * - videoUrl must be a valid embed URL (YouTube, Loom, etc.).
 */

interface ProductDemoProps {
  videoUrl: string;
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
          <iframe
            src={videoUrl}
            title="VibeVaults product demo"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </motion.div>
      </div>
    </section>
  );
};
