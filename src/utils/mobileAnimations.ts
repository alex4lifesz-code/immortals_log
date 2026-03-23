export const mobileAnimations = {
  press: { scale: 0.95, transition: { duration: 0.12 } },
  quickPress: { scale: 0.97, transition: { duration: 0.08 } },
  screenEnter: { x: 22, opacity: 0 },
  screenAnimate: { x: 0, opacity: 1, transition: { duration: 0.22 } },
  screenExit: { x: 14, opacity: 0, transition: { duration: 0.16 } },
  modalEnter: { y: 38, opacity: 0 },
  modalAnimate: { y: 0, opacity: 1, transition: { type: "spring", damping: 24, stiffness: 280 } },
  modalExit: { y: 24, opacity: 0, transition: { duration: 0.16 } },
  staggerContainer: {
    hidden: {},
    show: { transition: { staggerChildren: 0.04 } },
  },
  staggerItem: {
    hidden: { y: 8, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.2 } },
  },
} as const;
