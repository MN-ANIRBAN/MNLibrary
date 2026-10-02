import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { motion, useAnimation, useReducedMotion } from "framer-motion";

const PlusIcon = forwardRef(
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
        if (!isControlled.current) {
          controls.start("normal");
        } else {
          onMouseLeave?.(e);
        }
      },
      [controls, onMouseLeave]
    );

    const plusVariants = {
      normal: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.2, 0.85, 1],
        rotate: [0, 10, -10, 0],
        transition: { duration: 1 * duration, ease: "easeInOut", repeat: 0 },
      },
    };

    const lineVariants = {
      normal: { pathLength: 1, opacity: 1 },
      animate: {
        pathLength: [0, 1],
        opacity: 1,
        transition: {
          duration: 0.6 * duration,
          ease: "easeInOut",
          repeat: 0,
          repeatDelay: 0.4,
        },
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
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={controls}
          initial="normal"
          variants={plusVariants}
        >
          <motion.path d="M5 12h14" variants={lineVariants} />
          <motion.path d="M12 5v14" variants={lineVariants} />
        </motion.svg>
      </motion.div>
    );
  }
);

PlusIcon.displayName = "PlusIcon";
export default PlusIcon;
