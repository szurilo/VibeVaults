"use client";

import React from "react";
import { motion } from "framer-motion";
import { UserPlus, Code2, Rocket, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
    {
        title: "Create your account",
        description: "Sign up and set up your project dashboard in less than 2 minutes.",
        icon: UserPlus,
    },
    {
        title: "Embed the widget",
        description: "Copy and paste our lightweight script into your website's code.",
        icon: Code2,
        isCode: true,
    },
    {
        title: "Share with clients",
        description: "Generate a private link for your clients to see the feedback board and follow your progress.",
        icon: ArrowRight,
    },
];

const CodeSnippet = () => {
    return (
        <div className="relative group">
            <div className="absolute -inset-1 bg-linear-to-r from-primary to-secondary rounded-2xl opacity-20 group-hover:opacity-30 transition duration-500 blur"></div>
            <div className="relative bg-[#1e1e1e] rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-800">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono tracking-wider">index.html</div>
                </div>
                <div className="p-4 font-mono text-[11px] md:text-xs leading-relaxed">
                    <div className="text-gray-500 italic mb-2">{"<!-- Add this line before </body> -->"}</div>
                    <div className="flex gap-3">
                        <span className="text-gray-600 select-none">1</span>
                        <div className="break-all">
                            <span className="text-pink-400">{"<script "}</span>
                            <span className="text-yellow-200">{"src"}</span>
                            <span className="text-white">{"="}</span>
                            <span className="text-green-300">{"\"https://vibe-vaults.com/widget.js\""}</span>
                            <span className="text-pink-400">{" data-key"}</span>
                            <span className="text-white">{"="}</span>
                            <span className="text-green-300">{"\"vv_abc123\""}</span>
                            <span className="text-pink-400">{" async></script>"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-24 bg-white overflow-hidden">
            <div className="max-w-7xl mx-auto px-8">
                <div className="text-center mb-16">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-5xl font-extrabold mb-4"
                    >
                        How it works
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-gray-500 max-w-2xl mx-auto"
                    >
                        VibeVaults is designed to be up and running in minutes, not hours.
                    </motion.p>
                </div>

                <div className="grid lg:grid-cols-3 gap-12 items-start relative text-center">
                    {/* Connection lines (desktop) */}
                    <div className="hidden lg:block absolute top-8 left-[15%] right-[15%] h-0.5 pointer-events-none">
                        <div className="w-full h-full bg-linear-to-r from-gray-100 via-gray-200 to-gray-100" />
                    </div>

                    {steps.map((step, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.2 }}
                            className="flex flex-col items-center text-center group"
                        >
                            <div className="relative mb-10">
                                {/* Radiant Aura/Halo */}
                                <div
                                    className="absolute inset-0 rounded-full blur-3xl opacity-20 transition-opacity duration-500 group-hover:opacity-40"
                                    style={{
                                        background: `linear-gradient(to right, var(--primary), var(--secondary))`,
                                        backgroundSize: '300% 100%',
                                        backgroundPosition: `${index * 50}% 0%`
                                    }}
                                />

                                {/* Glass Container */}
                                <div className="w-24 h-24 rounded-[2.5rem] bg-white/60 backdrop-blur-2xl border border-white/40 flex items-center justify-center relative z-10 shadow-2xl shadow-gray-200/50 group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500 ring-1 ring-black/5">
                                    <step.icon
                                        size={40}
                                        strokeWidth={1.5}
                                        style={{
                                            color: index === 0 ? 'var(--primary)' : index === 2 ? 'var(--secondary)' : '#9f5987' // Mix for middle icon
                                        }}
                                        className="transition-colors duration-500"
                                    />

                                    {/* Step Number Badge */}
                                    <div className="absolute -top-3 -right-3 w-10 h-10 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-[16px] font-black text-gray-900 shadow-xl group-hover:rotate-12 transition-transform duration-500">
                                        {index + 1}
                                    </div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                            <p className="text-gray-500 mb-8 leading-relaxed px-4 text-lg">
                                {step.description}
                            </p>

                            {step.isCode && (
                                <div className="w-full mt-4 max-w-sm">
                                    <CodeSnippet />
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Developer help CTA */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className="mt-20 max-w-4xl mx-auto p-8 rounded-3xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden"
                >
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6 text-left relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-primary shadow-xl border border-gray-100 shrink-0">
                            <UserPlus size={32} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold text-gray-900 mb-1">Direct Senior Support</h4>
                            <p className="text-gray-600 max-w-md">
                                Skip the chatbots. As a solo founder with 20+ years of experience, I personally handle every support request to ensure your agency stays at top speed.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/auth/register"
                        className="group flex items-center gap-3 px-8 py-4 bg-primary text-white hover:bg-primary/90 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-1 relative z-10 w-full md:w-auto justify-center"
                    >
                        Try VibeVaults Free
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};
