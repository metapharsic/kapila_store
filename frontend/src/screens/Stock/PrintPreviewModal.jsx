import React from "react";
import { COLORS } from "../../styles/colors";
import { Printer } from "lucide-react";
import Btn from "../../components/Btn";
import QRCode from "qrcode";

const PrintPreviewModal = ({ 
  printModalItem, 
  setPrintModalItem, 
  printConfig, 
  setPrintConfig 
}) => {
  if (!printModalItem) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.65)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: 24, width: 380, maxWidth: "90%",
        boxShadow: `0 8px 32px rgba(15, 23, 42, 0.15)`
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Printer size={18} /> Print Batch Label
        </h3>

        {/* Visual Preview */}
        <div style={{ background: COLORS.bg, padding: 20, borderRadius: 8, marginBottom: 20, display: "flex", justifyContent: "center" }}>
          <div style={{ 
            background: "#fff", color: "#000", width: "1.9in", height: "1.1in", 
            padding: "0.05in", boxSizing: "border-box", display: "flex", 
            justifyContent: "space-between", alignItems: "center", fontFamily: "monospace",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", fontSize: "8px", lineHeight: 1.2, maxWidth: "1.1in" }}>
              <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "2px" }}>{printModalItem.item_code}</div>
              <div style={{ fontSize: "9px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{printModalItem.name}</div>
              <div>Qty: {printModalItem.remaining} {printModalItem.unit}</div>
              <div style={{ color: "#555", fontSize: "7px" }}>Recd: {printModalItem.date}</div>
              {printConfig.showExpiry && printModalItem.expiry_date && <div style={{ color: "#555", fontSize: "7px" }}>Exp: {printModalItem.expiry_date}</div>}
              {printConfig.showPrice && printModalItem.price && <div style={{ fontWeight: "bold" }}>Price: ₹{parseFloat(printModalItem.price).toFixed(2)}</div>}
            </div>
            {printConfig.labelFormat === "qr" ? (
              <div style={{ width: 45, height: 45, background: "#000", opacity: 0.1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "#000" }}>QR</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", height: 35, width: 60 }}>
                  {[2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2].map((w, i) => <div key={i} style={{ flexGrow: w, background: i % 2 === 0 ? "#000" : "#fff", height: "100%" }} />)}
                </div>
                <span style={{ fontSize: 8, marginTop: 2 }}>* {printModalItem.item_code} *</span>
              </div>
            )}
          </div>
        </div>

        {/* Config Checkboxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: COLORS.text }}>
            <input 
              type="checkbox" 
              checked={printConfig.showPrice} 
              onChange={(e) => setPrintConfig(prev => ({ ...prev, showPrice: e.target.checked }))}
              style={{ width: "auto", marginRight: 8 }}
            />
            Include Unit Cost / Price on label
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: COLORS.text }}>
            <input 
              type="checkbox" 
              checked={printConfig.showExpiry} 
              onChange={(e) => setPrintConfig(prev => ({ ...prev, showExpiry: e.target.checked }))}
              style={{ width: "auto", marginRight: 8 }}
            />
            Include Expiry Date on label
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 13, color: COLORS.muted }}>Format:</span>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer", color: COLORS.text }}>
              <input 
                type="radio" 
                name="lblFormat" 
                checked={printConfig.labelFormat === "qr"} 
                onChange={() => setPrintConfig(prev => ({ ...prev, labelFormat: "qr" }))}
                style={{ width: "auto", marginRight: 4 }}
              />
              QR Code
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer", color: COLORS.text }}>
              <input 
                type="radio" 
                name="lblFormat" 
                checked={printConfig.labelFormat === "barcode"} 
                onChange={() => setPrintConfig(prev => ({ ...prev, labelFormat: "barcode" }))}
                style={{ width: "auto", marginRight: 4 }}
              />
              Classic Barcode
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn 
          onClick={async () => {
              const printWindow = window.open("", "_blank", "width=400,height=300");
              let content;
              if (printConfig.labelFormat === "qr") {
                const url = await QRCode.toDataURL(printModalItem.item_code, { width: 100, margin: 1 });
                content = `<img class="qr" src="${url}" />`;
              } else {
                content = `
                  <div class="barcode-container">
                    <div class="barcode">
                      ${[2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2].map((w, i) => `<div class="bar" style="flex-grow: ${w}; background: ${i % 2 === 0 ? "#000" : "#fff"}"></div>`).join("")}
                    </div>
                    <div class="barcode-text">* ${printModalItem.item_code} *</div>
                  </div>
                `;
              }

              printWindow.document.write(`
                <html>
                  <head>
                    <title>Print Label - ${printModalItem.item_code}</title>
                    <style>
                      @page { size: 2in 1.2in; margin: 0; }
                      body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 1.9in;
                        height: 1.1in;
                        padding: 0.05in;
                        margin: 0;
                        box-sizing: border-box;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        background: #fff;
                        color: #000;
                      }
                      .info {
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        font-size: 8px;
                        line-height: 1.1;
                        max-width: 1.1in;
                      }
                      .code {
                        font-size: 10px;
                        font-weight: bold;
                        margin-bottom: 2px;
                      }
                      .name {
                        font-size: 9px;
                        font-weight: bold;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      }
                      .date {
                        color: #555;
                        font-size: 7px;
                        margin-top: 1px;
                      }
                      .qr {
                        width: 45px;
                        height: 45px;
                      }
                      .barcode-container {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                      }
                      .barcode {
                        display: flex;
                        height: 35px;
                        width: 60px;
                      }
                      .bar {
                        height: 100%;
                      }
                      .barcode-text {
                        font-size: 6px;
                        margin-top: 2px;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="info">
                      <div class="code">${printModalItem.item_code}</div>
                      <div class="name">${printModalItem.name}</div>
                      <div class="qty">Qty: ${printModalItem.remaining} ${printModalItem.unit}</div>
                      <div class="date">Recd: ${printModalItem.date}</div>
                      ${printConfig.showExpiry && printModalItem.expiry_date ? `<div class="date">Exp: ${printModalItem.expiry_date}</div>` : ""}
                      ${printConfig.showPrice && printModalItem.price ? `<div class="date" style="font-weight:bold;">Price: ₹${parseFloat(printModalItem.price).toFixed(2)}</div>` : ""}
                    </div>
                    ${content}
                    <script>window.onload = function() { window.print(); window.close(); }</script>
                  </body>
                </html>
              `);
              printWindow.document.close();
              setPrintModalItem(null);
            }} 
            icon={<Printer size={16} />}
            style={{ flex: 1 }}
          >
            Confirm Print
          </Btn>
          <Btn variant="ghost" onClick={() => setPrintModalItem(null)} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewModal;
