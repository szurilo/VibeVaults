"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Gift } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * Main Responsibility: Social proof section with a personal founder note,
 * early-access framing, and the two founding-member discount offers.
 *
 * Sensitive Dependencies:
 * - Founder avatar at /avatar.jpg in public folder.
 */

export const FounderNote = () => {
  return (
    <section className="py-24 md:py-32 w-full bg-white">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-8 md:p-12 shadow-xl overflow-hidden"
        >
          {/* Decorative accent */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary" />

          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center shrink-0">
              <a
                href="https://www.linkedin.com/in/jozseftar/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="József's LinkedIn profile"
                className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-white shadow-xl mb-3 transition-transform hover:scale-105"
              >
                <Image
                  src="/avatar.jpg"
                  alt="József — Founder of VibeVaults"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              </a>
              <p className="font-bold text-gray-900 text-sm">József</p>
              <p className="text-xs text-gray-500">Founder, VibeVaults</p>
            </div>

            {/* Letter */}
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
                A note from the founder
              </h3>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  I built VibeVaults because I lived the problem. After years of
                  running feedback rounds for agencies — chasing clients through
                  email threads, decoding vague screenshots, and losing hours to
                  miscommunication — I knew there had to be a better way.
                </p>
                <p>
                  VibeVaults is that better way. Your clients click directly on
                  the site, leave visual feedback, and you see it instantly in
                  your dashboard. No more &quot;can you scroll down a bit and
                  check the third section?&quot; emails.
                </p>
                <p className="font-semibold text-gray-900">
                  I&apos;m looking for a small group of founding agencies to
                  shape this product with me. In return, you get a serious
                  discount — and a direct line to the person building it.
                </p>
              </div>
            </div>
          </div>

          {/* Founding member offers */}
          <div className="mt-10 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <Gift size={20} className="text-secondary" />
              <h4 className="text-lg font-bold text-gray-900">
                Founding member exclusive — choose your deal
              </h4>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 hover:border-primary/40 transition-colors">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                  Option A
                </div>
                <p className="text-2xl font-extrabold text-gray-900 mb-1">
                  50% off for 3 months
                </p>
                <p className="text-sm text-gray-500">
                  Try it at half price with less commitment. Perfect if you want
                  to test the waters first.
                </p>
              </div>

              <div className="rounded-2xl border-2 border-secondary/20 bg-secondary/5 p-6 hover:border-secondary/40 transition-colors">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-bold mb-3">
                  Option B — Best Value
                </div>
                <p className="text-2xl font-extrabold text-gray-900 mb-1">
                  50% off for 1 year
                </p>
                <p className="text-sm text-gray-500">
                  Lock in the biggest savings. Ideal for agencies ready to
                  streamline their feedback workflow long-term.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/auth/register"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-lg bg-secondary text-white hover:bg-secondary/90 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 w-full sm:w-auto"
              >
                Claim your founding member spot
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <p className="text-sm text-gray-400">
                14-day free trial &middot; No credit card required
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
