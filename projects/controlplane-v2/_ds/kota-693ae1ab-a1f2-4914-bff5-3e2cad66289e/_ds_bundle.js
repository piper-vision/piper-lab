/* @ds-bundle: {"format":4,"namespace":"KOTADesignSystem_693ae1","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Capsule","sourcePath":"components/core/Capsule.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Placeholder","sourcePath":"ui_kits/website/Placeholder.jsx"},{"name":"WebsiteContact","sourcePath":"ui_kits/website/WebsiteContact.jsx"},{"name":"WebsiteFooter","sourcePath":"ui_kits/website/WebsiteFooter.jsx"},{"name":"WebsiteHeader","sourcePath":"ui_kits/website/WebsiteHeader.jsx"},{"name":"WebsiteHome","sourcePath":"ui_kits/website/WebsiteHome.jsx"},{"name":"WebsiteStudio","sourcePath":"ui_kits/website/WebsiteStudio.jsx"},{"name":"WebsiteWork","sourcePath":"ui_kits/website/WebsiteWork.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"357077f50632","components/core/Button.jsx":"971f94ca7934","components/core/Capsule.jsx":"306200db2f76","components/core/Card.jsx":"a3f1dc856c80","components/core/IconButton.jsx":"86c5041c56cc","components/core/Tag.jsx":"1b286e68425a","components/feedback/Dialog.jsx":"937a836514b2","components/feedback/Toast.jsx":"f39ee3a138dd","components/feedback/Tooltip.jsx":"78522f981a3f","components/forms/Checkbox.jsx":"ddf92b6e83e3","components/forms/Input.jsx":"60ddf05bcd8a","components/forms/Radio.jsx":"524860d1b919","components/forms/Select.jsx":"c5c1ed051f2d","components/forms/Switch.jsx":"c7fd12ebeb6b","components/navigation/Breadcrumb.jsx":"d797fe7fa52a","components/navigation/Tabs.jsx":"fade762c6f98","ui_kits/website/Placeholder.jsx":"b2addebedee3","ui_kits/website/WebsiteContact.jsx":"a5ae24c4c3f3","ui_kits/website/WebsiteFooter.jsx":"026ec569e809","ui_kits/website/WebsiteHeader.jsx":"2a8ed9c2e3b3","ui_kits/website/WebsiteHome.jsx":"50fe8e95554b","ui_kits/website/WebsiteStudio.jsx":"a6c0d351a01f","ui_kits/website/WebsiteWork.jsx":"64344fea8cbe"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.KOTADesignSystem_693ae1 = window.KOTADesignSystem_693ae1 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  black: {
    background: "var(--kota-black)",
    color: "var(--kota-white)"
  },
  white: {
    background: "var(--kota-white)",
    color: "var(--kota-black)"
  },
  pink: {
    background: "var(--kota-pink)",
    color: "var(--kota-black)"
  },
  purple: {
    background: "var(--kota-purple)",
    color: "var(--kota-black)"
  },
  blue: {
    background: "var(--kota-blue)",
    color: "var(--kota-black)"
  },
  green: {
    background: "var(--kota-green)",
    color: "var(--kota-black)"
  },
  peach: {
    background: "var(--kota-peach)",
    color: "var(--kota-black)"
  }
};

/** Small filled pill for meta: years, counts, statuses. */
function Badge({
  tone = "black",
  children,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.black;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 12px",
      borderRadius: "var(--radius-pill)",
      font: "500 12.5px/1.2 var(--font-primary)",
      letterSpacing: "0.02em",
      ...t,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 36,
    padding: "0 18px",
    font: "500 14px/1 var(--font-primary)"
  },
  md: {
    height: 46,
    padding: "0 24px",
    font: "500 15.5px/1 var(--font-primary)"
  },
  lg: {
    height: 56,
    padding: "0 32px",
    font: "500 17px/1 var(--font-primary)"
  }
};
const Arrow = ({
  color
}) => /*#__PURE__*/React.createElement("svg", {
  width: "14",
  height: "14",
  viewBox: "0 0 14 14",
  style: {
    display: "block"
  },
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M2 7h9M7 2.5 11.5 7 7 11.5",
  fill: "none",
  stroke: color,
  strokeWidth: "1.6"
}));

/**
 * KOTA pill button. Flat, keyline-driven; hover inverts fill.
 * variant: "primary" (black fill) | "outline" (keyline) | "inverse" (white fill, for dark surfaces)
 */
function Button({
  variant = "primary",
  size = "md",
  arrow = false,
  disabled = false,
  children,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const looks = {
    primary: {
      base: {
        background: "var(--kota-black)",
        color: "var(--kota-white)",
        border: "1px solid var(--kota-black)"
      },
      hover: {
        background: "var(--kota-white)",
        color: "var(--kota-black)",
        border: "1px solid var(--kota-black)"
      }
    },
    outline: {
      base: {
        background: "transparent",
        color: "var(--kota-black)",
        border: "1px solid var(--kota-black)"
      },
      hover: {
        background: "var(--kota-black)",
        color: "var(--kota-white)",
        border: "1px solid var(--kota-black)"
      }
    },
    inverse: {
      base: {
        background: "var(--kota-white)",
        color: "var(--kota-black)",
        border: "1px solid var(--kota-white)"
      },
      hover: {
        background: "transparent",
        color: "var(--kota-white)",
        border: "1px solid var(--kota-white)"
      }
    }
  };
  const look = looks[variant] || looks.primary;
  const cur = hover && !disabled ? look.hover : look.base;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: s.height,
      padding: s.padding,
      font: s.font,
      borderRadius: "var(--radius-pill)",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
      ...cur,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", null, children), arrow && /*#__PURE__*/React.createElement(Arrow, {
    color: cur.color === "var(--kota-white)" ? "#fff" : "#000"
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Capsule.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const COLORS = {
  pink: "var(--kota-pink)",
  purple: "var(--kota-purple)",
  blue: "var(--kota-blue)",
  green: "var(--kota-green)",
  peach: "var(--kota-peach)"
};

/**
 * Rotated colour capsule — KOTA's value pills ("Get Dirty Quickly").
 * Decorative display element, not a control.
 */
function Capsule({
  color = "pink",
  rotate = -8,
  size = "md",
  children,
  style,
  ...rest
}) {
  const sizes = {
    sm: "400 16px/1.2 var(--font-primary)",
    md: "400 21px/1.2 var(--font-primary)",
    lg: "400 28px/1.2 var(--font-primary)"
  };
  const pad = {
    sm: "14px 22px",
    md: "22px 32px",
    lg: "30px 44px"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: COLORS[color] || COLORS.pink,
      color: "var(--kota-black)",
      borderRadius: "var(--radius-pill)",
      padding: pad[size] || pad.md,
      font: sizes[size] || sizes.md,
      transform: `rotate(${rotate}deg)`,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Capsule });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Capsule.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SURFACES = {
  white: {
    background: "var(--kota-white)",
    color: "var(--text-primary)"
  },
  grey: {
    background: "var(--kota-grey)",
    color: "var(--text-primary)"
  },
  black: {
    background: "var(--kota-black)",
    color: "var(--text-inverse)"
  },
  pink: {
    background: "var(--kota-pink)",
    color: "var(--text-primary)"
  },
  purple: {
    background: "var(--kota-purple)",
    color: "var(--text-primary)"
  },
  blue: {
    background: "var(--kota-blue)",
    color: "var(--text-primary)"
  },
  green: {
    background: "var(--kota-green)",
    color: "var(--text-primary)"
  },
  peach: {
    background: "var(--kota-peach)",
    color: "var(--text-primary)"
  },
  "flow-light": {
    background: "var(--flow-light)",
    color: "var(--text-primary)"
  },
  "flow-dark": {
    background: "var(--flow-dark)",
    color: "var(--text-inverse)"
  }
};

/**
 * Flat KOTA surface. No shadows — separation comes from colour blocking.
 */
function Card({
  surface = "white",
  keyline = false,
  padding = 32,
  radius,
  children,
  style,
  ...rest
}) {
  const s = SURFACES[surface] || SURFACES.white;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      ...s,
      border: keyline ? "var(--keyline)" : "none",
      borderRadius: radius != null ? radius : "var(--radius-card)",
      padding,
      boxSizing: "border-box",
      font: "var(--text-body)",
      fontFamily: "var(--font-primary)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Circular icon button — e.g. the circled hamburger in the site header.
 * Pass an SVG as children; defaults to a hamburger glyph.
 */
function IconButton({
  variant = "outline",
  size = 46,
  label = "menu",
  inverse = false,
  children,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const bg = inverse ? "var(--kota-black)" : "var(--kota-white)";
  const filled = variant === "solid" ? !hover : hover;
  const stroke = filled ? bg : fg;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: size,
      height: size,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
      border: `1px solid ${fg}`,
      background: filled ? fg : "transparent",
      color: stroke,
      cursor: "pointer",
      padding: 0,
      transition: "background var(--duration-fast) var(--ease-out)",
      ...style
    }
  }, rest), children || /*#__PURE__*/React.createElement("svg", {
    width: size * 0.44,
    height: size * 0.44,
    viewBox: "0 0 20 20",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 7h16M2 13h16",
    stroke: stroke,
    strokeWidth: "1.6",
    fill: "none"
  })));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Keyline tag chip — service tags like "Web development", "Copywriting".
 * Selected = filled black. Interactive when onClick given.
 */
function Tag({
  selected = false,
  inverse = false,
  children,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const bg = inverse ? "var(--kota-black)" : "var(--kota-white)";
  const active = selected || hover && !!onClick;
  return /*#__PURE__*/React.createElement("span", _extends({
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    role: onClick ? "button" : undefined,
    style: {
      display: "inline-flex",
      alignItems: "center",
      padding: "9px 18px",
      borderRadius: "var(--radius-pill)",
      border: `1px solid ${fg}`,
      background: active ? fg : "transparent",
      color: active ? bg : fg,
      font: "400 14px/1.2 var(--font-primary)",
      cursor: onClick ? "pointer" : "default",
      transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/**
 * Modal dialog — black scrim, white panel, circled × close.
 */
function Dialog({
  open = false,
  onClose,
  title,
  actions,
  width = 520,
  children
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "var(--overlay-scrim)",
      display: "grid",
      placeItems: "center",
      zIndex: 100,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      background: "var(--kota-white)",
      borderRadius: "var(--radius-image)",
      padding: 40,
      width,
      maxWidth: "100%",
      boxSizing: "border-box",
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h3)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "close",
    onClick: onClose,
    style: {
      width: 40,
      height: 40,
      borderRadius: "50%",
      border: "1px solid var(--kota-black)",
      background: "transparent",
      cursor: "pointer",
      display: "grid",
      placeItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 14 14",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 2l10 10M12 2 2 12",
    stroke: "#000",
    strokeWidth: "1.6"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-body)",
      color: "var(--text-secondary)",
      marginTop: 14
    }
  }, children), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginTop: 28
    }
  }, actions)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const ACCENTS = {
  none: null,
  pink: "var(--kota-pink)",
  purple: "var(--kota-purple)",
  blue: "var(--kota-blue)",
  green: "var(--kota-green)",
  peach: "var(--kota-peach)"
};

/**
 * Toast — black rounded bar, white text, optional colour dot accent.
 */
function Toast({
  message,
  accent = "none",
  onDismiss,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      background: "var(--kota-black)",
      color: "var(--kota-white)",
      borderRadius: "var(--radius-pill)",
      padding: "14px 20px",
      font: "400 15px/1.3 var(--font-primary)",
      ...style
    }
  }, ACCENTS[accent] && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: ACCENTS[accent],
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, message), onDismiss && /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "dismiss",
    onClick: onDismiss,
    style: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: 4,
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 12 12",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1.5 1.5l9 9M10.5 1.5l-9 9",
    stroke: "#fff",
    strokeWidth: "1.5"
  }))));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/**
 * Tooltip — black rounded callout (like the brand book's annotation bubbles).
 * Wraps its child; shows on hover.
 */
function Tooltip({
  label,
  side = "top",
  children
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: "calc(100% + 10px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    bottom: {
      top: "calc(100% + 10px)",
      left: "50%",
      transform: "translateX(-50%)"
    },
    left: {
      right: "calc(100% + 10px)",
      top: "50%",
      transform: "translateY(-50%)"
    },
    right: {
      left: "calc(100% + 10px)",
      top: "50%",
      transform: "translateY(-50%)"
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: "absolute",
      ...pos[side],
      background: "var(--kota-black)",
      color: "var(--kota-white)",
      font: "500 13.5px/1.35 var(--font-primary)",
      padding: "10px 16px",
      borderRadius: 14,
      whiteSpace: "nowrap",
      zIndex: 50,
      pointerEvents: "none"
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/** Square keyline checkbox; checked = black fill + white tick. */
function Checkbox({
  label,
  checked,
  defaultChecked = false,
  onChange,
  inverse = false,
  disabled = false,
  style
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const bg = inverse ? "var(--kota-black)" : "var(--kota-white)";
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  return /*#__PURE__*/React.createElement("span", {
    role: "checkbox",
    "aria-checked": on,
    tabIndex: disabled ? -1 : 0,
    onClick: toggle,
    onKeyDown: e => (e.key === " " || e.key === "Enter") && toggle(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      font: "400 15px/1.3 var(--font-primary)",
      color: fg,
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      border: `1px solid ${fg}`,
      borderRadius: 4,
      background: on ? fg : "transparent",
      display: "grid",
      placeItems: "center",
      transition: "background var(--duration-fast) var(--ease-out)",
      flexShrink: 0
    }
  }, on && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 11 11",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1.8 5.6 4.4 8.2 9.2 2.8",
    fill: "none",
    stroke: bg,
    strokeWidth: "1.8"
  }))), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * KOTA text input — pill keyline field with uppercase caption label.
 */
function Input({
  label,
  placeholder,
  value,
  defaultValue,
  onChange,
  type = "text",
  inverse = false,
  disabled = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const sub = inverse ? "var(--text-inverse-secondary)" : "var(--text-secondary)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: 8,
      font: "var(--text-caption)",
      fontFamily: "var(--font-primary)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: sub,
      ...style
    }
  }, label, /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    placeholder: placeholder,
    value: value,
    defaultValue: defaultValue,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      height: 46,
      padding: "0 20px",
      borderRadius: "var(--radius-pill)",
      border: `${focus ? 2 : 1}px solid ${fg}`,
      margin: focus ? 0 : 1,
      background: "transparent",
      color: fg,
      font: "400 15.5px/1.2 var(--font-primary)",
      outline: "none",
      opacity: disabled ? 0.35 : 1,
      boxSizing: "border-box",
      width: "100%"
    }
  }, rest)));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
/** Keyline radio; selected = black dot. Use RadioGroup-style via name. */
function Radio({
  label,
  checked,
  defaultChecked = false,
  onChange,
  inverse = false,
  disabled = false,
  style
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const pick = () => {
    if (disabled) return;
    if (!isControlled) setInternal(true);
    onChange && onChange(true);
  };
  return /*#__PURE__*/React.createElement("span", {
    role: "radio",
    "aria-checked": on,
    tabIndex: disabled ? -1 : 0,
    onClick: pick,
    onKeyDown: e => (e.key === " " || e.key === "Enter") && pick(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      font: "400 15px/1.3 var(--font-primary)",
      color: fg,
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      border: `1px solid ${fg}`,
      borderRadius: "50%",
      display: "grid",
      placeItems: "center",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: fg,
      transform: on ? "scale(1)" : "scale(0)",
      transition: "transform var(--duration-fast) var(--ease-out)"
    }
  })), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Pill keyline select with chevron.
 */
function Select({
  label,
  options = [],
  value,
  defaultValue,
  onChange,
  inverse = false,
  disabled = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const sub = inverse ? "var(--text-inverse-secondary)" : "var(--text-secondary)";
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: 8,
      font: "var(--text-caption)",
      fontFamily: "var(--font-primary)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: sub,
      position: "relative",
      ...style
    }
  }, label, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "block"
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    defaultValue: defaultValue,
    disabled: disabled,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      height: 46,
      padding: "0 44px 0 20px",
      borderRadius: "var(--radius-pill)",
      border: `${focus ? 2 : 1}px solid ${fg}`,
      background: "transparent",
      color: fg,
      font: "400 15.5px/1.2 var(--font-primary)",
      outline: "none",
      appearance: "none",
      WebkitAppearance: "none",
      width: "100%",
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      boxSizing: "border-box"
    }
  }, rest), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: typeof o === "string" ? o : o.value,
    value: typeof o === "string" ? o : o.value
  }, typeof o === "string" ? o : o.label))), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    style: {
      position: "absolute",
      right: 18,
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none"
    },
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 4l4 4 4-4",
    fill: "none",
    stroke: inverse ? "#fff" : "#000",
    strokeWidth: "1.5"
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/** Pill switch — keyline track, sliding dot; on = black track, white dot. */
function Switch({
  label,
  checked,
  defaultChecked = false,
  onChange,
  inverse = false,
  disabled = false,
  style
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const bg = inverse ? "var(--kota-black)" : "var(--kota-white)";
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  return /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": on,
    tabIndex: disabled ? -1 : 0,
    onClick: toggle,
    onKeyDown: e => (e.key === " " || e.key === "Enter") && toggle(),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 12,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? 0.35 : 1,
      font: "400 15px/1.3 var(--font-primary)",
      color: fg,
      userSelect: "none",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 26,
      borderRadius: "var(--radius-pill)",
      border: `1px solid ${fg}`,
      background: on ? fg : "transparent",
      position: "relative",
      transition: "background var(--duration-fast) var(--ease-out)",
      flexShrink: 0,
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: on ? 23 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: on ? bg : fg,
      transition: "left var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)"
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
/**
 * Syne Bold breadcrumb — the brand's stated home for the supporting typeface.
 */
function Breadcrumb({
  items = [],
  inverse = false,
  style
}) {
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const sub = inverse ? "var(--text-inverse-secondary)" : "var(--text-secondary)";
  return /*#__PURE__*/React.createElement("nav", {
    "aria-label": "breadcrumb",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      font: "var(--text-breadcrumb)",
      fontFamily: "var(--font-accent)",
      letterSpacing: "var(--tracking-accent)",
      textTransform: "uppercase",
      ...style
    }
  }, items.map((it, i) => {
    const last = i === items.length - 1;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: last ? fg : sub
      }
    }, it), !last && /*#__PURE__*/React.createElement("span", {
      style: {
        color: sub
      }
    }, "/"));
  }));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Pill tab group — active tab fills black (white on dark).
 */
function Tabs({
  items = [],
  active,
  defaultActive,
  onChange,
  inverse = false,
  style
}) {
  const isControlled = active !== undefined;
  const [internal, setInternal] = React.useState(defaultActive != null ? defaultActive : items[0]);
  const cur = isControlled ? active : internal;
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  const bg = inverse ? "var(--kota-black)" : "var(--kota-white)";
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "inline-flex",
      gap: 6,
      padding: 6,
      border: `1px solid ${inverse ? "var(--border-inverse-subtle)" : "var(--border-subtle)"}`,
      borderRadius: "var(--radius-pill)",
      ...style
    }
  }, items.map(it => {
    const on = it === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: it,
      role: "tab",
      "aria-selected": on,
      onClick: () => {
        if (!isControlled) setInternal(it);
        onChange && onChange(it);
      },
      style: {
        border: "none",
        background: on ? fg : "transparent",
        color: on ? bg : fg,
        font: "400 14.5px/1 var(--font-primary)",
        padding: "10px 20px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)"
      }
    }, it);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Placeholder.jsx
try { (() => {
/** Striped image placeholder — swap for real photography/work shots. */
function Placeholder({
  label = "image",
  height = 200,
  radius = "var(--radius-image)",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "repeating-linear-gradient(45deg, #dcdcdc 0 10px, #e9e9e9 10px 20px)",
      borderRadius: radius,
      height,
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "11px/1.4 ui-monospace, monospace",
      color: "#666",
      textAlign: "center",
      padding: "0 12px"
    }
  }, label));
}
Object.assign(__ds_scope, { Placeholder });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Placeholder.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteContact.jsx
try { (() => {
const underline = {
  textDecoration: "underline",
  textDecorationThickness: "var(--underline-thickness)",
  textUnderlineOffset: "var(--underline-offset)"
};

/** Contact — split layout: headline + form card, black info card. */
function WebsiteContact() {
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "72px var(--page-gutter) 96px",
      fontFamily: "var(--font-primary)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--text-display)",
      fontSize: "clamp(48px, 6vw, 88px)",
      letterSpacing: "var(--tracking-display)",
      maxWidth: 900
    }
  }, "Let's make your brand a ", /*#__PURE__*/React.createElement("span", {
    style: underline
  }, "damn site"), " better."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--text-body-lg)",
      color: "var(--text-secondary)",
      maxWidth: 420,
      marginTop: 20,
      marginBottom: 0
    }
  }, "Let's get cracking."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      gap: 24,
      marginTop: 56,
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--kota-white)",
      borderRadius: "var(--radius-image)",
      padding: 40,
      display: "grid",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Input, {
    label: "Your name",
    placeholder: "Sam Smith"
  }), /*#__PURE__*/React.createElement(__ds_scope.Input, {
    label: "Your email",
    placeholder: "sam@brand.com"
  })), /*#__PURE__*/React.createElement(__ds_scope.Select, {
    label: "What do you need?",
    options: ["Branding", "Website", "Digital product", "The whole lot"],
    defaultValue: "Website"
  }), /*#__PURE__*/React.createElement(__ds_scope.Input, {
    label: "Tell us more",
    placeholder: "Where does your brand need to go?"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Checkbox, {
    label: "Send me the newsletter"
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    arrow: true,
    onClick: () => setSent(true)
  }, "Start your project"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--kota-black)",
      color: "var(--kota-white)",
      borderRadius: "var(--radius-image)",
      padding: 40,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: 32
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/kota-logo-keyline-white.svg",
    alt: "KOTA",
    style: {
      width: 72,
      height: 72
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-caption)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      opacity: 0.6
    }
  }, "New business"), /*#__PURE__*/React.createElement("a", {
    href: "mailto:hello@kota.co.uk",
    style: {
      font: "var(--text-h4)",
      color: "var(--kota-white)",
      textDecoration: "none"
    }
  }, "hello@kota.co.uk")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-caption)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      opacity: 0.6
    }
  }, "Studio"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-body)"
    }
  }, "London, UK"))))), sent && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 60
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Toast, {
    message: "Thanks \u2014 we'll be in touch.",
    accent: "green",
    onDismiss: () => setSent(false)
  })));
}
Object.assign(__ds_scope, { WebsiteContact });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteContact.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteFooter.jsx
try { (() => {
/** Black site footer — CTA headline, link columns, meta line. */
function WebsiteFooter() {
  const link = {
    color: "var(--kota-white)",
    textDecoration: "none",
    font: "400 15px/2 var(--font-primary)",
    opacity: 0.8
  };
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: "var(--kota-black)",
      color: "var(--kota-white)",
      padding: "72px var(--page-gutter) 40px",
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 48,
      flexWrap: "wrap",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h1)",
      letterSpacing: "var(--tracking-tight)",
      color: "var(--kota-white)"
    }
  }, "Got a brand that refuses to ", /*#__PURE__*/React.createElement("span", {
    style: {
      textDecoration: "underline",
      textDecorationThickness: "var(--underline-thickness)",
      textUnderlineOffset: "var(--underline-offset)"
    }
  }, "blend in"), "?"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "inverse",
    arrow: true
  }, "Start a project"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 72
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "grid"
    },
    "aria-label": "site"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "Work"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "Studio"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "Journal"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "Contact")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "grid"
    },
    "aria-label": "social"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "Instagram"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "LinkedIn"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: link
  }, "X")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 72,
      paddingTop: 24,
      borderTop: "1px solid var(--border-inverse-subtle)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo/kota-logo-keyline-white.svg",
    alt: "KOTA",
    style: {
      width: 40,
      height: 40
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-caption)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      opacity: 0.6
    }
  }, "\xA9 KOTA \u2014 London")));
}
Object.assign(__ds_scope, { WebsiteFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteFooter.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteHeader.jsx
try { (() => {
/** kota.co.uk header — logo, meta line, circled hamburger. */
function WebsiteHeader({
  inverse = false,
  onMenu,
  meta = "Creative digital agency — London"
}) {
  const fg = inverse ? "var(--kota-white)" : "var(--kota-black)";
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "28px var(--page-gutter)",
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: inverse ? "../../assets/logo/kota-logo-keyline-white.svg" : "../../assets/logo/kota-logo-square.svg",
    alt: "KOTA",
    style: {
      width: 46,
      height: 46,
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--text-caption)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: fg,
      opacity: 0.75
    }
  }, meta)), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    label: "menu",
    inverse: inverse,
    onClick: onMenu
  }));
}
Object.assign(__ds_scope, { WebsiteHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteHome.jsx
try { (() => {
const underline = {
  textDecoration: "underline",
  textDecorationThickness: "var(--underline-thickness)",
  textUnderlineOffset: "var(--underline-offset)"
};

/** Homepage — hero, services tags, Syne strapline band. */
function WebsiteHome() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      position: "relative",
      overflow: "hidden",
      padding: "48px var(--page-gutter) 96px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: -280,
      top: 40,
      width: 640,
      height: 640,
      borderRadius: "50%",
      background: "var(--flow-light)",
      filter: "blur(2px)",
      opacity: 0.9
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "grid",
      gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)",
      gap: 48,
      alignItems: "end"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      font: "var(--text-display)",
      letterSpacing: "var(--tracking-display)",
      textWrap: "balance"
    }
  }, "We are ", /*#__PURE__*/React.createElement("span", {
    style: underline
  }, "experts"), " in bringing brands to life digitally."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 24,
      justifyItems: "start"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--text-body-lg)",
      color: "var(--text-primary)",
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement("b", null, "We're"), " the ", /*#__PURE__*/React.createElement("b", null, "creative digital agency"), " that works with ", /*#__PURE__*/React.createElement("b", null, "brands who refuse to blend in"), ", helping them make sure their branding, website and digital is as ", /*#__PURE__*/React.createElement("b", null, "brilliantly unique"), " as them."), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    arrow: true
  }, "See our work"))), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/graphics/arrow-corner.svg",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      right: "var(--page-gutter)",
      bottom: 40,
      width: 64
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      marginTop: 72,
      display: "flex",
      alignItems: "center",
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 3,
      height: 44,
      background: "var(--kota-black)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 52px/1 var(--font-primary)",
      letterSpacing: "var(--tracking-display)"
    }
  }, "work"))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: "0 var(--page-gutter) 96px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 28px",
      font: "var(--text-h2)",
      letterSpacing: "var(--tracking-tight)",
      maxWidth: 640
    }
  }, "Making brands a damn site better."), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-caption)",
      letterSpacing: "var(--tracking-caps)",
      textTransform: "uppercase",
      color: "var(--text-secondary)",
      marginBottom: 16
    }
  }, "Discover more"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    selected: true
  }, "Creative web design"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    onClick: () => {}
  }, "Web development"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    onClick: () => {}
  }, "Copywriting"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    onClick: () => {}
  }, "E-commerce"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    onClick: () => {}
  }, "WordPress")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 20,
      marginTop: 40
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "project shot \u2014 green web build",
    height: 260
  }), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "project shot \u2014 mobile screens",
    height: 260
  }), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "project shot \u2014 brand identity",
    height: 260
  }))), /*#__PURE__*/React.createElement("section", {
    style: {
      background: "var(--flow-dark)",
      padding: "110px var(--page-gutter)",
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-strapline)",
      color: "var(--kota-white)"
    }
  }, "rebel against boring"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--text-body-lg)",
      color: "var(--text-inverse-secondary)",
      maxWidth: 420,
      marginTop: 28,
      marginBottom: 0
    }
  }, "We're a creative web design agency for brands who want to stand out \u2014 not fit in."), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/graphics/arrow-corner-white.svg",
    alt: "",
    "aria-hidden": "true",
    style: {
      position: "absolute",
      right: "var(--page-gutter)",
      bottom: 48,
      width: 56
    }
  })));
}
Object.assign(__ds_scope, { WebsiteHome });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteHome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteStudio.jsx
try { (() => {
const underline = {
  textDecoration: "underline",
  textDecorationThickness: "var(--underline-thickness)",
  textUnderlineOffset: "var(--underline-offset)"
};
const VALUES = [{
  n: "01/",
  name: "Get Dirty Quickly",
  color: "pink",
  rotate: -8,
  copy: "Embrace every challenge. Don't be afraid of getting your hands dirty — active curiosity moves us forwards without any fear of failure."
}, {
  n: "02/",
  name: "Connect",
  color: "blue",
  rotate: 6,
  copy: "We actually listen. To our team, our clients, our friends and family. Two heads are often better than one."
}, {
  n: "03/",
  name: "Be Diverse",
  color: "green",
  rotate: -5,
  copy: "We embrace how varied life is — the clients and industries we work in, our interests, our attitudes to life."
}, {
  n: "04/",
  name: "No Crumbs",
  color: "peach",
  rotate: 8,
  copy: "Good is the enemy of great. Every pixel matters. We don't leave it for someone else to tidy up — we leave no crumbs."
}, {
  n: "05/",
  name: "Leave a Legacy",
  color: "purple",
  rotate: -10,
  copy: "We care about the impact we have. It's our duty to leave the world a better place than we found it."
}];

/** Studio / culture — offset section title, value capsules with numbered copy. */
function WebsiteStudio() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "72px 0 96px",
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--page-gutter)",
      display: "grid",
      gridTemplateColumns: "1.2fr 1fr",
      gap: 48,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-section)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-display)"
    }
  }, /*#__PURE__*/React.createElement("div", null, "Our"), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingLeft: "1.6em"
    }
  }, "Values")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h2)",
      letterSpacing: "var(--tracking-tight)",
      paddingTop: 12
    }
  }, "Here's what gets us out of bed ", /*#__PURE__*/React.createElement("span", {
    style: underline
  }, "every morning."))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "64px var(--page-gutter) 0",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 64,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 44
    }
  }, VALUES.map(v => /*#__PURE__*/React.createElement("div", {
    key: v.n,
    style: {
      display: "grid",
      gap: 14,
      justifyItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-small)",
      color: "var(--text-secondary)"
    }
  }, v.n), /*#__PURE__*/React.createElement(__ds_scope.Capsule, {
    color: v.color,
    rotate: v.rotate,
    size: "md"
  }, v.name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      font: "var(--text-body)",
      color: "var(--text-secondary)",
      maxWidth: 420
    }
  }, v.copy)))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 24,
      display: "grid",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "team photo \u2014 laughing on the roof terrace",
    height: 380,
    style: {
      borderRadius: "var(--radius-image) var(--radius-image) var(--radius-image) 96px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "avatar",
    height: 84,
    radius: "50%",
    style: {
      width: 84
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "avatar",
    height: 84,
    radius: "50%",
    style: {
      width: 84
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "avatar",
    height: 84,
    radius: "50%",
    style: {
      width: 84
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "avatar",
    height: 84,
    radius: "50%",
    style: {
      width: 84
    }
  })), /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: "studio photo \u2014 circular mask",
    height: 300,
    radius: "50%",
    style: {
      width: 300,
      justifySelf: "center"
    }
  }))));
}
Object.assign(__ds_scope, { WebsiteStudio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteStudio.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/WebsiteWork.jsx
try { (() => {
function ProjectCard({
  name,
  year,
  label
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: "var(--surface-card-inverse)",
      borderRadius: "var(--radius-card)",
      overflow: "hidden",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "16px 20px",
      color: "var(--kota-white)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 16 16",
    "aria-hidden": "true",
    style: {
      transform: hover ? "translate(2px,2px)" : "none",
      transition: "transform var(--duration-fast) var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: `g-${name}`,
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "var(--kota-purple)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "var(--kota-pink)"
  }))), /*#__PURE__*/React.createElement("path", {
    d: "M3 3l8.5 8.5M12.5 4.5v8h-8",
    fill: "none",
    stroke: `url(#g-${name})`,
    strokeWidth: "2"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "500 15.5px/1 var(--font-primary)",
      flex: 1
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "400 14px/1 var(--font-primary)",
      opacity: 0.7
    }
  }, year)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 12px 12px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Placeholder, {
    label: label,
    height: 280,
    radius: 12,
    style: {
      transform: hover ? "scale(1.015)" : "none",
      transition: "transform var(--duration-med) var(--ease-out)"
    }
  })));
}

/** Work index — black section, offset title, project cards, filter tags. */
function WebsiteWork() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--kota-black)",
      color: "var(--kota-white)",
      padding: "72px 0 96px",
      fontFamily: "var(--font-primary)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--page-gutter)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-section)",
      textTransform: "uppercase",
      letterSpacing: "var(--tracking-display)",
      color: "var(--kota-white)"
    }
  }, /*#__PURE__*/React.createElement("div", null, "Our"), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingLeft: "1.6em"
    }
  }, "Work")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--text-h3)",
      color: "var(--kota-white)",
      maxWidth: 520,
      margin: "24px 0 0"
    }
  }, "Shit-hot work for hot-shot brands."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 24,
      marginTop: 56
    }
  }, /*#__PURE__*/React.createElement(ProjectCard, {
    name: "Tangerine",
    year: "2021",
    label: "site screens collage \u2014 orange accents"
  }), /*#__PURE__*/React.createElement(ProjectCard, {
    name: "BMS Performance",
    year: "2020",
    label: "brand tiles + portrait \u2014 teal / peach"
  }), /*#__PURE__*/React.createElement(ProjectCard, {
    name: "DK&A",
    year: "2023",
    label: "lime landing page crop"
  }), /*#__PURE__*/React.createElement(ProjectCard, {
    name: "Talia Mar",
    year: "2022",
    label: "artist site in circular mask \u2014 purple"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--text-h2)",
      letterSpacing: "var(--tracking-tight)",
      margin: "72px 0 20px",
      color: "var(--kota-white)"
    }
  }, "Discover more"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    inverse: true,
    selected: true
  }, "Creative web design"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    inverse: true,
    onClick: () => {}
  }, "Web development"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    inverse: true,
    onClick: () => {}
  }, "Copywriting"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    inverse: true,
    onClick: () => {}
  }, "E-commerce"), /*#__PURE__*/React.createElement(__ds_scope.Tag, {
    inverse: true,
    onClick: () => {}
  }, "WordPress"))));
}
Object.assign(__ds_scope, { WebsiteWork });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/WebsiteWork.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Capsule = __ds_scope.Capsule;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Placeholder = __ds_scope.Placeholder;

__ds_ns.WebsiteContact = __ds_scope.WebsiteContact;

__ds_ns.WebsiteFooter = __ds_scope.WebsiteFooter;

__ds_ns.WebsiteHeader = __ds_scope.WebsiteHeader;

__ds_ns.WebsiteHome = __ds_scope.WebsiteHome;

__ds_ns.WebsiteStudio = __ds_scope.WebsiteStudio;

__ds_ns.WebsiteWork = __ds_scope.WebsiteWork;

})();
