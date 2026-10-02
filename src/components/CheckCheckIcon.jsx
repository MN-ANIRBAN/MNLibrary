import React, { forwardRef, useCallback, useImperativeHandle, useRef, useEffect } from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";

const CheckCheckIcon = forwardRef(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className = "",
      size = 24,
      duration = 1,
      isAnimated = true,
      color,
      style,
      ...props
    },
    ref
  ) => {
    const controls = useAnimation();
    const reduced = useReducedMotion();
    const isControlled = useRef(false);

    useImperativeHandle(ref, () => {
      isControlled.current = true;
      return {
        startAnimation: () =>
          reduced ? controls.start("normal") : controls.start("animate"),
        stopAnimation: () => controls.start("normal"),
      };
    });

    useEffect(() => {
      if (isAnimated && !isControlled.current) {
        controls.start("animate");
      }
    }, [isAnimated, controls]);

    const handleEnter = useCallback(
      (e) => {
        if (!isAnimated || reduced) return;
        if (!isControlled.current) controls.start("animate");
        else onMouseEnter?.(e);
      },
      [controls, reduced, isAnimated, onMouseEnter]
    );

    const handleLeave = useCallback(
      (e) => {
        if (!isControlled.current) controls.start("normal");
        else onMouseLeave?.(e);
      },
      [controls, onMouseLeave]
    );

    const tick1Variants = {
      normal: { strokeDashoffset: 0, scale: 1, opacity: 1 },
      animate: {
        strokeDashoffset: [20, 0],
        scale: [1, 1.2, 1],
        opacity: [0.5, 1],
        transition: { duration: 0.7 * duration, ease: "easeInOut" },
      },
    };

    const tick2Variants = {
      normal: { opacity: 1, x: 0 },
      animate: {
        opacity: [0, 1],
        x: [-6, 0],
        transition: { duration: 0.5 * duration, ease: "easeOut", delay: 0.35 },
      },
    };

    return (
      <motion.div
        className={`inline-flex items-center justify-center ${className}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        {...props}
        style={{ color, ...style }}
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <motion.path
            d="M18 6 7 17l-5-5"
            strokeDasharray="20"
            strokeDashoffset="0"
            variants={tick1Variants}
            initial="normal"
            animate={controls}
          />
          <motion.path
            d="m22 10-7.5 7.5L13 16"
            strokeDasharray="20"
            strokeDashoffset="0"
            variants={tick2Variants}
            initial="normal"
            animate={controls}
          />
        </motion.svg>
      </motion.div>
    );
  }
);

CheckCheckIcon.displayName = "CheckCheckIcon";
export default CheckCheckIcon;
