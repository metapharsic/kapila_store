import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      return (
        <div style={{
          padding: "24px",
          margin: "16px",
          backgroundColor: "#18181b",
          border: "1px solid #ef4444",
          borderRadius: 12,
          color: "#f4f4f5",
          maxWidth: 600
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ef4444", marginBottom: 12 }}>
            <AlertTriangle size={24} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {this.props.title || "Component Error Encountered"}
            </h3>
          </div>
          <p style={{ fontSize: 13, color: "#a1a1aa", margin: "0 0 12px" }}>
            {this.state.error?.message || "An unexpected error occurred in this module."}
          </p>
          <button
            onClick={this.resetError}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              backgroundColor: "rgba(239, 68, 68, 0.2)",
              border: "1px solid #ef4444",
              borderRadius: 6,
              color: "#fca5a5",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <RefreshCw size={14} /> Retry Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
