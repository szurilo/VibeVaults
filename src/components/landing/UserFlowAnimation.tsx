"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, CheckCircle, PieChart, Users, ArrowRight, MousePointer2 } from "lucide-react";

const STAGES = ["visitor", "widget", "success", "dashboard"];

export const UserFlowAnimation = () => {
    const [stage, setStage] = useState(0);
    const [text, setText] = useState("");
    const fullText = "I love the UX, any plans to add a dark mode? ✨";

    useEffect(() => {
        const timer = setInterval(() => {
            setStage((prev) => (prev + 1) % STAGES.length);
        }, 4500);

        return () => clearInterval(timer);
    }, []);

    // Handle typing effect during 'widget' stage
    useEffect(() => {
        if (STAGES[stage] === "widget") {
            let i = 0;
            const typeTimer = setInterval(() => {
                setText(fullText.slice(0, i));
                i++;
                if (i > fullText.length) clearInterval(typeTimer);
            }, 50);
            return () => clearInterval(typeTimer);
        } else if (STAGES[stage] === "visitor") {
            setText("");
        }
    }, [stage]);

    return (
        <div className="relative w-full max-w-4xl mx-auto aspect-video rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-2xl">
            {/* Top Bar / Toolbar */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-gray-50 border-b border-gray-100 flex items-center px-4 gap-2 z-20">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="mx-auto bg-gray-200 h-5 w-48 rounded-md flex items-center justify-center text-[10px] text-gray-400 font-medium">
                    {STAGES[stage] === "dashboard" ? "vibevaults.com/dashboard" : "yourwebsite.com"}
                </div>
            </div>

            <div className="pt-10 h-full w-full relative">
                <AnimatePresence mode="wait">
                    {/* VISITOR STAGE */}
                    {(STAGES[stage] === "visitor" || STAGES[stage] === "widget" || STAGES[stage] === "success") && (
                        <motion.div
                            key="visitor-side"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="h-full w-full bg-slate-50 p-8 flex flex-col gap-6"
                        >
                            {/* Mock Website Content */}
                            <div className="w-1/2 h-8 bg-gray-200 rounded-lg animate-pulse" />
                            <div className="w-3/4 h-24 bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
                                <div className="w-full h-3 bg-gray-100 rounded-full" />
                                <div className="w-5/6 h-3 bg-gray-100 rounded-full" />
                                <div className="w-2/3 h-3 bg-gray-100 rounded-full" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="aspect-square bg-white rounded-xl border border-gray-100 shadow-sm" />
                                ))}
                            </div>

                            {/* Cursor Animation */}
                            {STAGES[stage] === "visitor" && (
                                <motion.div
                                    initial={{ x: 400, y: 300, opacity: 0 }}
                                    animate={{ x: 798, y: 364, opacity: 1 }}
                                    transition={{ delay: 1, duration: 1.5, ease: "easeInOut" }}
                                    className="absolute z-50 text-secondary"
                                >
                                    <MousePointer2 size={32} fill="currentColor" strokeWidth={1} color="white" />
                                </motion.div>
                            )}

                            {/* Floating Widget Button */}
                            <motion.button
                                layoutId="widget-btn"
                                className="absolute bottom-8 right-8 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center text-white"
                                whileHover={{ scale: 1.05 }}
                            >
                                <MessageSquare size={24} />
                            </motion.button>

                            {/* Widget Modal */}
                            <AnimatePresence>
                                {(STAGES[stage] === "widget" || STAGES[stage] === "success") && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        className="absolute bottom-24 right-8 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                                    >
                                        <div className="bg-primary p-4 text-white">
                                            <h4 className="font-bold text-sm">Send us your feedback</h4>
                                            <p className="text-[10px] opacity-80">We'd love to hear from you!</p>
                                        </div>
                                        <div className="p-4 flex flex-col gap-3">
                                            {STAGES[stage] === "widget" ? (
                                                <>
                                                    <div className="min-h-[80px] p-2 bg-gray-50 rounded-lg text-xs text-gray-600 border border-gray-100">
                                                        {text}
                                                        <motion.span
                                                            animate={{ opacity: [0, 1] }}
                                                            transition={{ repeat: Infinity, duration: 0.5 }}
                                                            className="inline-block w-0.5 h-3 bg-primary ml-0.5"
                                                        />
                                                    </div>
                                                    <motion.button
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: text.length > 10 ? 1 : 0.5 }}
                                                        className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                                                    >
                                                        Send Feedback <Send size={12} />
                                                    </motion.button>
                                                </>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="py-8 flex flex-col items-center justify-center gap-3 text-center"
                                                >
                                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                                        <CheckCircle size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm text-gray-800">Thank you!</p>
                                                        <p className="text-[10px] text-gray-500">Your feedback has been sent.</p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* DASHBOARD STAGE */}
                    {STAGES[stage] === "dashboard" && (
                        <motion.div
                            key="dashboard-side"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="h-full w-full bg-white flex"
                        >
                            {/* Sidebar */}
                            <div className="w-16 border-r border-gray-100 flex flex-col items-center py-6 gap-6">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                    <PieChart size={18} />
                                </div>
                                <div className="w-8 h-8 text-gray-300 flex items-center justify-center">
                                    <Users size={18} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 flex flex-col">
                                <header className="h-14 border-b border-gray-100 flex items-center justify-between px-6">
                                    <div className="h-4 w-32 bg-gray-100 rounded-full" />
                                    <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                                        <CheckCircle size={16} />
                                    </div>
                                </header>

                                <main className="p-6 flex flex-col gap-6">
                                    <div className="flex gap-4">
                                        <div className="flex-1 h-20 bg-primary/5 rounded-2xl border border-primary/10 p-4 flex flex-col justify-between">
                                            <div className="h-2 w-16 bg-primary/20 rounded-full" />
                                            <div className="h-6 w-12 bg-primary/30 rounded-lg" />
                                        </div>
                                        <div className="flex-1 h-20 bg-secondary/5 rounded-2xl border border-secondary/10 p-4 flex flex-col justify-between">
                                            <div className="h-2 w-16 bg-secondary/20 rounded-full" />
                                            <div className="h-6 w-12 bg-secondary/30 rounded-lg" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <div className="h-4 w-40 bg-gray-100 rounded-full" />

                                        {/* The Feed */}
                                        <div className="flex flex-col gap-2">
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, backgroundColor: "rgba(32, 156, 238, 0.1)" }}
                                                animate={{ opacity: 1, y: 0, backgroundColor: "rgba(255, 255, 255, 1)" }}
                                                transition={{ duration: 0.8, delay: 0.5 }}
                                                className="p-4 rounded-xl border border-primary/20 shadow-sm flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white text-[10px] font-bold">JD</div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-800">{fullText}</p>
                                                        <p className="text-[9px] text-gray-400">Just now • on pricing page</p>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            {[1, 2].map(i => (
                                                <div key={i} className="p-4 rounded-xl border border-gray-100 flex items-center justify-between opacity-50">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 bg-gray-200 rounded-full" />
                                                        <div className="flex flex-col gap-1">
                                                            <div className="h-2 w-32 bg-gray-100 rounded-full" />
                                                            <div className="h-2 w-20 bg-gray-50 rounded-full" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </main>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Connection Line / Step Indicators */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-gray-100 shadow-sm z-30">
                {STAGES.map((s, i) => (
                    <div key={s} className="flex items-center gap-3">
                        <div
                            className={`w-2 h-2 rounded-full transition-colors duration-500 ${stage === i ? "bg-primary scale-125" : "bg-gray-200"
                                }`}
                        />
                        {i < STAGES.length - 1 && <ArrowRight size={12} className="text-gray-300" />}
                    </div>
                ))}
            </div>
        </div>
    );
};
