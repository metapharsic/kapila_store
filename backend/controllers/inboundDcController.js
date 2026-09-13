const inboundDcService = require("../services/inboundDcService");
const { auditLog } = require("../services/auditService");

async function list(req, res, next) {
  try {
    const { status, supplier, search, date_from, date_to } = req.query;
    const pagination = req.pagination || { page: 1, limit: 20, offset: 0 };
    const result = await inboundDcService.listInboundDCs(
      { status, supplier, search, date_from, date_to },
      pagination
    );
    res.json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      kpi: result.kpi
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const dc = await inboundDcService.getInboundDCDetails(req.params.id);
    if (!dc) return res.status(404).json({ success: false, error: "Inbound DC not found" });
    res.json({ success: true, data: dc });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await inboundDcService.createInboundDC(req.body, req.user);
    await auditLog(req, {
      action: "inbound_dc.create",
      resource: "inbound_dc",
      resourceId: result.id,
      metadata: { dc_number: result.dc_number, supplier_name: result.supplier_name, item_count: result.items?.length }
    });
    res.status(201).json({
      success: true,
      message: `Inbound Delivery Challan #${result.dc_number} received. Provisional stock credited.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function matchInvoice(req, res, next) {
  try {
    const result = await inboundDcService.matchInvoiceAndGenerateGRN(req.params.id, req.body, req.user);
    await auditLog(req, {
      action: "inbound_dc.match_invoice",
      resource: "inbound_dc",
      resourceId: result.dc?.id,
      metadata: { invoice_no: req.body.invoice_no, grn_number: result.grn?.grn_number, variance: result.variance }
    });
    res.json({
      success: true,
      message: `3-Way Invoice Match successful. GRN #${result.grn.grn_number} generated and stock ledger reconciled.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const { reason } = req.body;
    const result = await inboundDcService.cancelInboundDC(req.params.id, reason, req.user);
    await auditLog(req, {
      action: "inbound_dc.cancel",
      resource: "inbound_dc",
      resourceId: result.id,
      metadata: { reason }
    });
    res.json({
      success: true,
      message: `Inbound DC #${result.dc_number} cancelled and provisional stock reversed.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getOne,
  create,
  matchInvoice,
  cancel
};
