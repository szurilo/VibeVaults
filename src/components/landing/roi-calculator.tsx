"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, DollarSign, Clock, FolderOpen } from "lucide-react";

/**
 * Main Responsibility: Interactive ROI calculator that lets prospects input their
 * hourly rate and active project count, then visualises monthly time & money savings.
 *
 * Sensitive Dependencies: None — pure client-side math, no external data.
 */

// Industry-backed estimates (HubSpot partner surveys, Marker.io, BugHerd, Usersnap)
const WITHOUT = {
  revisionsPerProject: 5,
  hoursPerRevision: 3,
};

const WITH = {
  revisionsPerProject: 2.5,  // ~50% reduction (BugHerd, Usersnap report 30-50%)
  hoursPerRevision: 1,       // ~67% less logistics time (Marker.io, Pastel report 50-70%)
};

export const ROICalculator = () => {
  const [hourlyRate, setHourlyRate] = useState(100);
  const [activeProjects, setActiveProjects] = useState(5);

  const stats = useMemo(() => {
    const withoutHours =
      WITHOUT.revisionsPerProject * WITHOUT.hoursPerRevision * activeProjects;
    const withHours =
      WITH.revisionsPerProject * WITH.hoursPerRevision * activeProjects;
    const savedHours = withoutHours - withHours;
    const savedMoney = savedHours * hourlyRate;
    const withoutCost = withoutHours * hourlyRate;
    const withCost = withHours * hourlyRate;

    // Pro plan at $49/mo — how quickly does the tool pay for itself?
    const proPrice = 49;
    const paybackHours = proPrice / hourlyRate;
    const annualSavings = savedMoney * 12;

    return {
      withoutHours: Math.round(withoutHours),
      withHours: Math.round(withHours),
      savedHours: Math.round(savedHours),
      savedMoney: Math.round(savedMoney),
      withoutCost: Math.round(withoutCost),
      withCost: Math.round(withCost),
      paybackHours: paybackHours < 1 ? paybackHours.toFixed(1) : Math.round(paybackHours).toString(),
      annualSavings: Math.round(annualSavings),
    };
  }, [hourlyRate, activeProjects]);

  const formatCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="py-24 md:py-32 w-full bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Calculate your savings
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            See how much time and money your agency can save each month by
            eliminating the feedback chaos.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Inputs */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl border border-gray-200 p-8 md:p-10 shadow-xl"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-8">
              Your agency details
            </h3>

            {/* Hourly Rate */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <DollarSign size={16} className="text-primary" />
                  Hourly rate
                </label>
                <span className="text-2xl font-extrabold text-gray-900">
                  ${hourlyRate}
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={300}
                step={5}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-lg"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>$25/hr</span>
                <span>$300/hr</span>
              </div>
            </div>

            {/* Active Projects */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <FolderOpen size={16} className="text-secondary" />
                  Active projects per month
                </label>
                <span className="text-2xl font-extrabold text-gray-900">
                  {activeProjects}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={activeProjects}
                onChange={(e) => setActiveProjects(Number(e.target.value))}
                className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-secondary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-lg"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 project</span>
                <span>30 projects</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col gap-6"
          >
            {/* Big savings card */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 md:p-10 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <p className="text-sm font-semibold text-white/70 mb-2 relative z-10">
                Your estimated monthly savings
              </p>
              <motion.p
                key={stats.savedMoney}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl md:text-6xl font-black tracking-tight relative z-10"
              >
                {formatCurrency(stats.savedMoney)}
              </motion.p>
              <p className="text-white/60 text-sm mt-2 relative z-10">
                That&apos;s{" "}
                <span className="text-white font-bold">
                  {stats.savedHours} hours
                </span>{" "}
                saved every month — for just{" "}
                <span className="text-white font-bold">$49/mo</span> on the Pro
                plan
              </p>
            </div>

            {/* Comparison cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <TrendingUp size={16} className="text-red-500" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    Without
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-gray-900">
                  {formatCurrency(stats.withoutCost)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.withoutHours}h / month on revisions
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-primary/20 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                    <TrendingDown size={16} className="text-green-500" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    With VibeVaults
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-primary">
                  {formatCurrency(stats.withCost)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.withHours}h / month on revisions
                </p>
              </div>
            </div>

            {/* Payback + annual savings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-secondary" />
                  <span className="text-xs font-semibold text-gray-500">
                    Pays for itself in
                  </span>
                </div>
                <motion.p
                  key={stats.paybackHours}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-2xl font-extrabold text-secondary"
                >
                  {stats.paybackHours}h
                </motion.p>
                <p className="text-xs text-gray-400 mt-1">
                  of saved work per month
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={16} className="text-green-500" />
                  <span className="text-xs font-semibold text-gray-500">
                    Annual savings
                  </span>
                </div>
                <motion.p
                  key={stats.annualSavings}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-2xl font-extrabold text-green-600"
                >
                  {formatCurrency(stats.annualSavings)}
                </motion.p>
                <p className="text-xs text-gray-400 mt-1">
                  vs. {formatCurrency(49 * 12)}/yr for Pro plan
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Methodology note */}
        <p className="text-center text-xs text-gray-400 mt-12 max-w-xl mx-auto">
          Estimates based on industry surveys and reports from agencies using
          structured visual feedback tools. Baseline:{" "}
          {WITHOUT.revisionsPerProject} revision rounds at{" "}
          {WITHOUT.hoursPerRevision}h each; with VibeVaults:{" "}
          {WITH.revisionsPerProject} rounds at {WITH.hoursPerRevision}h.
          Your actual savings may vary.
        </p>
      </div>
    </section>
  );
};
