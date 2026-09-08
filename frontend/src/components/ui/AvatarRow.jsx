import { COLORS, RADIUS } from "../../styles/colors";

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

/**
 * AvatarRow — small circular avatar (image or initials fallback) next to a
 * two-line label: a muted caption above a bold name. Use for any
 * "assigned to / created by / requested by" style field.
 */
export default function AvatarRow({ label, name, imageUrl, size = 32, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, ...style }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: RADIUS.full,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: RADIUS.full,
            background: COLORS.brandLight,
            color: COLORS.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.4,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(name)}
        </div>
      )}
      <div style={{ minWidth: 0, lineHeight: 1.3 }}>
        {label && (
          <div
            style={{
              fontSize: 11,
              color: COLORS.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      </div>
    </div>
  );
}
