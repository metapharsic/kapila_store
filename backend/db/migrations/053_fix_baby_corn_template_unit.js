// The "SOUTH INDIAN" sheet prints "Kg" for Baby Corn, but the real form has a
// handwritten correction next to it ("Tins") and the stock item (KPL-112) is
// actually tracked in "tin" — inventory's unit is authoritative for deduction
// math, so the template should match it, not the printed sheet's stale label.
exports.up = async function (knex) {
  await knex("indent_templates")
    .where({ template_name: "SOUTH INDIAN", row_no: 4 })
    .update({ default_unit: "tin" });
};

exports.down = async function (knex) {
  await knex("indent_templates")
    .where({ template_name: "SOUTH INDIAN", row_no: 4 })
    .update({ default_unit: "Kg" });
};
