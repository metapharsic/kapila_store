// Re-exports the app's existing Card component so new code can import from
// components/ui alongside Pill/AvatarRow. The real implementation lives in
// components/Card.jsx (rounded-xl, soft shadow, consistent padding prop) —
// kept there rather than duplicated, since it's already used app-wide.
export { default } from "../Card";
