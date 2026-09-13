import React from "react";
import { getDimensionConfig } from "../utils/units";
import { Scale, Droplets, Hash, Box, HelpCircle } from "lucide-react";

export default function UnitDimensionBadge({
  unit,
  dimension,
  compact = false,
  showIcon = true,
  style = {}
}) {
  const config = getDimensionConfig(dimension || unit);

  const getIcon = () => {
    if (!showIcon) return null;
    const iconSize = compact ? 10 : 12;
    switch (config.dimension) {
      case "weight":
        return <Scale size={iconSize} style={{ flexShrink: 0 }} />;
      case "volume":
        return <Droplets size={iconSize} style={{ flexShrink: 0 }} />;
      case "count":
        return <Hash size={iconSize} style={{ flexShrink: 0 }} />;
      case "packaging":
        return <Box size={iconSize} style={{ flexShrink: 0 }} />;
      default:
        return <HelpCircle size={iconSize} style={{ flexShrink: 0 }} />;
    }
  };

  if (compact) {
    return (
      <span
        title={`Dimension: ${config.label} (${config.description})`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: config.color,
          background: config.bg,
          border: `1px solid ${config.border}`,
          whiteSpace: "nowrap",
          userSelect: "none",
          ...style,
        }}
      >
        {getIcon()}
        <span>{config.shortLabel}</span>
      </span>
    );
  }

  return (
    <div
      title={`Dimension: ${config.label} (${config.description})`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
        whiteSpace: "nowrap",
        userSelect: "none",
        ...style,
      }}
    >
      {getIcon()}
      <span>{config.label}</span>
    </div>
  );
}
