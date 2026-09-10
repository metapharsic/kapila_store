const { processPage, compileMasterReport } = require('./multi_agent_indent_processor');

const sampleVouchers = [
  // 16th August
  '16th_August_Transfer_16_08_2026_p01.jpg',
  '16th_August_Transfer_16_08_2026_p02.jpg',
  '16th_August_Transfer_16_08_2026_p03.jpg',
  // 17th August
  '17th_August_Transfer_17_08_2026_p01.jpg',
  '17th_August_Transfer_17_08_2026_p02.jpg',
  '17th_August_Transfer_17_08_2026_p03.jpg',
  // 18th August
  '18th_August_Transfer_18_08_2026_p01.jpg',
  '18th_August_Transfer_18_08_2026_p02.jpg',
  '18th_August_Transfer_18_08_2026_p03.jpg',
  // 19th August
  '19th_August_Transfer_19_08_2026_p01.jpg',
  '19th_August_Transfer_19_08_2026_p02.jpg',
  '19th_August_Transfer_19_08_2026_p03.jpg',
  // 20th August
  '20th_August_Transfer_20_08_2026_p01.jpg',
  '20th_August_Transfer_20_08_2026_p02.jpg',
  '20th_August_Transfer_20_08_2026_p03.jpg'
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  console.log(`Starting cross-date extraction across ${sampleVouchers.length} vouchers...`);
  for (let i = 0; i < sampleVouchers.length; i++) {
    const v = sampleVouchers[i];
    console.log(`[${i + 1}/${sampleVouchers.length}] Processing ${v}...`);
    await processPage(v);
    if ((i + 1) % 3 === 0) {
      compileMasterReport();
    }
    await delay(3000);
  }
  const finalSummary = compileMasterReport();
  console.log('Cross-date extraction complete!');
  console.log('Unique items total:', finalSummary.total_unique_items);
})();
