import IssuanceLeftPanel from "./IssuanceLeftPanel";
import IssuanceItemsGrid from "./IssuanceItemsGrid";

export default function IssuanceTopSection({
  onScan, scanning, scanText, msg,
  pendingIndents, selectedIndent, onSelectIndent, onIssue,
  issueQtys, availableStock, onQtyChange, onShowHistory,
  confirmedItems, onToggleConfirm, onToggleAll, isMobile = false,
  stocks, getItemPrice, getItemBaseUnit, onUnitChange,
  onApprove, approving, isStoreManager,
}) {
  if (selectedIndent) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
        <IssuanceItemsGrid
          selectedIndent={selectedIndent} issueQtys={issueQtys}
          availableStock={availableStock} onQtyChange={onQtyChange}
          confirmedItems={confirmedItems} onToggleConfirm={onToggleConfirm} onToggleAll={onToggleAll}
          onIssue={onIssue} onSelectIndent={onSelectIndent}
          isMobile={isMobile} stocks={stocks} getItemPrice={getItemPrice}
          getItemBaseUnit={getItemBaseUnit} onUnitChange={onUnitChange} msg={msg}
          onApprove={onApprove} approving={approving} isStoreManager={isStoreManager}
        />
      </div>
    );
  }

  /* Mobile with no indent selected: show only the left panel (indent list) */
  if (isMobile) {
    return (
      <div style={{ marginBottom: 20 }}>
        <IssuanceLeftPanel
          pendingIndents={pendingIndents} selected={selectedIndent}
          onSelect={onSelectIndent} onIssue={onIssue}
          issueQtys={issueQtys} availableStock={availableStock}
          onScan={onScan} scanning={scanning} scanText={scanText}
          msg={msg} onShowHistory={onShowHistory}
          onApprove={onApprove} approving={approving} isStoreManager={isStoreManager}
        />
      </div>
    );
  }

  return (
    <div className="resp-panel-layout" style={{ marginBottom: 20 }}>
      {/* LEFT — form panel, ~30% */}
      <div className="resp-panel-left">
        <IssuanceLeftPanel
          pendingIndents={pendingIndents} selected={selectedIndent}
          onSelect={onSelectIndent} onIssue={onIssue}
          issueQtys={issueQtys} availableStock={availableStock}
          onScan={onScan} scanning={scanning} scanText={scanText}
          msg={msg} onShowHistory={onShowHistory}
          onApprove={onApprove} approving={approving} isStoreManager={isStoreManager}
        />
      </div>
      {/* RIGHT — items grid, ~70% */}
      <div className="resp-panel-right">
        <IssuanceItemsGrid
          selectedIndent={selectedIndent} issueQtys={issueQtys}
          availableStock={availableStock} onQtyChange={onQtyChange}
          confirmedItems={confirmedItems} onToggleConfirm={onToggleConfirm} onToggleAll={onToggleAll}
          onIssue={onIssue} onSelectIndent={onSelectIndent}
          isMobile={false} stocks={stocks} getItemPrice={getItemPrice}
          getItemBaseUnit={getItemBaseUnit} onUnitChange={onUnitChange}
          onApprove={onApprove} approving={approving} isStoreManager={isStoreManager}
        />
      </div>
    </div>
  );
}
