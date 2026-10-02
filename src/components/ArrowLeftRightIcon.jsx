import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { LazyMotion, domAnimation, m, useAnimation, useReducedMotion } from "framer-motion";

const ArrowLeftRightIcon = forwardRef(
  (
    {
      onMouseEnter,
      onMouseLeave,
      className,
      size = 24,
      duration = 1,
      isAnimated = true,
      color,
      ...props
    },
    ref,
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
        else if (onMouseEnter) onMouseEnter(e);
      },
      [controls, reduced, isAnimated, onMouseEnter],
    );

    const handleLeave = useCallback(
      (e) => {
        if (!isControlled.current) {
          controls.start("normal");
        } else {
          if (onMouseLeave) onMouseLeave(e);
        }
      },
      [controls, onMouseLeave],
    );

    const leftVariants = {
      normal: { x: 0 },
      animate: {
        x: [0, -3, 0],
        transition: {
          duration: 0.6 * duration,
          times: [0, 0.5, 1],
          ease: "easeInOut",
        },
      },
    };

    const rightVariants = {
      normal: { x: 0 },
      animate: {
        x: [0, 3, 0],
        transition: {
          duration: 0.6 * duration,
          times: [0, 0.5, 1],
          ease: "easeInOut",
        },
      },
    };

    return (
      <LazyMotion features={domAnimation} strict>
        <m.div
          className={className}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, ...props.style }}
          {...props}
        >
          <m.svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={controls}
            initial="normal"
          >
            <m.path d="M8 3 4 7l4 4" variants={leftVariants} />
            <m.path d="M4 7h16" variants={leftVariants} />
            <m.path d="m16 21 4-4-4-4" variants={rightVariants} />
            <m.path d="M20 17H4" variants={rightVariants} />
          </m.svg>
        </m.div>
      </LazyMotion>
    );
  },
);

ArrowLeftRightIcon.displayName = "ArrowLeftRightIcon";
export { ArrowLeftRightIcon };
